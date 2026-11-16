import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, ForbiddenError, NotFoundError } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { isPlatformAdmin, listWorkspaces, platformStats } from '../services/platform.js';
import { setTenantStatus, extendTrial, trialDays, updateTenant, deleteTenant } from '../services/tenants.js';
import { backupHealth } from '../services/backupRuns.js';
import { logAudit, AUDIT_ACTIONS } from '../services/audit.js';
import { getTenantDbStats } from '../db.js';

const router = Router();

// Platform (SaaS operator) admin. Gated by the PLATFORM_ADMIN_EMAILS allow-list
// — distinct from per-workspace 'admin' tier, which has no cross-tenant access.
function requirePlatformAdmin(req, res, next) {
  if (!isPlatformAdmin(req.user?.email)) {
    return next(new ForbiddenError('Platform admin access required.', 'PLATFORM_ADMIN_REQUIRED'));
  }
  next();
}

router.use(authMiddleware, requirePlatformAdmin);

router.get(
  '/workspaces',
  catchAsync(async (req, res) => {
    logAudit({
      userName: req.user.email,
      action: AUDIT_ACTIONS.PLATFORM_LIST_WORKSPACES,
      entityType: 'platform',
      ip: req.ip,
    });
    res.json({ workspaces: listWorkspaces() });
  }),
);

router.get(
  '/stats',
  catchAsync(async (req, res) => {
    // Backup health rides along with stats so the dashboard surfaces a silent
    // scheduler — the failure mode a per-run alert can't catch, because a job
    // that never runs never sends anything.
    res.json({ ...platformStats(), backups: backupHealth(), connectionPool: getTenantDbStats() });
  }),
);

// Workspace lifecycle. Without these the status column would be enforced but
// unsettable — suspending or reinstating an agency would mean hand-editing
// platform.db on the server.
router.patch(
  '/workspaces/:id/status',
  validate(schemas.setWorkspaceStatus),
  catchAsync(async (req, res) => {
    const updated = setTenantStatus(req.params.id, req.body.status);
    if (!updated) throw new NotFoundError('Workspace not found');
    logAudit({
      userName: req.user.email,
      action: AUDIT_ACTIONS.PLATFORM_SET_STATUS,
      entityType: 'platform',
      entityId: updated.id,
      changes: { slug: updated.slug, status: updated.status },
      ip: req.ip,
    });
    res.json({ workspace: serializeWorkspace(updated) });
  }),
);

router.post(
  '/workspaces/:id/extend-trial',
  validate(schemas.extendTrial),
  catchAsync(async (req, res) => {
    const days = req.body.days ?? trialDays();
    const updated = extendTrial(req.params.id, days);
    if (!updated) throw new NotFoundError('Workspace not found');
    logAudit({
      userName: req.user.email,
      action: AUDIT_ACTIONS.PLATFORM_EXTEND_TRIAL,
      entityType: 'platform',
      entityId: updated.id,
      changes: { slug: updated.slug, days, trialEndsAt: updated.trial_ends_at },
      ip: req.ip,
    });
    res.json({ workspace: serializeWorkspace(updated) });
  }),
);

router.patch(
  '/workspaces/:id',
  validate(schemas.updateTenant),
  catchAsync(async (req, res) => {
    const updated = updateTenant(req.params.id, req.body);
    if (!updated) throw new NotFoundError('Workspace not found');
    logAudit({
      userName: req.user.email,
      action: AUDIT_ACTIONS.TENANT_UPDATE,
      entityType: 'platform',
      entityId: updated.id,
      changes: req.body,
      ip: req.ip,
    });
    res.json({ workspace: serializeWorkspace(updated) });
  }),
);

// Irreversible. deleteTenant() enforces the guardrails (suspended first, exact
// slug confirmation, never the primary workspace) and takes a final snapshot —
// kept outside the directory being removed — before deleting anything.
router.delete(
  '/workspaces/:id',
  validate(schemas.deleteWorkspace),
  catchAsync(async (req, res) => {
    const result = await deleteTenant(req.params.id, { confirmSlug: req.body.confirmSlug });
    if (!result) throw new NotFoundError('Workspace not found');
    logAudit({
      userName: req.user.email,
      action: AUDIT_ACTIONS.PLATFORM_DELETE_WORKSPACE,
      entityType: 'platform',
      entityId: result.tenant.id,
      changes: {
        slug: result.tenant.slug,
        name: result.tenant.name,
        snapshot: result.snapshot,
        offsiteKey: result.offsiteKey,
      },
      ip: req.ip,
    });
    res.json({
      deleted: { id: result.tenant.id, slug: result.tenant.slug, name: result.tenant.name },
      snapshot: result.snapshot,
      offsiteKey: result.offsiteKey,
    });
  }),
);

function serializeWorkspace(t) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    trialEndsAt: t.trial_ends_at || null,
    createdDate: t.created_date,
  };
}

export default router;
