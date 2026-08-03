import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { catchAsync } from '../middleware/errors.js';
import { getAuditLogs, logAudit } from '../services/audit.js';

const router = Router();

// Audit logs expose staff emails, entity ids, and request IPs across every
// tenant boundary, so they are admin-only (matching the admin-only Audit
// Trail page in the UI).
router.use(authMiddleware, requireAdmin);

router.get(
  '/logs',
  catchAsync(async (req, res) => {
    const { entity_type, entity_id, user_id, action, limit, offset } = req.query;
    const logs = getAuditLogs({
      entityType: entity_type,
      entityId: entity_id,
      userId: user_id,
      action,
      limit: Math.min(parseInt(limit) || 100, 500),
      offset: parseInt(offset) || 0,
    });

    // Also log this audit view for admin tracking
    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: 'audit_view',
      ip: req.ip,
    });

    res.json({ logs });
  }),
);

export default router;
