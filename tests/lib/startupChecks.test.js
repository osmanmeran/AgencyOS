import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getPlatformDb, getDataDir, getTenantsDir, DEFAULT_TENANT_ID, getDb } from '../../server/db.js';
import { checkTenantZeroRegistered } from '../../server/lib/startupChecks.js';

// Guards the silent state that took production down: a healthy tenant-zero
// database on disk with no matching row in the platform registry. Nothing
// surfaces it until a user tries to log in and authenticateMicrosoft throws
// "Workspace not found." — so the check exists to turn a lockout into a log
// line at boot.

// Force the database into existence, so the check is exercised against a real
// on-disk file rather than the fresh-install path.
getDb();

const platformDb = getPlatformDb();

function clearRegistry() {
  platformDb.prepare('DELETE FROM tenants WHERE id = ?').run(DEFAULT_TENANT_ID);
}

function registerTenantZero() {
  platformDb
    .prepare(
      `INSERT INTO tenants (id, slug, name, status, azure_tenant_id, created_date)
       VALUES (?, 'marveltour', 'Marvel Tour', 'active', NULL, datetime('now'))`,
    )
    .run(DEFAULT_TENANT_ID);
}

describe('checkTenantZeroRegistered', () => {
  beforeEach(clearRegistry);
  afterEach(clearRegistry);

  it('reports a failure when the database exists but the registry row does not', () => {
    const result = checkTenantZeroRegistered();

    expect(result.ok).toBe(false);
    // The path must point at whichever location tenant zero actually resolves
    // to, so the operator can confirm the right database before acting.
    expect(fs.existsSync(result.dbPath)).toBe(true);
    const adopted = path.join(getTenantsDir(), String(DEFAULT_TENANT_ID), 'marvelops.db');
    const legacy = path.join(getDataDir(), 'marvelops.db');
    expect([adopted, legacy]).toContain(result.dbPath);
  });

  it('passes once tenant zero is registered', () => {
    registerTenantZero();

    expect(checkTenantZeroRegistered()).toEqual({ ok: true });
  });

  it('never throws, so a failing check cannot stop the server booting', () => {
    expect(() => checkTenantZeroRegistered()).not.toThrow();
    registerTenantZero();
    expect(() => checkTenantZeroRegistered()).not.toThrow();
  });
});
