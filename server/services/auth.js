import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getDb, uid, getTenantId, DEFAULT_TENANT_ID, runWithTenant } from '../db.js';
import { getJwtSecret, generateToken, ACCESS_TOKEN_MAX_AGE_MS, REFRESH_TOKEN_MAX_AGE_MS } from '../middleware/auth.js';
import { ForbiddenError, ConflictError, UnauthorizedError, BadRequestError } from '../middleware/errors.js';
import { MICROSOFT_CLIENT_ID, verifyMicrosoftIdToken } from './microsoft.js';
import { listTenants, getTenantById } from './tenants.js';
import { ACTIVE_TENANT_COOKIE } from '../middleware/tenant.js';
import logger from '../lib/logger.js';

const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || '';

export const VALID_TIERS = ['admin', 'manager', 'accounting', 'agent', 'client', 'supplier'];

/**
 * Canonicalize an email for storage and lookup. Emails are treated
 * case-insensitively, so we lowercase and trim on every write; reads still
 * compare with LOWER(email) to also catch any legacy mixed-case rows.
 * @returns {string}
 */
function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/**
 * Strip sensitive/internal columns (password, microsoft_id, invite_token, ...)
 * from a raw `users` row before it's sent to the client.
 * @returns {object} Client-safe user object with parsed JSON fields.
 */
export function safeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    user_tier: u.user_tier,
    role: u.role,
    language: u.language,
    default_currency: u.default_currency || 'USD',
    avatar_url: u.avatar_url || null,
    email_notifications: !!u.email_notifications,
    custom_permissions: JSON.parse(u.custom_permissions || '[]'),
    departments: JSON.parse(u.departments || '[]'),
    client_id: u.client_id,
    linked_supplier_id: u.linked_supplier_id,
    is_active: !!u.is_active,
    created_date: u.created_date,
  };
}

/**
 * Set the three auth cookies in one call:
 *  - `token` (httpOnly): short-lived access JWT (~15m).
 *  - `refresh_token` (httpOnly): long-lived rotating refresh token (~30d);
 *    its raw value is shown to the client exactly once, at issuance.
 *  - `csrf_token` (not httpOnly): double-submit CSRF token; the frontend
 *    reads it and echoes it back as the `X-CSRF-Token` header on mutations,
 *    and {@link import('../middleware/csrf.js').csrfMiddleware} checks the two
 *    match. A cross-site attacker can trigger the cookie-bearing request but
 *    can't read the cookie value to build the matching header.
 *
 * The CSRF cookie deliberately shares the refresh token's (long) lifetime so
 * it outlives the short access token and is still present when the browser
 * needs to refresh.
 */
export function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  // When the platform is served from a root domain (APP_ROOT_DOMAIN), set the
  // auth cookies on that root so a session established on the apex (e.g. during
  // self-serve signup) is also valid on the user's <slug>.<APP_ROOT_DOMAIN>
  // workspace. Tenant scoping (authMiddleware's TENANT_MISMATCH check) still
  // prevents a token from one workspace being used against another, so sharing
  // the cookie domain does not weaken isolation.
  const rootDomain = process.env.APP_ROOT_DOMAIN;
  const cookieOptions = {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
  if (rootDomain) cookieOptions.domain = `.${String(rootDomain).replace(/^\.+/, '')}`;
  res.cookie('token', accessToken, { ...cookieOptions, httpOnly: true, maxAge: ACCESS_TOKEN_MAX_AGE_MS });
  res.cookie('refresh_token', refreshToken, { ...cookieOptions, httpOnly: true, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
  res.cookie('csrf_token', csrfToken, { ...cookieOptions, httpOnly: false, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
}

/**
 * Set the `active_tenant` cookie so the bare/apex domain resolves to `slug`
 * (single-domain / cookie mode, used when wildcard DNS isn't available). The
 * cookie shares the auth cookies' lifetime/domain so it travels with the session.
 * The legacy default tenant (id 0) has no slug — callers must skip this for it
 * (an unset cookie correctly falls back to the default tenant).
 * httpOnly: the frontend never reads it (workspace info comes from
 * GET /api/tenants/me), so keep it out of reach of page scripts.
 */
export function setActiveTenantCookie(res, slug) {
  if (!slug) return;
  const rootDomain = process.env.APP_ROOT_DOMAIN;
  const opts = {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  };
  if (process.env.NODE_ENV === 'production') opts.secure = true;
  if (rootDomain) opts.domain = `.${String(rootDomain).replace(/^\.+/, '')}`;
  res.cookie(ACTIVE_TENANT_COOKIE, slug, opts);
}

/** Clear the `active_tenant` cookie (logout / switch to the default tenant). */
export function clearActiveTenantCookie(res) {
  const rootDomain = process.env.APP_ROOT_DOMAIN;
  const opts = { path: '/' };
  if (rootDomain) opts.domain = `.${String(rootDomain).replace(/^\.+/, '')}`;
  res.clearCookie(ACTIVE_TENANT_COOKIE, opts);
}

/**
 * Locate every account with this email across all workspaces (including the
 * legacy default tenant 0), each with the tenant it belongs to. Used for
 * single-domain login where the Host header doesn't identify the workspace —
 * the caller disambiguates between workspaces by which account the password
 * actually verifies against.
 * @returns {Array<{tenantId: string, db: import('better-sqlite3').Database, user: object}>}
 */
export function locateUsersByEmail(email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized) return [];
  const matches = [];
  const tenantIds = [DEFAULT_TENANT_ID, ...listTenants().map((t) => t.id)];
  for (const tenantId of tenantIds) {
    const db = getDb(tenantId);
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalized);
    if (user) matches.push({ tenantId, db, user });
  }
  return matches;
}

/** Locate a user by Microsoft identity across all tenants. @returns {{tenantId: string, db, user}|null} */
export function locateUserByMicrosoft(microsoftId, email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  const tenantIds = [DEFAULT_TENANT_ID, ...listTenants().map((t) => t.id)];
  for (const tenantId of tenantIds) {
    const db = getDb(tenantId);
    let user = db.prepare('SELECT * FROM users WHERE microsoft_id = ?').get(microsoftId);
    if (!user && normalized) user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalized);
    if (user) return { tenantId, db, user };
  }
  return null;
}

/** Find the workspace whose configured Azure AD tenant matches `tid`. @returns {object|null} */
export function locateTenantByAzureTid(tid) {
  if (!tid) return null;
  const target = String(tid).toLowerCase();
  return listTenants().find((t) => t.azure_tenant_id && t.azure_tenant_id.toLowerCase() === target) || null;
}

/** SHA-256 hash of a raw refresh token, for storage/lookup (never store the raw value). */
function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Persist a new refresh token for `userId` and return its raw value (shown to
 * the client exactly once). The DB only stores the hash.
 * @returns {string} The raw refresh token.
 */
export function createRefreshToken(userId, { userAgent, ip } = {}) {
  const db = getDb();
  const raw = crypto.randomBytes(40).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (id, token_hash, user_id, expires_at, revoked, created_at, user_agent, ip) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
  ).run(uid(), hashRefreshToken(raw), userId, expiresAt, now, userAgent || null, ip || null);
  return raw;
}

/** @returns {object|null} The refresh-token row (by raw token), or null if missing/revoked/expired. */
export function findValidRefreshToken(raw) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashRefreshToken(raw));
  if (!row) return null;
  if (row.revoked) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

/** Mark a refresh token (by raw value) as revoked. No-op if it doesn't exist. */
export function revokeRefreshToken(raw) {
  const db = getDb();
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(hashRefreshToken(raw));
}

/** Revoke every refresh token a user holds (logout-everywhere / deactivation). */
export function revokeAllUserRefreshTokens(userId) {
  const db = getDb();
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
}

/**
 * Validate a presented refresh token, rotate it (revoke the old, issue a new
 * one), and return fresh access + refresh tokens plus the (re-read) user.
 * @throws {UnauthorizedError} If the refresh token is missing, revoked, or expired.
 */
export function rotateRefreshToken(raw, { userAgent, ip } = {}) {
  const old = findValidRefreshToken(raw);
  if (!old) throw new UnauthorizedError('Invalid or expired refresh token');

  const db = getDb();
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(old.user_id);
  if (!userRow || !userRow.is_active) throw new UnauthorizedError('Invalid or expired refresh token');

  // Revoke the presented token first, then mint a new pair. Done in a
  // transaction so we never end up with two live tokens for the same rotation.
  const newRaw = db.transaction(() => {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(hashRefreshToken(raw));
    return createRefreshToken(old.user_id, { userAgent, ip });
  })();

  const user = safeUser(userRow);
  const accessToken = generateToken(user);
  const csrfToken = crypto.randomBytes(32).toString('hex');
  return { accessToken, refreshToken: newRaw, csrfToken, user };
}

/**
 * Establish a new authenticated session: mint a short-lived access token and a
 * rotating refresh token, set the three auth cookies, and return the tokens +
 * user for the JSON response. The raw refresh token is returned to the client
 * exactly once (it becomes the `refresh_token` cookie).
 * @returns {{accessToken: string, refreshToken: string, csrfToken: string, user: object}}
 */
export function issueSession(res, user, { userAgent, ip } = {}) {
  const accessToken = generateToken(user);
  const refreshToken = createRefreshToken(user.id, { userAgent, ip });
  const csrfToken = crypto.randomBytes(32).toString('hex');
  setAuthCookies(res, { accessToken, refreshToken, csrfToken });
  return { accessToken, refreshToken, csrfToken, user };
}

/**
 * Verify email/password against the local `users` table.
 * @returns {object} The authenticated user, via {@link safeUser}.
 * @throws {UnauthorizedError} If the account doesn't exist, is inactive, or the password is wrong.
 */
export function authenticateLocal(email, password) {
  const normalized = normalizeEmail(email);
  const currentId = getTenantId() ?? DEFAULT_TENANT_ID;

  // Candidate accounts, most specific first: the workspace already selected for
  // this request (a subdomain, or a workspace chosen via the active_tenant
  // cookie), then — for single-domain mode, where the Host header can't tell us
  // the workspace — every other workspace with this email. When the same email
  // exists in several workspaces, the password decides which account (and thus
  // which workspace) the session belongs to, instead of the first match always
  // winning.
  const candidates = [];
  const current = getDb(currentId).prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalized);
  if (current) candidates.push({ tenantId: currentId, user: current });
  for (const located of locateUsersByEmail(normalized)) {
    if (located.tenantId !== currentId) candidates.push(located);
  }

  const active = candidates.filter((c) => c.user.is_active);
  if (active.length === 0) throw new UnauthorizedError('Invalid email or password');

  for (const { tenantId, user } of active) {
    // SSO-linked accounts have no usable local password (see
    // authenticateMicrosoft) and can never win the password check.
    if (user.microsoft_id || !user.password) continue;
    if (bcrypt.compareSync(password, user.password)) {
      return { user: safeUser(user), tenantId };
    }
  }

  // Nothing verified. If every account with this email is SSO-linked, keep the
  // original guidance toward Microsoft sign-in; otherwise stay generic.
  if (active.every((c) => c.user.microsoft_id)) {
    throw new UnauthorizedError('This account uses Microsoft sign-in. Please use "Sign in with Microsoft".');
  }
  throw new UnauthorizedError('Invalid email or password');
}

/**
 * Verify a Microsoft SSO id token, then find-or-create the matching local user
 * (matching by `microsoft_id` first, falling back to a case-insensitive email
 * match so an existing local account gets linked instead of duplicated).
 * @param {string} idToken - Microsoft-issued JWT id token.
 * @returns {object} The authenticated user, via {@link safeUser}.
 * @throws {UnauthorizedError|ForbiddenError} On invalid token, wrong tenant, or pending approval.
 */
export async function authenticateMicrosoft(idToken) {
  // Verify the token (signature/audience/expiry) and unpack the claims first;
  // if the signature is bad we must reject before doing any tenant lookup.
  const { microsoftId, email, name, tid } = await verifyMicrosoftIdToken(idToken);

  // Resolve which workspace this Microsoft account belongs to.
  //   - Subdomain mode: the workspace is already scoped by the Host header
  //     (req.tenantId), so we trust that.
  //   - Single-domain mode: match the workspace by its Azure AD org (tid),
  //     falling back to the user's identity across all workspaces.
  let tenantId = getTenantId() ?? null;
  if (!tenantId || tenantId === DEFAULT_TENANT_ID) {
    const byTid = locateTenantByAzureTid(tid);
    if (byTid) {
      tenantId = byTid.id;
    } else {
      const located = locateUserByMicrosoft(microsoftId, email);
      if (located) tenantId = located.tenantId;
    }
  }
  if (!tenantId) {
    throw new ForbiddenError('No workspace is associated with this Microsoft account.', 'NO_WORKSPACE');
  }

  const tenant = getTenantById(tenantId);
  if (!tenant) throw new ForbiddenError('Workspace not found.');

  // A workspace may bring its own Azure AD tenant (tenants.azure_tenant_id);
  // the legacy single-tenant config still falls back to the global
  // MICROSOFT_TENANT_ID env var. Without either, SSO can't be verified.
  const azureTenant = tenant.azure_tenant_id || MICROSOFT_TENANT_ID;
  if (!MICROSOFT_CLIENT_ID || !azureTenant) {
    throw new UnauthorizedError('Microsoft SSO is not configured for this workspace.');
  }

  // Verify the user belongs to the correct company tenant.
  if (tid !== azureTenant) {
    logger.warn({ tid, expected: azureTenant }, 'Access denied: unauthorized tenant');
    throw new ForbiddenError('Access denied: your account does not belong to the authorized organization.');
  }

  const rawUser = runWithTenant(tenantId, () => {
    const db = getDb();
    return db.transaction(() => {
      // 1. Try by microsoft_id (fast path, exact match)
      let u = db.prepare('SELECT * FROM users WHERE microsoft_id = ?').get(microsoftId);
      if (!u) {
        // 2. Case-insensitive email fallback (Microsoft may return different casing)
        u = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
        if (u) {
          // Link microsoft_id so future logins hit the fast path
          db.prepare('UPDATE users SET microsoft_id = ?, updated_date = ? WHERE id = ?').run(
            microsoftId,
            new Date().toISOString(),
            u.id,
          );
        } else {
          // New user — create with agent tier. The password column is left
          // empty (unusable): SSO accounts must authenticate through Microsoft,
          // and authenticateLocal rejects any account with a microsoft_id.
          const now = new Date().toISOString();
          const id = uid();
          db.prepare(
            'INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, microsoft_id, departments, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
          ).run(id, email, '', name, 'agent', 'agent', 'en', '[]', microsoftId, '[]', now, now);
          u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        }
      }
      return u;
    })();
  });

  if (!rawUser.is_active) {
    throw new ForbiddenError('Account pending approval. Contact an administrator.', 'ACCOUNT_PENDING');
  }

  return { user: safeUser(rawUser), tenantId, slug: tenant.slug || null };
}

/** @returns {object|null} The raw `users` row (not sanitized), or null if not found. */
export function getUserById(id) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return user || null;
}

/** @returns {{password: string}|undefined} The hashed password column only, for change-password checks. */
export function getUserPassword(id) {
  const db = getDb();
  return db.prepare('SELECT password FROM users WHERE id = ?').get(id);
}

/**
 * Patch a user's editable fields. Only keys present in `fields` are updated;
 * `user_tier` also mirrors into the legacy `role` column, and `password` is
 * re-hashed if provided.
 * @returns {object|null} The updated row, or null if `fields` had nothing to update.
 */
export function updateUser(id, fields) {
  const db = getDb();
  const now = new Date().toISOString();
  const updates = [];
  const values = [];

  const fieldMap = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    user_tier: 'user_tier',
    language: 'language',
    is_active: 'is_active',
    default_currency: 'default_currency',
    avatar_url: 'avatar_url',
    client_id: 'client_id',
    linked_supplier_id: 'linked_supplier_id',
    email_notifications: 'email_notifications',
  };
  const booleanFields = new Set(['is_active', 'email_notifications']);

  for (const [key, col] of Object.entries(fieldMap)) {
    if (fields[key] !== undefined) {
      updates.push(`${col} = ?`);
      values.push(booleanFields.has(key) ? (fields[key] ? 1 : 0) : fields[key]);
    }
  }

  if (fields.user_tier !== undefined) {
    updates.push('role = ?');
    values.push(fields.user_tier);
  }

  if (fields.custom_permissions !== undefined) {
    updates.push('custom_permissions = ?');
    values.push(JSON.stringify(fields.custom_permissions));
  }

  if (fields.departments !== undefined) {
    updates.push('departments = ?');
    values.push(JSON.stringify(fields.departments));
  }

  if (fields.password) {
    updates.push('password = ?');
    values.push(bcrypt.hashSync(fields.password, 10));
  }

  if (updates.length === 0) return null;

  updates.push('updated_date = ?');
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

/** Permanently delete a user by id. */
export function deleteUser(id) {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

/** @returns {object[]} All users (raw rows), oldest first. */
export function getAllUsers() {
  const db = getDb();
  return db.prepare('SELECT * FROM users ORDER BY created_date ASC').all();
}

/**
 * Create an inactive user record with a 7-day invite token, for the invited
 * user to activate later via {@link acceptInvite}.
 * @returns {{id: string, email: string, name: string, token: string, expires: string}}
 * @throws {ConflictError} If the email is already registered.
 */
export function inviteUser({ email, name, user_tier, custom_permissions, departments, client_id, invited_by }) {
  const db = getDb();
  email = normalizeEmail(email);
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
  if (existing) throw new ConflictError('Email already registered');

  const tier = VALID_TIERS.includes(user_tier) ? user_tier : 'agent';
  if (tier === 'client' && !client_id) {
    throw new BadRequestError('client_id is required when inviting a client-tier user');
  }
  const perms = Array.isArray(custom_permissions) ? custom_permissions : [];
  const deps = Array.isArray(departments) ? departments : [];
  const now = new Date().toISOString();
  const id = uid();
  const token = uid() + uid();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, departments, is_active, invite_token, invite_expires, client_id, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    email,
    '',
    name || email.split('@')[0],
    tier,
    tier,
    'en',
    JSON.stringify(perms),
    JSON.stringify(deps),
    0,
    token,
    expires,
    tier === 'client' ? client_id : null,
    now,
    now,
  );

  return { id, email, name, token, expires };
}

/**
 * Activate an invited user: sets their name/password and clears the invite token.
 * @returns {object} The now-active user, via {@link safeUser}.
 * @throws {BadRequestError} If the token is invalid or expired.
 */
export function acceptInvite({ token, name, password }) {
  // The invite token lives in the workspace DB the invitation was issued from;
  // search every workspace (incl. the legacy default) for it so the link works
  // on the bare domain in single-domain mode.
  const located = locateInvite(token);
  if (!located) throw new BadRequestError('Invalid or expired invitation link', 'INVITE_INVALID');
  const { tenantId, db, user } = located;
  if (user.invite_expires && new Date(user.invite_expires) < new Date()) {
    throw new BadRequestError('Invitation link has expired', 'INVITE_EXPIRED');
  }

  const hashed = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE users SET name = ?, password = ?, is_active = 1, invite_token = NULL, invite_expires = NULL, updated_date = ? WHERE id = ?',
  ).run(name, hashed, now, user.id);

  return { user: safeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)), tenantId };
}

/** Locate an invitation by token across all workspaces. @returns {{tenantId, db, user}|null} */
export function locateInvite(token) {
  if (!token) return null;
  const tenantIds = [DEFAULT_TENANT_ID, ...listTenants().map((t) => t.id)];
  for (const tenantId of tenantIds) {
    const db = getDb(tenantId);
    const user = db.prepare('SELECT * FROM users WHERE invite_token = ?').get(token);
    if (user) return { tenantId, db, user };
  }
  return null;
}

/**
 * Issues a 1-hour password-reset token for `email`, scoped to the current
 * tenant only (the workspace already selected for this request — same
 * "current tenant first" precedent as {@link authenticateLocal}'s candidate
 * ordering). Unlike login, there's no password here to disambiguate a
 * same-email match across several workspaces, so — rather than guess or
 * email every matching workspace — this only ever resets the account in the
 * workspace the request actually came from.
 *
 * Returns `null` (no token minted, caller sends no email) for an unknown or
 * inactive email, or one with no usable local password (`microsoft_id` set —
 * {@link authenticateLocal} already refuses password login for those, so
 * resetting one would be a dead end). The route must respond identically
 * either way, so a reset request can't be used to test which emails exist.
 * @returns {{email: string, name: string, token: string}|null}
 */
export function requestPasswordReset(email) {
  const db = getDb();
  const normalized = normalizeEmail(email);
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalized);
  if (!user || !user.is_active || user.microsoft_id) return null;

  const token = uid() + uid();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?').run(
    token,
    expires,
    user.id,
  );
  return { email: user.email, name: user.name, token };
}

/** Locate a password-reset request by token across all workspaces (mirrors {@link locateInvite}). */
export function locatePasswordReset(token) {
  if (!token) return null;
  const tenantIds = [DEFAULT_TENANT_ID, ...listTenants().map((t) => t.id)];
  for (const tenantId of tenantIds) {
    const db = getDb(tenantId);
    const user = db.prepare('SELECT * FROM users WHERE password_reset_token = ?').get(token);
    if (user) return { tenantId, db, user };
  }
  return null;
}

/**
 * Completes a password reset: validates the token, sets the new password,
 * clears the token, and revokes every refresh token the account currently
 * holds — a reset is a natural point to end any other active session (e.g.
 * if the reset was prompted by a compromised password).
 * @returns {{tenantId: string}}
 * @throws {BadRequestError} If the token is invalid or expired.
 */
export function resetPassword({ token, newPassword }) {
  const located = locatePasswordReset(token);
  if (!located) throw new BadRequestError('Invalid or expired reset link', 'RESET_INVALID');
  const { db, tenantId, user } = located;
  if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
    throw new BadRequestError('Reset link has expired', 'RESET_EXPIRED');
  }

  const hashed = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_date = ? WHERE id = ?',
  ).run(hashed, now, user.id);

  runWithTenant(tenantId, () => revokeAllUserRefreshTokens(user.id));
  return { tenantId };
}

/**
 * Directly create an already-active user (admin-created, no invite flow).
 * @returns {object} The raw new user row.
 * @throws {ConflictError} If the email is already registered.
 */
export function createUser({
  email,
  password,
  name,
  user_tier,
  custom_permissions,
  departments,
  is_active,
  client_id,
  linked_supplier_id,
}) {
  const db = getDb();
  email = normalizeEmail(email);
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
  if (existing) throw new ConflictError('Email already registered');

  const tier = VALID_TIERS.includes(user_tier) ? user_tier : 'agent';
  if (tier === 'client' && !client_id) {
    throw new BadRequestError('client_id is required when creating a client-tier user');
  }
  if (tier === 'supplier' && !linked_supplier_id) {
    throw new BadRequestError('linked_supplier_id is required when creating a supplier-tier user');
  }
  const perms = Array.isArray(custom_permissions) ? custom_permissions : [];
  const deps = Array.isArray(departments) ? departments : [];
  const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;
  const now = new Date().toISOString();
  const hashed = bcrypt.hashSync(password, 10);
  const id = uid();

  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, departments, is_active, client_id, linked_supplier_id, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    email,
    hashed,
    name,
    tier,
    tier,
    'en',
    JSON.stringify(perms),
    JSON.stringify(deps),
    active,
    tier === 'client' ? client_id : null,
    tier === 'supplier' ? linked_supplier_id : null,
    now,
    now,
  );

  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}
