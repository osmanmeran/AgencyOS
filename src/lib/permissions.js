// Permission catalog, grouped by category. Re-exported from shared/permissions.js
// (the single source of truth, also used by server/permissions.js) — see
// tests/lib/parity.test.js, which guards against this drifting back into a
// hand-synced copy.
// Used by PermissionContext, AppSettings' Permissions tab, and UserManagement

export { PERMISSION_GROUPS, ALL_PERMISSION_KEYS, DEFAULT_TIER_PERMISSIONS } from '../../shared/permissions.js';
import { PERMISSION_GROUPS } from '../../shared/permissions.js';

// Build a lookup from key -> { label, description }
export const PERMISSION_MAP = {};
for (const group of PERMISSION_GROUPS) {
  for (const perm of group.permissions) {
    PERMISSION_MAP[perm.key] = perm;
  }
}
