import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import Database from 'better-sqlite3';
import { getDataDir, getDb, getPlatformDb, closeDb, closeTenantDb } from '../../server/db.js';
import { createTenant } from '../../server/services/tenants.js';

// server/migrations/cli.js's `bootstrap` and `fleet:status` commands operate
// across every tenant database in one run. Before this suite, one bad tenant
// database (corrupt file, a migration that throws) would throw out of the
// for-loop and silently abort every tenant after it — alphabetically, not by
// any meaningful priority. These tests spawn the real CLI as a subprocess
// (it calls process.exit() on every branch, so it can't be imported and
// asserted on in-process) against a scratch DATA_DIR seeded with a mix of
// healthy and corrupt tenant databases.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, '../../server/migrations/cli.js');

let dataDir;
let tenantA;
let tenantB;
let tenantBroken;

function run(command) {
  const result = spawnSync('node', [CLI_PATH, command], {
    env: { ...process.env, DATA_DIR: dataDir },
    encoding: 'utf8',
    timeout: 30_000,
  });
  // Failure lines go to stderr (console.error), success/progress to stdout —
  // combine them so assertions don't need to know which stream a given line
  // landed on.
  return { stdout: result.stdout, stderr: result.stderr, output: result.stdout + result.stderr, status: result.status };
}

beforeAll(async () => {
  // getPlatformDb()/createTenant() provision the platform registry and each
  // tenant's isolated database on disk under this test file's own temp
  // DATA_DIR (server/db.js forces a fresh mkdtemp'd dir under NODE_ENV=test).
  getPlatformDb();
  tenantA = createTenant({ slug: 'fleet-a', name: 'Fleet Agency A' });
  tenantB = createTenant({ slug: 'fleet-b', name: 'Fleet Agency B' });
  tenantBroken = createTenant({ slug: 'fleet-broken', name: 'Fleet Broken Agency' });
  // Actually create each tenant's marvelops.db file (lazy otherwise).
  getDb(tenantA.id);
  getDb(tenantB.id);
  getDb(tenantBroken.id);

  dataDir = getDataDir();

  // Release every open handle before the CLI subprocess touches the same
  // files, so there's no ambiguity from concurrent connections in the test.
  closeDb();

  // Corrupt one tenant's database in place, simulating a damaged file.
  fs.writeFileSync(path.join(dataDir, 'tenants', tenantBroken.id, 'marvelops.db'), 'NOT A SQLITE DATABASE');
});

afterAll(() => {
  // getDataDir() is test-scoped (a temp dir per file); nothing to restore.
});

describe('db:migrate fleet:status', () => {
  it('reports each tenant independently and exits non-zero when one is unreadable', () => {
    const { output, status } = run('fleet:status');
    expect(output).toContain('Fleet Agency A (fleet-a) — up to date');
    expect(output).toContain('Fleet Agency B (fleet-b) — up to date');
    expect(output).toContain('Fleet Broken Agency (fleet-broken) — could not read database');
    expect(output).toContain('2 up to date, 0 pending, 1 unreadable.');
    expect(status).toBe(1);
  });

  it('does not modify any database (read-only)', () => {
    run('fleet:status');
    // Re-running produces byte-identical output — nothing was migrated or altered.
    const second = run('fleet:status');
    expect(second.output).toContain('2 up to date, 0 pending, 1 unreadable.');
  });
});

describe('db:migrate bootstrap', () => {
  it('migrates the healthy tenants and reports (not throws on) the broken one', () => {
    const { output, status } = run('bootstrap');
    expect(output).toContain('Fleet Agency A (fleet-a) — 0 migration(s) applied.');
    expect(output).toContain('Fleet Agency B (fleet-b) — 0 migration(s) applied.');
    expect(output).toContain('Fleet Broken Agency (fleet-broken) — FAILED');
    expect(output).toContain('2/3 migrated successfully.');
    expect(status).toBe(1);
  });

  it('processes every tenant even when one earlier in the run fails', () => {
    // A regression here means the healthy tenants after the broken one in
    // fs.readdirSync() order were silently skipped — the exact bug this
    // suite exists to catch.
    const { output } = run('bootstrap');
    expect(output).toContain('Fleet Agency A');
    expect(output).toContain('Fleet Agency B');
  });

  it('recovers cleanly once the broken tenant is fixed', () => {
    // Simulate an operator fix: replace the corrupt file with a fresh,
    // empty database (what a restore from backup would produce) — the
    // corrupt file must be removed first, since better-sqlite3 opens the
    // existing (bad) file lazily and only fails on first real use.
    const brokenPath = path.join(dataDir, 'tenants', tenantBroken.id, 'marvelops.db');
    fs.unlinkSync(brokenPath);
    const db = new Database(brokenPath);
    db.pragma('journal_mode = WAL');
    db.close();
    closeTenantDb(tenantBroken.id);

    const { output, status } = run('bootstrap');
    expect(output).toContain('Fleet Broken Agency (fleet-broken) — ');
    expect(output).not.toContain('FAILED');
    expect(output).toContain('3/3 migrated successfully.');
    expect(status).toBe(0);
  });
});
