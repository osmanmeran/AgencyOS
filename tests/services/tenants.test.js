import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPlatformDb, getDb, getDbPath, getTenantsDir, closeDb } from '../../server/db.js';
import {
  createTenant,
  getTenantById,
  getTenantBySlug,
  listTenants,
  allTenantIds,
  forEachTenant,
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

  it('allTenantIds puts the legacy default tenant first', () => {
    const t = createTenant({ slug: 'ids-check', name: 'Ids' });
    expect(allTenantIds()[0]).toBe('0');
    expect(allTenantIds()).toContain(t.id);
  });

  it('forEachTenant runs the job inside each tenant DB context', async () => {
    const t = createTenant({ slug: 'each-ctx', name: 'Each' });
    const visited = [];
    await forEachTenant((tenantId) => {
      // getDb() with no argument must resolve to the tenant being visited.
      visited.push({ tenantId, dbFile: getDb().name });
    });
    expect(visited.map((v) => v.tenantId)).toEqual(['0', t.id]);
    expect(visited[1].dbFile).toContain(t.id);
    expect(visited[0].dbFile).not.toBe(visited[1].dbFile);
  });

  it('forEachTenant keeps going when one tenant job throws', async () => {
    createTenant({ slug: 'boom', name: 'Boom' });
    const seen = [];
    await forEachTenant((tenantId) => {
      if (tenantId === '0') throw new Error('tenant zero exploded');
      seen.push(tenantId);
    });
    expect(seen).toHaveLength(1);
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
