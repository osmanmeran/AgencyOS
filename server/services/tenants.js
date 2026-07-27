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

/** Trial length for a self-serve workspace, in days (`TRIAL_DAYS`, default 14). */
export function trialDays() {
  const parsed = parseInt(process.env.TRIAL_DAYS || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
}

function trialDeadline(days = trialDays()) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
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
  // Only a trial workspace gets a deadline; an operator-created 'active' one
  // has none (NULL = no expiry).
  const trialEndsAt = status === TENANT_STATUS.TRIAL ? trialDeadline() : null;
  db.prepare(
    `INSERT INTO tenants (id, slug, name, status, azure_tenant_id, trial_ends_at, created_date)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(id, normalized, name, status, azureTenantId, trialEndsAt);
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
    .prepare(
      'SELECT id, slug, name, status, azure_tenant_id, trial_ends_at, created_date FROM tenants ORDER BY created_date ASC',
    )
    .all();
}

/**
 * Whether a workspace may currently be used, and why not if it can't.
 *
 * The legacy/default tenant has no registry row and is always allowed — an
 * existing single-tenant deployment must never be locked out by this check.
 * @param {object|null} tenant Registry row, or null/undefined for the default tenant.
 * @returns {{allowed: boolean, code?: string, message?: string}}
 */
export function tenantAccessState(tenant) {
  if (!tenant) return { allowed: true };

  if (tenant.status === TENANT_STATUS.SUSPENDED) {
    return {
      allowed: false,
      code: 'WORKSPACE_SUSPENDED',
      message: 'This workspace is suspended. Please contact support.',
    };
  }

  if (tenant.status === TENANT_STATUS.TRIAL && tenant.trial_ends_at) {
    const endsAt = Date.parse(tenant.trial_ends_at);
    // An unparseable deadline must not lock a workspace out — treat it as unset.
    if (Number.isFinite(endsAt) && endsAt <= Date.now()) {
      return {
        allowed: false,
        code: 'TRIAL_EXPIRED',
        message: 'This workspace’s trial has ended. Please upgrade to continue.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Set a workspace's lifecycle status (platform-operator action).
 * @returns {object|null} The updated row, or null if the workspace doesn't exist.
 */
export function setTenantStatus(id, status) {
  if (!Object.values(TENANT_STATUS).includes(status)) {
    throw new BadRequestError(`Invalid workspace status: "${status}"`);
  }
  const db = getPlatformDb();
  if (!getTenantById(id)) return null;
  // Activating clears the trial deadline — a paying workspace has no expiry.
  if (status === TENANT_STATUS.ACTIVE) {
    db.prepare('UPDATE tenants SET status = ?, trial_ends_at = NULL WHERE id = ?').run(status, id);
  } else {
    db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run(status, id);
  }
  return getTenantById(id);
}

/**
 * Push a workspace's trial deadline out by `days` from now, returning it to
 * `trial` status if it had already lapsed into suspension.
 * @returns {object|null} The updated row, or null if the workspace doesn't exist.
 */
export function extendTrial(id, days = trialDays()) {
  const parsed = Number(days);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestError('days must be a positive number');
  }
  const db = getPlatformDb();
  if (!getTenantById(id)) return null;
  db.prepare('UPDATE tenants SET status = ?, trial_ends_at = ? WHERE id = ?').run(
    TENANT_STATUS.TRIAL,
    trialDeadline(parsed),
    id,
  );
  return getTenantById(id);
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
