import crypto from 'crypto';
import { getPlatformDb } from '../db.js';

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
