import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPlatformDb, getDb, getDbPath, getTenantsDir, closeDb } from '../../server/db.js';
import {
  createTenant,
  getTenantById,
  getTenantBySlug,
  listTenants,
  isReservedSlug,
  isValidSlug,
  TENANT_STATUS,
} from '../../server/services/tenants.js';
import fs from 'fs';

describe('tenant registry (platform.db)', () => {
  beforeEach(() => {
    getPlatformDb().exec('DELETE FROM tenants');
  });

  it('flags reserved slugs', () => {
    expect(isReservedSlug('admin')).toBe(true);
    expect(isReservedSlug('api')).toBe(true);
    expect(isValidSlug('admin')).toBe(false);
    expect(isValidSlug('my-agency')).toBe(true);
  });

  it('creates a tenant and looks it up by slug (case-insensitive) and id', () => {
    const created = createTenant({
      slug: 'Acme',
      name: 'Acme Travel',
      status: TENANT_STATUS.ACTIVE,
    });
    expect(created.slug).toBe('acme');
    expect(created.id).toMatch(/^[a-f0-9]{16}$/);
    expect(getTenantBySlug('ACME').id).toBe(created.id);
    expect(getTenantById(created.id).name).toBe('Acme Travel');
  });

  it('defaults status to trial', () => {
    const t = createTenant({ slug: 'globex', name: 'Globex' });
    expect(t.status).toBe(TENANT_STATUS.TRIAL);
  });

  it('rejects duplicate slugs', () => {
    createTenant({ slug: 'dup', name: 'First' });
    expect(() => createTenant({ slug: 'dup', name: 'Second' })).toThrow(/already taken/);
  });

  it('rejects invalid slugs (spaces, dots, underscores, leading/trailing dash)', () => {
    for (const bad of ['bad slug', 'bad.slug', 'has_under', '-leading', 'trailing-']) {
      expect(() => createTenant({ slug: bad, name: 'x' })).toThrow();
    }
    expect(isValidSlug('valid-1')).toBe(true);
  });

  it('lists tenants', () => {
    createTenant({ slug: 'a', name: 'A' });
    createTenant({ slug: 'b', name: 'B' });
    expect(listTenants()).toHaveLength(2);
  });
});

describe('getDb(tenantId) isolation', () => {
  afterEach(() => {
    closeDb();
  });

  it('keeps the default tenant at the legacy path and isolates other tenants', () => {
    const def = getDb();
    const other = getDb('tenant-xyz');
    expect(def).not.toBe(other);
    // Default/legacy tenant maps to tenant "0" and stays at DATA_DIR/marvelops.db.
    expect(getDbPath()).toBe(getDbPath('0'));
    expect(getDbPath()).not.toBe(getDbPath('tenant-xyz'));
    // Other tenants live in a nested tenants/ directory as separate files.
    expect(getDbPath('tenant-xyz')).toContain('tenants');
    expect(getTenantsDir()).toContain('tenants');
    expect(fs.existsSync(getDbPath('tenant-xyz'))).toBe(true);
  });
});
