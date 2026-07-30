import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { migrate, migrationStatus, migratePlatform, PLATFORM_MIGRATIONS_DIR } from './runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');
const PLATFORM_DB_PATH = path.join(DATA_DIR, 'platform.db');
const TENANTS_DIR = path.join(DATA_DIR, 'tenants');

const command = process.argv[2];

// Default/legacy tenant DB path, mirroring server/db.js: prefer the adopted
// data/tenants/0/marvelops.db once it exists, else the legacy data/marvelops.db.
function resolveDefaultDbPath() {
  const adopted = path.join(TENANTS_DIR, '0', 'marvelops.db');
  return fs.existsSync(adopted) ? adopted : DB_PATH;
}

function printStatuses(statuses) {
  if (statuses.length === 0) {
    console.log('No migration files found.');
    return;
  }
  const maxLen = Math.max(...statuses.map((s) => s.name.length), 10);
  console.log('Migration'.padEnd(maxLen + 2) + 'Status');
  console.log('-'.repeat(maxLen + 2) + '--------');
  for (const s of statuses) {
    console.log(s.name.padEnd(maxLen + 2) + (s.applied ? '✓ Applied' : '○ Pending'));
  }
}

// Deliberately raw `Database` opens (not server/db.js's getDb()/getPlatformDb())
// throughout this file: importing server/db.js would run its own top-level
// migration + platform-provisioning side effects at module load, which would
// race with — or duplicate — what this CLI is explicitly here to control.

/** Every tenant id directory under data/tenants/, excluding the legacy tenant (migrated at server startup). */
function listTenantIds() {
  if (!fs.existsSync(TENANTS_DIR)) return [];
  return fs.readdirSync(TENANTS_DIR).filter((entry) => {
    if (entry === '0') return false;
    const dir = path.join(TENANTS_DIR, entry);
    return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'marvelops.db'));
  });
}

/** slug/name for tenant ids, read directly off the (already-open) platform DB. Missing rows just get no label. */
function tenantLabels(platformDb, tenantIds) {
  const labels = new Map();
  if (!platformDb || tenantIds.length === 0) return labels;
  const placeholders = tenantIds.map(() => '?').join(',');
  for (const row of platformDb
    .prepare(`SELECT id, slug, name FROM tenants WHERE id IN (${placeholders})`)
    .all(...tenantIds)) {
    labels.set(row.id, `${row.name} (${row.slug})`);
  }
  return labels;
}

/**
 * Apply pending migrations to one tenant's database, always closing the handle
 * (success or failure) so a script that keeps going after an error doesn't
 * accumulate open file descriptors.
 * @returns {{tenantId: string, ok: boolean, applied?: number, error?: string}}
 */
async function migrateOneTenant(tenantId) {
  const dbPath = path.join(TENANTS_DIR, tenantId, 'marvelops.db');
  let db;
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    const applied = await migrate(db, { quiet: false });
    return { tenantId, ok: true, applied: applied.length };
  } catch (err) {
    return { tenantId, ok: false, error: err.message };
  } finally {
    try {
      db?.pragma('wal_checkpoint(TRUNCATE)');
      db?.close();
    } catch {
      // ignore close errors — nothing left to do with this handle either way
    }
  }
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  switch (command) {
    case 'up': {
      const db = new Database(resolveDefaultDbPath());
      db.pragma('journal_mode = WAL');
      await migrate(db, { direction: 'up' });
      process.exit(0);
    }

    case 'down': {
      const db = new Database(resolveDefaultDbPath());
      db.pragma('journal_mode = WAL');
      await migrate(db, { direction: 'down' });
      process.exit(0);
    }

    case 'status': {
      const db = new Database(resolveDefaultDbPath());
      db.pragma('journal_mode = WAL');
      printStatuses(migrationStatus(db));
      process.exit(0);
    }

    case 'platform': {
      const db = new Database(PLATFORM_DB_PATH);
      db.pragma('journal_mode = WAL');
      await migratePlatform(db, { direction: 'up' });
      process.exit(0);
    }

    case 'platform:status': {
      const db = new Database(PLATFORM_DB_PATH);
      db.pragma('journal_mode = WAL');
      printStatuses(migrationStatus(db, PLATFORM_MIGRATIONS_DIR));
      process.exit(0);
    }

    // Read-only: reports pending-migration counts per tenant without applying
    // anything, so an operator can see what `bootstrap` would do — and which
    // tenant DBs are even openable — before committing to a fleet-wide run.
    case 'fleet:status': {
      const platformExists = fs.existsSync(PLATFORM_DB_PATH);
      const platform = platformExists ? new Database(PLATFORM_DB_PATH, { readonly: true }) : null;
      if (platform) {
        const pending = migrationStatus(platform, PLATFORM_MIGRATIONS_DIR).filter((s) => !s.applied).length;
        console.log(`[Platform] ${pending === 0 ? 'up to date' : `${pending} pending migration(s)`}`);
      } else {
        console.log('[Platform] platform.db does not exist yet.');
      }

      const tenantIds = listTenantIds();
      const labels = tenantLabels(platform, tenantIds);
      platform?.close();

      if (tenantIds.length === 0) {
        console.log('[Tenants] none found under data/tenants/ (besides the legacy default tenant).');
        process.exit(0);
      }

      console.log(`[Tenants] ${tenantIds.length} found:`);
      let upToDate = 0;
      let pendingCount = 0;
      let unreadable = 0;
      for (const tenantId of tenantIds) {
        const label = labels.get(tenantId) || tenantId;
        try {
          const db = new Database(path.join(TENANTS_DIR, tenantId, 'marvelops.db'), { readonly: true });
          const pending = migrationStatus(db).filter((s) => !s.applied).length;
          db.close();
          if (pending === 0) {
            upToDate += 1;
            console.log(`  ✓ ${label} — up to date`);
          } else {
            pendingCount += 1;
            console.log(`  ○ ${label} — ${pending} pending migration(s)`);
          }
        } catch (err) {
          unreadable += 1;
          console.log(`  ✗ ${label} — could not read database: ${err.message}`);
        }
      }
      console.log(`\n${upToDate} up to date, ${pendingCount} pending, ${unreadable} unreadable.`);
      process.exit(unreadable > 0 ? 1 : 0);
    }

    case 'bootstrap': {
      // Platform DB first, then every tenant database under data/tenants/. Each
      // tenant is isolated: one bad database (corrupt file, a migration that
      // throws) is reported and skipped rather than aborting the run and
      // silently leaving every tenant after it — alphabetically, not by any
      // meaningful priority — unmigrated.
      const platform = new Database(PLATFORM_DB_PATH);
      platform.pragma('journal_mode = WAL');
      await migratePlatform(platform, { direction: 'up' });
      console.log(
        `[Platform] ${migrationStatus(platform, PLATFORM_MIGRATIONS_DIR).filter((s) => s.applied).length} migration(s) applied.`,
      );

      const tenantIds = listTenantIds();
      if (tenantIds.length === 0) {
        platform.close();
        console.log('[Tenants] no tenant directory found.');
        process.exit(0);
      }

      const labels = tenantLabels(platform, tenantIds);
      platform.close();

      const results = [];
      for (const tenantId of tenantIds) {
        const result = await migrateOneTenant(tenantId);
        results.push(result);
        const label = labels.get(tenantId) || tenantId;
        if (result.ok) {
          console.log(`[Tenants] ✓ ${label} — ${result.applied} migration(s) applied.`);
        } else {
          console.error(`[Tenants] ✗ ${label} — FAILED: ${result.error}`);
        }
      }

      const failed = results.filter((r) => !r.ok);
      console.log(`\n[Tenants] ${results.length - failed.length}/${results.length} migrated successfully.`);
      if (failed.length > 0) {
        console.error(`[Tenants] ${failed.length} tenant(s) failed and were skipped:`);
        for (const f of failed) console.error(`  - ${labels.get(f.tenantId) || f.tenantId}: ${f.error}`);
        console.error('Fix the underlying issue and re-run — already-migrated tenants are untouched by a re-run.');
      }
      process.exit(failed.length > 0 ? 1 : 0);
    }

    default: {
      console.log(
        'Usage: node server/migrations/cli.js <up|down|status|platform|platform:status|fleet:status|bootstrap>',
      );
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
