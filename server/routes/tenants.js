import { Router } from 'express';
import { runWithTenant } from '../db.js';
import { validate, schemas } from '../middleware/validate.js';
import { catchAsync, BadRequestError, ConflictError, ForbiddenError } from '../middleware/errors.js';
import { createTenant, getTenantBySlug, isValidSlug, TENANT_STATUS } from '../services/tenants.js';
import { createUser, safeUser, issueSession } from '../services/auth.js';
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
    const { agencyName, slug, adminEmail, adminPassword, adminName } = req.body;
    const normalizedSlug = slug.toLowerCase();

    if (!isValidSlug(normalizedSlug)) {
      throw new BadRequestError(`"${slug}" is not a valid workspace address.`, 'INVALID_SLUG');
    }
    if (getTenantBySlug(normalizedSlug)) {
      throw new ConflictError('That workspace address is already taken.', 'SLUG_TAKEN');
    }

    // 1. Register the workspace in the central tenant registry.
    const tenant = createTenant({
      slug: normalizedSlug,
      name: agencyName,
      status: TENANT_STATUS.TRIAL,
    });

    // 2. Provision the tenant's isolated DB and create its first admin. All DB
    //    work runs inside the new tenant's context so getDb() (in createUser /
    //    issueSession / logAudit) targets the right file and the issued JWT
    //    carries the correct tenant_id.
    const { user, accessToken } = runWithTenant(tenant.id, () => {
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
      return { user: admin, accessToken: session.accessToken };
    });

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

export default router;
