import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPlatformDb } from '../../server/db.js';
import { createTenant } from '../../server/services/tenants.js';

// One workspace failing must not abort the pass: the remaining workspaces still
// get backed up, and the failure is recorded and alerted rather than swallowed.
const alerts = [];
vi.mock('../../server/services/backupRuns.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    alertOnFailure: vi.fn(async (run) => {
      alerts.push(run);
      return true;
    }),
  };
});

// Fail the backup of one specific database, leaving the rest working.
let failForPath = null;
vi.mock('../../server/services/backup.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createBackupAsync: vi.fn(async (db, dataDir, label) => {
      if (failForPath && db.name === failForPath) throw new Error('simulated disk failure');
      return actual.createBackupAsync(db, dataDir, label);
    }),
  };
});

const { runBackupPass } = await import('../../server/services/backupScheduler.js');
const { lastBackupRun } = await import('../../server/services/backupRuns.js');
const { getDb, getDbPath } = await import('../../server/db.js');

beforeEach(() => {
  getPlatformDb().exec('DELETE FROM backup_runs');
  alerts.length = 0;
  failForPath = null;
});

describe('runBackupPass', () => {
  it('backs up the primary workspace and the platform registry', async () => {
    const run = await runBackupPass();
    expect(run.failed).toBe(0);
    expect(run.ok).toBe(1);

    const scopes = lastBackupRun().detail.map((d) => d.scope);
    expect(scopes).toContain('tenants/0');
    expect(scopes).toContain('platform');
  });

  it('covers every registered workspace', async () => {
    const tenant = createTenant({ slug: 'backed-up-ws', name: 'Backed Up WS' });
    getDb(tenant.id); // provision its database

    await runBackupPass();
    const detail = lastBackupRun().detail;
    const entry = detail.find((d) => d.scope === `tenants/${tenant.id}`);
    expect(entry).toBeTruthy();
    expect(entry.ok).toBe(true);
    expect(entry.label).toContain('Backed Up WS');

    getPlatformDb().prepare('DELETE FROM tenants WHERE id = ?').run(tenant.id);
  });

  it('records the failure, keeps going, and alerts', async () => {
    const tenant = createTenant({ slug: 'doomed-backup-ws', name: 'Doomed WS' });
    getDb(tenant.id);
    failForPath = getDbPath(tenant.id);

    const run = await runBackupPass();

    // The pass completed and reported the failure...
    expect(run.failed).toBe(1);
    expect(run.ok).toBe(0);
    const detail = lastBackupRun().detail;
    const failure = detail.find((d) => !d.ok);
    expect(failure.scope).toBe(`tenants/${tenant.id}`);
    expect(failure.error).toMatch(/simulated disk failure/);

    // ...while every other target still succeeded.
    expect(detail.find((d) => d.scope === 'tenants/0').ok).toBe(true);
    expect(detail.find((d) => d.scope === 'platform').ok).toBe(true);

    // ...and the operator was told.
    expect(alerts).toHaveLength(1);
    expect(alerts[0].failed).toBe(1);

    getPlatformDb().prepare('DELETE FROM tenants WHERE id = ?').run(tenant.id);
  });

  it('does not alert when everything succeeds', async () => {
    await runBackupPass();
    expect(alerts).toHaveLength(0);
  });
});
