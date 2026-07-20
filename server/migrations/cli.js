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

    case 'bootstrap': {
      // Platform DB first, then every tenant database under data/tenants/.
      const platform = new Database(PLATFORM_DB_PATH);
      platform.pragma('journal_mode = WAL');
      await migratePlatform(platform, { direction: 'up' });
      console.log(
        `[Platform] ${migrationStatus(platform, PLATFORM_MIGRATIONS_DIR).filter((s) => s.applied).length} migration(s) applied.`,
      );

      if (fs.existsSync(TENANTS_DIR)) {
        const results = [];
        for (const entry of fs.readdirSync(TENANTS_DIR)) {
          if (entry === '0') continue; // default/legacy tenant is migrated at startup
          const dir = path.join(TENANTS_DIR, entry);
          if (!fs.statSync(dir).isDirectory()) continue;
          const dbPath = path.join(dir, 'marvelops.db');
          if (!fs.existsSync(dbPath)) continue;
          const tenantDb = new Database(dbPath);
          tenantDb.pragma('journal_mode = WAL');
          const applied = await migrate(tenantDb, { quiet: false });
          tenantDb.pragma('wal_checkpoint(TRUNCATE)');
          tenantDb.close();
          results.push({ tenantId: entry, applied: applied.length });
        }
        console.log(`[Tenants] migrated ${results.length} tenant database(s).`);
      } else {
        console.log('[Tenants] no tenant directory found.');
      }
      process.exit(0);
    }

    default: {
      console.log('Usage: node server/migrations/cli.js <up|down|status|platform|platform:status|bootstrap>');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
