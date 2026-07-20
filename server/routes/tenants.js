import { Router } from 'express';
import { getDb, getTenantId, uid, runWithTenant } from '../db.js';
import { validate, schemas } from '../middleware/validate.js';
import { catchAsync, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../middleware/errors.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  createTenant,
  getTenantById,
  getTenantBySlug,
  isValidSlug,
  updateTenant,
  TENANT_STATUS,
} from '../services/tenants.js';
import { createUser, safeUser, issueSession } from '../services/auth.js';
import { verifyMicrosoftIdToken } from '../services/microsoft.js';
import { logAudit, AUDIT_ACTIONS } from '../services/audit.js';

const router = Router();

// Self-serve workspace provisioning (Phase 3). Public + unauthenticated: there
// is no session yet to scope the request to, so this router deliberately runs
// OUTSIDE authMiddleware. See SAAS_PROJECT.md.
//
// Gated by ALLOW_PUBLIC_SIGNUP so an existing single-tenant deployment isn't
// silently turned into an open registration system. The front-end signup page
// only renders when this is enabled.
function requireSignupEnabled(req, res, next) {
  if (process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
    return next(new ForbiddenError('Self-serve signup is disabled.', 'SIGNUP_DISABLED'));
  }
  next();
}

// Lightweight availability check used by the signup form as the user types.
router.get(
  '/check-slug',
  catchAsync(async (req, res) => {
    const slug = String(req.query.slug || '').toLowerCase();
    if (!isValidSlug(slug)) {
      return res.json({ available: false, reason: 'invalid' });
    }
    if (getTenantBySlug(slug)) {
      return res.json({ available: false, reason: 'taken' });
    }
    return res.json({ available: true });
  }),
);

router.post(
  '/signup',
  requireSignupEnabled,
  validate(schemas.signup),
  catchAsync(async (req, res) => {
    const { agencyName, slug, adminEmail, adminPassword, adminName, idToken } = req.body;
    const normalizedSlug = slug.toLowerCase();

    if (!isValidSlug(normalizedSlug)) {
      throw new BadRequestError(`"${slug}" is not a valid workspace address.`, 'INVALID_SLUG');
    }
    if (getTenantBySlug(normalizedSlug)) {
      throw new ConflictError('That workspace address is already taken.', 'SLUG_TAKEN');
    }

    // 1. Register the workspace in the central tenant registry. For SSO signup
    //    the new workspace's Azure tenant is derived from the token itself.
    let tenant;
    let user;
    let accessToken;

    if (idToken) {
      const claims = await verifyMicrosoftIdToken(idToken);
      tenant = createTenant({
        slug: normalizedSlug,
        name: agencyName,
        status: TENANT_STATUS.TRIAL,
        azureTenantId: claims.tid,
      });

      const result = runWithTenant(tenant.id, () => {
        const id = uid();
        const now = new Date().toISOString();
        // SSO admin: no local password (authenticateLocal rejects any account
        // with a microsoft_id), linked to the Microsoft account.
        getDb()
          .prepare(
            `INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, departments, is_active, microsoft_id, created_date, updated_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(id, claims.email, '', claims.name, 'admin', 'admin', 'en', '[]', '[]', 1, claims.microsoftId, now, now);
        const admin = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);

        logAudit({
          userName: claims.email,
          action: AUDIT_ACTIONS.TENANT_CREATE,
          entityType: 'tenant',
          entityId: tenant.id,
          changes: {
            slug: tenant.slug,
            name: tenant.name,
            admin_email: claims.email,
            admin_sso: true,
            status: tenant.status,
          },
          ip: req.ip,
        });

        const session = issueSession(res, safeUser(admin), {
          userAgent: req.get('user-agent'),
          ip: req.ip,
        });
        return { admin, accessToken: session.accessToken };
      });
      user = result.admin;
      accessToken = result.accessToken;
    } else {
      tenant = createTenant({
        slug: normalizedSlug,
        name: agencyName,
        status: TENANT_STATUS.TRIAL,
      });

      const result = runWithTenant(tenant.id, () => {
        const admin = createUser({
          email: adminEmail,
          password: adminPassword,
          name: adminName || adminEmail.split('@')[0],
          user_tier: 'admin',
        });

        logAudit({
          userName: adminEmail,
          action: AUDIT_ACTIONS.TENANT_CREATE,
          entityType: 'tenant',
          entityId: tenant.id,
          changes: { slug: tenant.slug, name: tenant.name, admin_email: adminEmail, status: tenant.status },
          ip: req.ip,
        });

        const session = issueSession(res, safeUser(admin), {
          userAgent: req.get('user-agent'),
          ip: req.ip,
        });
        return { admin, accessToken: session.accessToken };
      });
      user = result.admin;
      accessToken = result.accessToken;
    }

    // 3. Return the session + where to land (the new workspace subdomain).
    const rootDomain = process.env.APP_ROOT_DOMAIN;
    const workspaceUrl = rootDomain ? `https://${tenant.slug}.${rootDomain}` : '/';

    res.status(201).json({
      token: accessToken,
      user: safeUser(user),
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status },
      workspaceUrl,
    });
  }),
);

// ── Authenticated workspace self-service (Phase 4 — control plane) ──
// Scoped to the workspace resolved from the Host header (tenantMiddleware).
// Any authenticated member may read; only an admin may update.
// On the apex (no subdomain) `req.tenant`/`req.tenantId` are null, so the
// effective tenant is read from the request scope (AsyncLocalStorage) instead.
function currentTenantId(req) {
  return req.tenant?.id ?? req.tenantId ?? getTenantId();
}

router.get(
  '/me',
  authMiddleware,
  catchAsync(async (req, res) => {
    const tenant = req.tenant || getTenantById(currentTenantId(req));
    if (!tenant) throw new NotFoundError('Workspace not found');
    res.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      azureTenantId: tenant.azure_tenant_id,
      createdDate: tenant.created_date,
    });
  }),
);

router.patch(
  '/me',
  authMiddleware,
  validate(schemas.updateTenant),
  catchAsync(async (req, res) => {
    if (req.user.user_tier !== 'admin') {
      throw new ForbiddenError('Only a workspace admin can update workspace settings.', 'ADMIN_REQUIRED');
    }
    const updated = updateTenant(currentTenantId(req), req.body);
    if (!updated) throw new NotFoundError('Workspace not found');
    logAudit({
      userName: req.user.email,
      action: AUDIT_ACTIONS.TENANT_UPDATE,
      entityType: 'tenant',
      entityId: updated.id,
      changes: req.body,
      ip: req.ip,
    });
    res.json({
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      status: updated.status,
      azureTenantId: updated.azure_tenant_id,
      createdDate: updated.created_date,
    });
  }),
);

export default router;
