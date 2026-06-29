import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const MIGRATIONS_TABLE = '_migrations';

function ensureMetaTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function getAppliedMigrations(db) {
  return db
    .prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`)
    .all()
    .map(r => r.name);
}

function getMigrationFiles() {
  return fs
    .readdirSync(__dirname)
    .filter(f => /^\d+_.+\.cjs$/.test(f))
    .sort();
}

function getPendingMigrations(db) {
  const applied = new Set(getAppliedMigrations(db));
  return getMigrationFiles().filter(f => !applied.has(f));
}

function loadMigration(file) {
  return require(path.join(__dirname, file));
}

export function migrate(db, { direction = 'up', quiet = false } = {}) {
  ensureMetaTable(db);

  if (direction === 'up') {
    const pending = getPendingMigrations(db);
    if (pending.length === 0) {
      if (!quiet) console.log('[Migrations] All migrations already applied.');
      return [];
    }

    const applied = [];
    for (const file of pending) {
      const migration = loadMigration(file);
      if (!quiet) console.log(`[Migrations] Applying: ${file}`);
      db.transaction(() => {
        migration.up(db);
        db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`).run(file);
      })();
      applied.push(file);
    }
    if (!quiet) console.log(`[Migrations] Applied ${applied.length} migration(s).`);
    return applied;
  }

  if (direction === 'down') {
    const appliedNames = getAppliedMigrations(db);
    if (appliedNames.length === 0) {
      if (!quiet) console.log('[Migrations] No migrations to roll back.');
      return [];
    }

    const lastFile = appliedNames[appliedNames.length - 1];
    const migration = loadMigration(lastFile);
    if (!quiet) console.log(`[Migrations] Rolling back: ${lastFile}`);

    db.transaction(() => {
      if (migration.down) migration.down(db);
      db.prepare(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = ?`).run(lastFile);
    })();

    if (!quiet) console.log('[Migrations] Rolled back 1 migration.');
    return [lastFile];
  }

  throw new Error(`Unknown migration direction: ${direction}`);
}

export function migrationStatus(db) {
  ensureMetaTable(db);
  const applied = new Set(getAppliedMigrations(db));
  return getMigrationFiles().map(f => ({
    name: f,
    applied: applied.has(f),
  }));
}
