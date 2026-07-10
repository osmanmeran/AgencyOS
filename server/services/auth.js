import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getDb, uid } from '../db.js';
import { getJwtSecret } from '../middleware/auth.js';
import { ForbiddenError, ConflictError, UnauthorizedError, BadRequestError } from '../middleware/errors.js';
import logger from '../lib/logger.js';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || '';

export const VALID_TIERS = ['admin', 'manager', 'accounting', 'agent', 'client'];

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

/** Set the httpOnly JWT auth cookie on the response, valid for 24 hours. */
export function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/**
 * Verify email/password against the local `users` table.
 * @returns {object} The authenticated user, via {@link safeUser}.
 * @throws {UnauthorizedError} If the account doesn't exist, is inactive, or the password is wrong.
 */
export function authenticateLocal(email, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalizeEmail(email));
  if (!user || !user.is_active) throw new UnauthorizedError('Invalid email or password');

  // SSO-linked accounts have no usable local password (see authenticateMicrosoft);
  // reject up front so a guessed/leaked hash input can never open a second door.
  if (user.microsoft_id) {
    throw new UnauthorizedError('This account uses Microsoft sign-in. Please use "Sign in with Microsoft".');
  }
  if (!user.password) throw new UnauthorizedError('Invalid email or password');

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  return safeUser(user);
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
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_TENANT_ID) {
    throw new UnauthorizedError('Microsoft SSO is not configured on the server.');
  }

  const JWKS = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/discovery/v2.0/keys`),
  );

  let payload;
  try {
    const result = await jwtVerify(idToken, JWKS, {
      audience: MICROSOFT_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/v2.0`,
    });
    payload = result.payload;
  } catch (err) {
    logger.error({ err: err.message }, 'Microsoft token verification failed');
    throw new UnauthorizedError('Microsoft token is invalid or expired.');
  }

  // Verify the user belongs to the correct company tenant
  if (payload.tid !== MICROSOFT_TENANT_ID) {
    logger.warn({ tid: payload.tid, expected: MICROSOFT_TENANT_ID }, 'Access denied: unauthorized tenant');
    throw new ForbiddenError('Access denied: your account does not belong to the authorized organization.');
  }

  const microsoftId = payload.oid || payload.sub;
  const rawEmail = payload.preferred_username || payload.email || payload.unique_name;

  if (!rawEmail) {
    throw new UnauthorizedError('Could not retrieve the email from the Microsoft account.');
  }

  const email = normalizeEmail(rawEmail);
  const name = payload.name || email.split('@')[0];

  const db = getDb();
  const user = db.transaction(() => {
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

  if (!user.is_active) {
    throw new ForbiddenError('Account pending approval. Contact an administrator.', 'ACCOUNT_PENDING');
  }

  return safeUser(user);
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
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE invite_token = ?').get(token);
  if (!user) throw new BadRequestError('Invalid or expired invitation link', 'INVITE_INVALID');
  if (user.invite_expires && new Date(user.invite_expires) < new Date()) {
    throw new BadRequestError('Invitation link has expired', 'INVITE_EXPIRED');
  }

  const hashed = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE users SET name = ?, password = ?, is_active = 1, invite_token = NULL, invite_expires = NULL, updated_date = ? WHERE id = ?',
  ).run(name, hashed, now, user.id);

  return safeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id));
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
}) {
  const db = getDb();
  email = normalizeEmail(email);
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
  if (existing) throw new ConflictError('Email already registered');

  const tier = VALID_TIERS.includes(user_tier) ? user_tier : 'agent';
  if (tier === 'client' && !client_id) {
    throw new BadRequestError('client_id is required when creating a client-tier user');
  }
  const perms = Array.isArray(custom_permissions) ? custom_permissions : [];
  const deps = Array.isArray(departments) ? departments : [];
  const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;
  const now = new Date().toISOString();
  const hashed = bcrypt.hashSync(password, 10);
  const id = uid();

  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, departments, is_active, client_id, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
    now,
    now,
  );

  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}
