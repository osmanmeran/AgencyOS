import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { getAuditLogs, logAudit, AUDIT_ACTIONS } from '../services/audit.js';

const router = Router();

router.use(authMiddleware);

router.get('/logs', catchAsync(async (req, res) => {
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
    userId: req.user.id, userName: req.user.email, action: 'audit_view',
    ip: req.ip,
  });

  res.json({ logs });
}));

export default router;
