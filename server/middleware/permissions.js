import { sendError } from './errors.js';
import { hasPermission, ALL_PERMISSION_KEYS } from '../permissions.js';

const TIER_HIERARCHY = { admin: 100, manager: 50, accounting: 40, agent: 10 };

export function requireTier(minTier) {
  return (req, res, next) => {
    const userTier = req.user?.user_tier;
    if (!userTier) {
      return sendError(res, 403, 'NO_TIER', 'No user tier assigned');
    }
    const userLevel = TIER_HIERARCHY[userTier] || 0;
    const requiredLevel = TIER_HIERARCHY[minTier] || 0;
    if (userLevel < requiredLevel) {
      return sendError(res, 403, 'INSUFFICIENT_TIER', `Insufficient permissions. Requires ${minTier} tier.`);
    }
    next();
  };
}

export function requirePermission(...permissionKeys) {
  return (req, res, next) => {
    const userTier = req.user?.user_tier;
    const customPermissions = req.user?.custom_permissions || [];
    const userPermissions = Array.isArray(customPermissions) ? customPermissions : [];

    for (const key of permissionKeys) {
      if (!ALL_PERMISSION_KEYS.includes(key)) {
        return sendError(res, 500, 'INTERNAL_ERROR', `Unknown permission key: ${key}`);
      }
      if (!hasPermission(userTier, userPermissions, key)) {
        return sendError(res, 403, 'FORBIDDEN', `Missing required permission: ${key}`);
      }
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.user?.user_tier !== 'admin' && req.user?.role !== 'admin') {
    return sendError(res, 403, 'FORBIDDEN', 'Admin access required');
  }
  next();
}
