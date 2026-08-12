import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb, uid, hasFts, runWithTenant } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireTier, requirePermission } from '../middleware/permissions.js';
import {
  catchAsync,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
} from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { exchangeMicrosoftCode } from '../services/microsoft.js';
import {
  authenticateLocal,
  authenticateMicrosoft,
  authenticateGoogle,
  safeUser,
  issueSession,
  rotateRefreshToken,
  revokeRefreshToken,
  setAuthCookies,
  setActiveTenantCookie,
  clearActiveTenantCookie,
  getUserById,
  getUserPassword,
  updateUser,
  deleteUser,
  getAllUsers,
  createUser,
  inviteUser,
  acceptInvite,
  requestPasswordReset,
  resetPassword,
} from '../services/auth.js';
import { getTenantById } from '../services/tenants.js';
import { workspaceUrl } from '../middleware/tenant.js';
import { sendEmail } from '../services/email.js';
import { logAudit, AUDIT_ACTIONS } from '../services/audit.js';
import logger from '../lib/logger.js';

/**
 * Generate a reasonably strong temporary password for admin-provisioned
 * client-portal accounts. Excludes ambiguous characters (0/O, 1/l/I).
 * @returns {string}
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(16);
  let pw = '';
  for (let i = 0; i < 12; i += 1) pw += chars[bytes[i] % chars.length];
  return pw;
}

/** Mirror of services/entities.js upsertFts (not exported) for direct inserts. */
function upsertFtsInline(db, id, type, data) {
  if (!hasFts(db)) return;
  try {
    db.prepare('DELETE FROM entities_fts WHERE id = ?').run(id);
    db.prepare('INSERT INTO entities_fts(id, type, label, content) VALUES (?, ?, ?, ?)').run(
      id,
      type,
      type,
      JSON.stringify(data),
    );
  } catch {
    /* FTS is best-effort */
  }
}

/** @returns {object|null} The Client entity row ({ id, data }) or null. */
function getClientRow(db, clientId) {
  const row = db.prepare("SELECT * FROM entities WHERE type = 'Client' AND id = ?").get(clientId);
  if (!row) return null;
  return { id: row.id, data: JSON.parse(row.data) };
}

/** @returns {{exists: boolean, is_active: boolean, linked: boolean}} Client-portal account state for an email. */
function getClientAccountState(db, email, clientId) {
  if (!email) return { exists: false, is_active: false, linked: false };
  const u = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(String(email).toLowerCase());
  if (!u || u.user_tier !== 'client') return { exists: false, is_active: false, linked: false };
  return { exists: true, is_active: !!u.is_active, linked: u.client_id === clientId };
}

/** @returns {object|null} The Supplier entity row ({ id, data }) or null. */
function getSupplierRow(db, supplierId) {
  const row = db.prepare("SELECT * FROM entities WHERE type = 'Supplier' AND id = ?").get(supplierId);
  if (!row) return null;
  return { id: row.id, data: JSON.parse(row.data) };
}

/** @returns {{exists: boolean, is_active: boolean, linked: boolean}} Supplier-portal account state for an email. */
function getSupplierAccountState(db, email, supplierId) {
  if (!email) return { exists: false, is_active: false, linked: false };
  const u = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(String(email).toLowerCase());
  if (!u || u.user_tier !== 'supplier') return { exists: false, is_active: false, linked: false };
  return { exists: true, is_active: !!u.is_active, linked: u.linked_supplier_id === supplierId };
}

const router = Router();

router.post(
  '/microsoft',
  validate(schemas.microsoftAuth),
  catchAsync(async (req, res) => {
    let result;
    try {
      result = await authenticateMicrosoft(req.body.idToken);
    } catch (err) {
      logAudit({ action: AUDIT_ACTIONS.LOGIN_FAILED, entityType: 'auth', ip: req.ip });
      throw err;
    }
    const { user, tenantId, slug } = result;
    const token = runWithTenant(tenantId, () =>
      issueSession(res, user, { userAgent: req.get('user-agent'), ip: req.ip }),
    ).accessToken;
    if (slug) setActiveTenantCookie(res, slug);
    else clearActiveTenantCookie(res);
    logAudit({
      userId: user.id,
      userName: user.email,
      action: AUDIT_ACTIONS.LOGIN,
      entityType: 'auth',
      entityId: user.id,
      ip: req.ip,
    });
    res.json({ token, user });
  }),
);

// Microsoft sign-in for callers that hold an authorization code rather than an
// id token — i.e. the mobile app, which completes the flow in a Custom Tab and
// cannot redeem the code itself (see exchangeMicrosoftCode for why). Identical
// to /microsoft once the code has been traded for a token.
router.post(
  '/microsoft/code',
  validate(schemas.googleAuth), // same {code, codeVerifier, redirectUri} shape
  catchAsync(async (req, res) => {
    let result;
    try {
      const idToken = await exchangeMicrosoftCode(req.body);
      result = await authenticateMicrosoft(idToken);
    } catch (err) {
      logAudit({ action: AUDIT_ACTIONS.LOGIN_FAILED, entityType: 'auth', ip: req.ip });
      throw err;
    }
    const { user, tenantId, slug } = result;
    const token = runWithTenant(tenantId, () =>
      issueSession(res, user, { userAgent: req.get('user-agent'), ip: req.ip }),
    ).accessToken;
    if (slug) setActiveTenantCookie(res, slug);
    else clearActiveTenantCookie(res);
    logAudit({
      userId: user.id,
      userName: user.email,
      action: AUDIT_ACTIONS.LOGIN,
      entityType: 'auth',
      entityId: user.id,
      ip: req.ip,
    });
    res.json({ token, user });
  }),
);

// Google sign-in. Mirrors /microsoft, except the browser posts the
// authorization code instead of an id token — the exchange needs the client
// secret and so must happen here. Google sign-in only ever matches an existing
// account; it never provisions one (see authenticateGoogle).
router.post(
  '/google',
  validate(schemas.googleAuth),
  catchAsync(async (req, res) => {
    let result;
    try {
      result = await authenticateGoogle(req.body);
    } catch (err) {
      logAudit({ action: AUDIT_ACTIONS.LOGIN_FAILED, entityType: 'auth', ip: req.ip });
      throw err;
    }
    const { user, tenantId, slug } = result;
    const token = runWithTenant(tenantId, () =>
      issueSession(res, user, { userAgent: req.get('user-agent'), ip: req.ip }),
    ).accessToken;
    if (slug) setActiveTenantCookie(res, slug);
    else clearActiveTenantCookie(res);
    logAudit({
      userId: user.id,
      userName: user.email,
      action: AUDIT_ACTIONS.LOGIN,
      entityType: 'auth',
      entityId: user.id,
      ip: req.ip,
    });
    res.json({ token, user });
  }),
);

router.post(
  '/login',
  validate(schemas.login),
  catchAsync(async (req, res) => {
    let result;
    try {
      result = authenticateLocal(req.body.email, req.body.password);
    } catch (err) {
      logAudit({ userName: req.body.email, action: AUDIT_ACTIONS.LOGIN_FAILED, entityType: 'auth', ip: req.ip });
      throw err;
    }
    const { user, tenantId } = result;
    const token = runWithTenant(tenantId, () =>
      issueSession(res, user, { userAgent: req.get('user-agent'), ip: req.ip }),
    ).accessToken;
    const tenant = getTenantById(tenantId);
    // A workspace with a slug selects it; the legacy default tenant (no slug)
    // must clear any stale selection so the user lands on tenant 0, not a
    // previously-visited workspace.
    if (tenant?.slug) setActiveTenantCookie(res, tenant.slug);
    else clearActiveTenantCookie(res);
    logAudit({
      userId: user.id,
      userName: user.email,
      action: AUDIT_ACTIONS.LOGIN,
      entityType: 'auth',
      entityId: user.id,
      ip: req.ip,
    });
    res.json({ token, user });
  }),
);

router.get('/me', authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) throw new NotFoundError('User not found');
  res.json({ success: true, user: safeUser(user) });
});

router.put(
  '/me',
  authMiddleware,
  validate(schemas.updateMe),
  catchAsync(async (req, res) => {
    const {
      name,
      phone,
      language,
      default_currency,
      portal_currency,
      avatar_url,
      email_notifications,
      current_password,
      new_password,
    } = req.body;
    const updates = {};

    if (new_password) {
      if (!current_password) throw new BadRequestError('Current password required to set new password');
      const user = getUserPassword(req.user.id);
      if (!user || !bcrypt.compareSync(current_password, user.password)) {
        throw new BadRequestError('Current password is incorrect');
      }
      updates.password = new_password;
    }

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (language !== undefined) updates.language = language;
    if (default_currency !== undefined) updates.default_currency = default_currency;
    // '' clears the portal's currency override (back to the client's billing currency).
    if (portal_currency !== undefined) updates.portal_currency = portal_currency || null;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (email_notifications !== undefined) updates.email_notifications = email_notifications;

    const updated = updateUser(req.user.id, updates);
    if (!updated) throw new BadRequestError('No fields to update');
    res.json({ success: true, user: safeUser(updated) });
  }),
);

router.get('/users', authMiddleware, requireTier('admin'), (req, res) => {
  res.json(getAllUsers().map((u) => safeUser(u)));
});

router.post(
  '/users',
  authMiddleware,
  requireTier('admin'),
  validate(schemas.createUser),
  catchAsync(async (req, res) => {
    const user = createUser(req.body);
    res.status(201).json(safeUser(user));
  }),
);

router.put(
  '/users/:id',
  authMiddleware,
  requireTier('admin'),
  validate(schemas.updateUser),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const existing = getUserById(id);
    if (!existing) throw new NotFoundError('User not found');

    if (
      existing.user_tier === 'admin' &&
      existing.id !== req.user.id &&
      req.body.user_tier &&
      req.body.user_tier !== 'admin'
    ) {
      throw new ForbiddenError('Cannot demote another admin');
    }

    const updated = updateUser(id, req.body);
    res.json(safeUser(updated));
  }),
);

router.delete(
  '/users/:id',
  authMiddleware,
  requireTier('admin'),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    if (id === req.user.id) throw new BadRequestError('Cannot delete your own account');

    const existing = getUserById(id);
    if (!existing) throw new NotFoundError('User not found');
    if (existing.user_tier === 'admin') throw new ForbiddenError('Cannot delete another admin. Demote them first.');

    deleteUser(id);
    res.json({ success: true, message: 'User deleted' });
  }),
);

router.post(
  '/invite',
  authMiddleware,
  requireTier('admin'),
  validate(schemas.inviteUser),
  catchAsync(async (req, res) => {
    const result = inviteUser(req.body);

    const inviter = getUserById(req.user.id);
    const inviterName = inviter?.name || req.user.email;
    const inviteUrl = `${workspaceUrl(req)}/accept-invite?token=${result.token}`;

    sendEmail({
      to: result.email,
      subject: "You've been invited to Marvelops TravelPro",
      template: 'invite_user',
      templateData: { inviteUrl, inviterName },
    }).catch((err) => logger.warn({ err: err.message, email: result.email }, 'Failed to send invite email'));

    res.status(201).json(result);
  }),
);

router.post(
  '/accept-invite',
  validate(schemas.acceptInvite),
  catchAsync(async (req, res) => {
    const { user, tenantId } = acceptInvite(req.body);
    const token = runWithTenant(tenantId, () =>
      issueSession(res, user, { userAgent: req.get('user-agent'), ip: req.ip }),
    ).accessToken;
    const tenant = getTenantById(tenantId);
    if (tenant?.slug) setActiveTenantCookie(res, tenant.slug);
    else clearActiveTenantCookie(res);
    res.json({ token, user });
  }),
);

// Self-service password reset. Both endpoints are unauthenticated and public
// by necessity (there's no session yet), and respond identically whether or
// not the email is registered/eligible — see requestPasswordReset's doc
// comment — so this can't be used to enumerate which emails exist.
router.post(
  '/forgot-password',
  validate(schemas.forgotPassword),
  catchAsync(async (req, res) => {
    const result = requestPasswordReset(req.body.email);
    if (result) {
      const resetUrl = `${workspaceUrl(req)}/reset-password?token=${result.token}`;
      sendEmail({
        to: result.email,
        subject: 'Reset your Marvelops TravelPro password',
        template: 'password_reset',
        templateData: { name: result.name, resetUrl },
      }).catch((err) => logger.warn({ err: err.message }, 'Failed to send password reset email'));
    }
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  }),
);

router.post(
  '/reset-password',
  validate(schemas.resetPassword),
  catchAsync(async (req, res) => {
    resetPassword(req.body);
    res.json({ success: true });
  }),
);

// Refresh the short-lived access token using the rotating refresh token cookie.
// Returns a fresh access token (+ re-issued refresh/csrf cookies). On any
// problem the caller is left logged out (the old refresh token is revoked on
// rotation, so a replayed/leaked one fails here).
router.post(
  '/refresh',
  catchAsync(async (req, res) => {
    const raw = req.cookies && req.cookies.refresh_token;
    if (!raw) throw new UnauthorizedError('No refresh token');
    const session = rotateRefreshToken(raw, { userAgent: req.get('user-agent'), ip: req.ip });
    setAuthCookies(res, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      csrfToken: session.csrfToken,
    });
    res.json({ token: session.accessToken, user: session.user });
  }),
);

router.post(
  '/logout',
  catchAsync(async (req, res) => {
    // No authMiddleware: logout must work even when the short-lived access token
    // has already expired. Revoke the refresh token (if any) so it can't be
    // replayed, then clear all three auth cookies plus the workspace selector.
    const raw = req.cookies && req.cookies.refresh_token;
    if (raw) {
      try {
        revokeRefreshToken(raw);
      } catch {
        /* best-effort */
      }
    }
    res.clearCookie('token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('csrf_token', { path: '/' });
    clearActiveTenantCookie(res);
    res.json({ success: true, message: 'Logged out' });
  }),
);

// --- Client Portal access provisioning -------------------------------------
// Gated by `grant_client_portal` (not tier), so admins can delegate the
// ability to provision client logins to non-admin staff via custom permissions.

router.get(
  '/client-portal/:clientId',
  authMiddleware,
  requirePermission('grant_client_portal'),
  catchAsync(async (req, res) => {
    const { clientId } = req.params;
    const db = getDb();
    const client = getClientRow(db, clientId);
    if (!client) throw new NotFoundError('Client not found');

    const account = getClientAccountState(db, client.data.email, clientId);
    let company = null;
    if (client.data.company_id) {
      const cRow = db.prepare("SELECT * FROM entities WHERE type = 'Company' AND id = ?").get(client.data.company_id);
      if (cRow) company = { id: cRow.id, name: JSON.parse(cRow.data).name };
    }

    res.json({ portal_access: !!client.data.portal_access, account, company });
  }),
);

router.post(
  '/client-portal/grant',
  authMiddleware,
  requirePermission('grant_client_portal'),
  validate(schemas.clientPortalAction),
  catchAsync(async (req, res) => {
    const { clientId } = req.body;
    const db = getDb();
    const client = getClientRow(db, clientId);
    if (!client) throw new NotFoundError('Client not found');

    const email = client.data.email;
    if (!email) throw new BadRequestError('Client must have an email address to grant portal access');

    // 1-3 run atomically: account provisioning, Company creation, and the
    // client's portal_access flag must all land together or not at all.
    let tempPassword = null;
    let companyId = null;
    let companyCreated = false;
    const grant = db.transaction(() => {
      // 1. Find or create the client-tier login account.
      const existing = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(String(email).toLowerCase());
      if (existing) {
        if (existing.user_tier !== 'client') {
          throw new ConflictError('This email already belongs to a staff account; use a different contact email');
        }
        if (existing.client_id && existing.client_id !== clientId) {
          throw new ConflictError('This email is already linked to a different client');
        }
        updateUser(existing.id, { is_active: true, client_id: clientId });
      } else {
        tempPassword = generateTempPassword();
        createUser({
          email,
          password: tempPassword,
          name: client.data.name || String(email).split('@')[0],
          user_tier: 'client',
          client_id: clientId,
        });
      }

      // 2. Ensure a Company exists and is linked to the client.
      companyId = client.data.company_id;
      let companyRow = companyId
        ? db.prepare("SELECT * FROM entities WHERE type = 'Company' AND id = ?").get(companyId)
        : null;
      if (!companyRow && client.data.company) {
        companyRow = db
          .prepare("SELECT * FROM entities WHERE type = 'Company' AND LOWER(json_extract(data, '$.name')) = ?")
          .get(String(client.data.company).toLowerCase());
        if (companyRow) companyId = companyRow.id;
      }
      if (!companyRow) {
        companyId = uid();
        const companyData = {
          name: client.data.company || client.data.name || 'Company',
          status: 'active',
          email: client.data.email || '',
          phone: client.data.phone || '',
          address: client.data.address || '',
          city: client.data.city || '',
          country: client.data.country || '',
          invoice_address: client.data.invoice_address || '',
          tax_id: client.data.tax_id || '',
          website: client.data.website || '',
          created_by: req.user.id,
        };
        const now = new Date().toISOString();
        db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
          companyId,
          'Company',
          JSON.stringify(companyData),
          now,
          now,
        );
        upsertFtsInline(db, companyId, 'Company', companyData);
        companyCreated = true;
      }

      // 3. Mark the client as portal-enabled and link the company.
      const newClientData = { ...client.data, portal_access: true, company_id: companyId };
      if (!newClientData.company && client.data.name) newClientData.company = client.data.name;
      db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(
        JSON.stringify(newClientData),
        new Date().toISOString(),
        clientId,
      );
    });
    grant();

    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: AUDIT_ACTIONS.PORTAL_GRANT,
      entityType: 'Client',
      entityId: clientId,
      ip: req.ip,
    });

    res.json({
      success: true,
      portal_access: true,
      tempPassword,
      email,
      company: { id: companyId, created: companyCreated },
    });
  }),
);

router.post(
  '/client-portal/revoke',
  authMiddleware,
  requirePermission('grant_client_portal'),
  validate(schemas.clientPortalAction),
  catchAsync(async (req, res) => {
    const { clientId } = req.body;
    const db = getDb();
    const client = getClientRow(db, clientId);
    if (!client) throw new NotFoundError('Client not found');

    const email = client.data.email;
    if (email) {
      const existing = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(String(email).toLowerCase());
      if (existing && existing.user_tier === 'client') {
        updateUser(existing.id, { is_active: false });
      }
    }

    const newClientData = { ...client.data, portal_access: false };
    db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(
      JSON.stringify(newClientData),
      new Date().toISOString(),
      clientId,
    );

    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: AUDIT_ACTIONS.PORTAL_REVOKE,
      entityType: 'Client',
      entityId: clientId,
      ip: req.ip,
    });

    res.json({ success: true, portal_access: false });
  }),
);

// --- Supplier Portal access provisioning ------------------------------------
// Mirrors the Client Portal flow above, gated by `grant_supplier_portal`.
// Simpler than the client flow: a Supplier record already exists by the time
// staff grant portal access (created via SupplierDetails), so there's no
// analogous "auto-create the parent record" step.

router.get(
  '/supplier-portal/:supplierId',
  authMiddleware,
  requirePermission('grant_supplier_portal'),
  catchAsync(async (req, res) => {
    const { supplierId } = req.params;
    const db = getDb();
    const supplier = getSupplierRow(db, supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    const account = getSupplierAccountState(db, supplier.data.email, supplierId);
    res.json({ portal_access: !!supplier.data.portal_access, account });
  }),
);

router.post(
  '/supplier-portal/grant',
  authMiddleware,
  requirePermission('grant_supplier_portal'),
  validate(schemas.supplierPortalAction),
  catchAsync(async (req, res) => {
    const { supplierId } = req.body;
    const db = getDb();
    const supplier = getSupplierRow(db, supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    const email = supplier.data.email;
    if (!email) throw new BadRequestError('Supplier must have an email address to grant portal access');

    let tempPassword = null;
    const grant = db.transaction(() => {
      const existing = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(String(email).toLowerCase());
      if (existing) {
        if (existing.user_tier !== 'supplier') {
          throw new ConflictError('This email already belongs to a staff account; use a different contact email');
        }
        if (existing.linked_supplier_id && existing.linked_supplier_id !== supplierId) {
          throw new ConflictError('This email is already linked to a different supplier');
        }
        updateUser(existing.id, { is_active: true, linked_supplier_id: supplierId });
      } else {
        tempPassword = generateTempPassword();
        createUser({
          email,
          password: tempPassword,
          name: supplier.data.name || String(email).split('@')[0],
          user_tier: 'supplier',
          linked_supplier_id: supplierId,
        });
      }

      const newSupplierData = { ...supplier.data, portal_access: true };
      db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(
        JSON.stringify(newSupplierData),
        new Date().toISOString(),
        supplierId,
      );
    });
    grant();

    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: AUDIT_ACTIONS.PORTAL_GRANT,
      entityType: 'Supplier',
      entityId: supplierId,
      ip: req.ip,
    });

    res.json({ success: true, portal_access: true, tempPassword, email });
  }),
);

router.post(
  '/supplier-portal/revoke',
  authMiddleware,
  requirePermission('grant_supplier_portal'),
  validate(schemas.supplierPortalAction),
  catchAsync(async (req, res) => {
    const { supplierId } = req.body;
    const db = getDb();
    const supplier = getSupplierRow(db, supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    const email = supplier.data.email;
    const revoke = db.transaction(() => {
      if (email) {
        const existing = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(String(email).toLowerCase());
        if (existing && existing.user_tier === 'supplier') {
          updateUser(existing.id, { is_active: false });
        }
      }

      const newSupplierData = { ...supplier.data, portal_access: false };
      db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(
        JSON.stringify(newSupplierData),
        new Date().toISOString(),
        supplierId,
      );
    });
    revoke();

    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: AUDIT_ACTIONS.PORTAL_REVOKE,
      entityType: 'Supplier',
      entityId: supplierId,
      ip: req.ip,
    });

    res.json({ success: true, portal_access: false });
  }),
);

export default router;
