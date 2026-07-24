import crypto from 'crypto';
import { getPlatformDb, DEFAULT_TENANT_ID, runWithTenant } from '../db.js';
import { BadRequestError } from '../middleware/errors.js';
import logger from '../lib/logger.js';

export const TENANT_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
};

// Reserved host labels that must never be usable as a tenant subdomain.
const RESERVED_SLUGS = new Set(['www', 'api', 'app', 'admin', 'platform', 'auth', 'mail', 'ftp', 'status', 'cdn']);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export function isReservedSlug(slug) {
  return RESERVED_SLUGS.has(String(slug).toLowerCase());
}

export function isValidSlug(slug) {
  return SLUG_RE.test(String(slug).toLowerCase()) && !isReservedSlug(slug);
}

export function createTenant({ slug, name, status = TENANT_STATUS.TRIAL, azureTenantId = null }) {
  const db = getPlatformDb();
  const normalized = String(slug).toLowerCase();
  if (!isValidSlug(normalized)) {
    throw new Error(`Invalid or reserved tenant slug: "${slug}"`);
  }
  const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(normalized);
  if (existing) {
    throw new Error(`Tenant slug "${slug}" is already taken`);
  }
  const id = crypto.randomBytes(8).toString('hex');
  db.prepare(
    `INSERT INTO tenants (id, slug, name, status, azure_tenant_id, created_date)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  ).run(id, normalized, name, status, azureTenantId);
  return getTenantById(id);
}

export function getTenantById(id) {
  return getPlatformDb().prepare('SELECT * FROM tenants WHERE id = ?').get(id);
}

export function getTenantBySlug(slug) {
  return getPlatformDb().prepare('SELECT * FROM tenants WHERE slug = ?').get(String(slug).toLowerCase());
}

export function listTenants() {
  return getPlatformDb()
    .prepare('SELECT id, slug, name, status, azure_tenant_id, created_date FROM tenants ORDER BY created_date ASC')
    .all();
}

/** @returns {string[]} Every tenant id, the legacy/default tenant first. */
export function allTenantIds() {
  return [DEFAULT_TENANT_ID, ...listTenants().map((t) => t.id)];
}

/**
 * Run `fn(tenantId)` once per tenant — the legacy/default tenant first — inside
 * that tenant's DB context, so background jobs (reminders, scheduled reports,
 * rate refreshes) cover every workspace instead of only the legacy tenant. A
 * failure in one tenant is logged and does not stop the remaining tenants.
 */
export async function forEachTenant(fn, { label = 'per-tenant job' } = {}) {
  for (const tenantId of allTenantIds()) {
    try {
      await runWithTenant(tenantId, fn, tenantId);
    } catch (err) {
      logger.error({ err: err.message || err, tenantId, label }, 'Per-tenant job failed');
    }
  }
}

// Azure AD tenant ids are UUIDs (8-4-4-4-12 hex). Validate loosely so a typo
// doesn't slip into the platform registry and silently break SSO login.
const AZURE_TENANT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Update mutable fields of a workspace. Used by the self-service control plane
 * (Phase 4). `name` and `azureTenantId` are the only editable columns; `slug`
 * and `status` are intentionally immutable (the slug is the workspace address).
 * @param {string} id
 * @param {{name?: string, azureTenantId?: string|null}} changes
 * @returns {object|null} the updated tenant row, or null if it doesn't exist
 */
export function updateTenant(id, { name, azureTenantId } = {}) {
  const db = getPlatformDb();
  const existing = getTenantById(id);
  if (!existing) return null;

  const sets = [];
  const values = [];

  if (name !== undefined && name !== null) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new BadRequestError('Workspace name cannot be empty');
    sets.push('name = ?');
    values.push(trimmed.slice(0, 120));
  }

  if (azureTenantId !== undefined && azureTenantId !== null) {
    const trimmed = String(azureTenantId).trim();
    if (trimmed && !AZURE_TENANT_RE.test(trimmed)) {
      throw new BadRequestError('azureTenantId must be a valid Azure tenant id (UUID)');
    }
    sets.push('azure_tenant_id = ?');
    values.push(trimmed || null);
  }

  if (sets.length === 0) return existing;

  db.prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  return getTenantById(id);
}
