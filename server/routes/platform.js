import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, ForbiddenError } from '../middleware/errors.js';
import { isPlatformAdmin, listWorkspaces, platformStats } from '../services/platform.js';
import { logAudit, AUDIT_ACTIONS } from '../services/audit.js';

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
    res.json(platformStats());
  }),
);

export default router;
