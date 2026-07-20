import { getDb } from '../db.js';
import { listTenants } from './tenants.js';

// Platform (SaaS operator) admin. Per-tenant DB isolation means there is no
// single SQL view across workspaces, so cross-tenant stats are aggregated
// app-side by opening each tenant's own DB. If this ever gets heavy, revisit a
// denormalized metrics table — but one contained aggregation loop beats
// auditing every query for a missing tenant filter.

/**
 * Email allow-list of platform administrators, from `PLATFORM_ADMIN_EMAILS`
 * (comma-separated env var). Read at call time so tests can set the env.
 * @param {string} [email]
 * @returns {boolean}
 */
export function isPlatformAdmin(email) {
  if (!email) return false;
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(String(email).toLowerCase());
}

/**
 * List every workspace with aggregated counts from its own DB.
 * @param {{includeStats?: boolean}} [opts]
 * @returns {Array<object>}
 */
export function listWorkspaces({ includeStats = true } = {}) {
  return listTenants().map((t) => {
    const base = {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      azureTenantId: t.azure_tenant_id,
      createdDate: t.created_date,
    };
    if (!includeStats) return base;

    let userCount = 0;
    let entityCount = 0;
    try {
      const db = getDb(t.id);
      userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      entityCount = db.prepare('SELECT COUNT(*) AS c FROM entities').get().c;
    } catch {
      // Tenant DB may not exist yet (e.g. provisioned but never opened), or a
      // migration is mid-flight. Report zeros rather than failing the whole list.
    }
    return { ...base, userCount, entityCount };
  });
}

/** Aggregate totals across all workspaces. */
export function platformStats() {
  const workspaces = listWorkspaces({ includeStats: true });
  const byStatus = {};
  for (const w of workspaces) byStatus[w.status] = (byStatus[w.status] || 0) + 1;
  const totalUsers = workspaces.reduce((s, w) => s + (w.userCount || 0), 0);
  const totalEntities = workspaces.reduce((s, w) => s + (w.entityCount || 0), 0);
  return {
    workspaceCount: workspaces.length,
    totalUsers,
    totalEntities,
    byStatus,
  };
}
