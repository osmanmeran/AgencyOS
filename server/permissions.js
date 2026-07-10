import { getDb } from './db.js';
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS, DEFAULT_TIER_PERMISSIONS } from '../shared/permissions.js';

export { PERMISSION_GROUPS, ALL_PERMISSION_KEYS, DEFAULT_TIER_PERMISSIONS };

/**
 * Reads the admin-configurable `AppSettings.tier_permissions` override (set
 * via the Permissions tab in AppSettings/UserManagement) directly from the
 * `entities` table, mirroring PermissionContext.jsx's `fetchTierPermissions`
 * on the frontend. Returns `null` if no override has ever been saved, so
 * callers fall back to {@link DEFAULT_TIER_PERMISSIONS}.
 */
function getTierPermissionsOverride() {
  try {
    const row = getDb().prepare("SELECT data FROM entities WHERE type = 'AppSettings' LIMIT 1").get();
    if (!row) return null;
    return JSON.parse(row.data).tier_permissions || null;
  } catch {
    return null;
  }
}

/**
 * A tier's effective permission list: the live override for that tier if an
 * admin has saved one, else the hardcoded default. Matches
 * PermissionContext.jsx's `effectiveTierPerms[tier] || DEFAULT_TIER_PERMISSIONS[tier]`.
 */
export function getEffectiveTierPermissions(tier) {
  const override = getTierPermissionsOverride();
  return (override && override[tier]) || DEFAULT_TIER_PERMISSIONS[tier] || [];
}

export function getUserPermissions(userTier, customPermissions) {
  const effectiveTier = userTier || 'agent';
  const defaults = getEffectiveTierPermissions(effectiveTier);
  const custom = Array.isArray(customPermissions) ? customPermissions : [];
  return [...new Set([...defaults, ...custom])];
}

export function hasPermission(userTier, customPermissions, permissionKey) {
  const perms = getUserPermissions(userTier, customPermissions);
  return perms.includes(permissionKey);
}
