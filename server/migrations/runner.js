import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
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
    .map((r) => r.name);
}

function getMigrationFiles() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => /^\d+_.+\.(cjs|js)$/.test(f))
    .sort();
}

// Migrations were originally written as .cjs; existing databases (including
// production) have their filenames-with-extension recorded in `_migrations`.
// Converting a file to ESM `.js` must not make the runner think it's a new,
// unapplied migration — so every name comparison strips the extension and
// compares on the numeric-prefix + slug alone.
function normalizeName(name) {
  return name.replace(/\.(cjs|mjs|js)$/, '');
}

function getPendingMigrations(db) {
  const applied = new Set(getAppliedMigrations(db).map(normalizeName));
  return getMigrationFiles().filter((f) => !applied.has(normalizeName(f)));
}

// Resolves a name recorded in `_migrations` (possibly with a since-renamed
// extension) back to the file that currently exists on disk for it.
function resolveFile(appliedName) {
  const target = normalizeName(appliedName);
  return getMigrationFiles().find((f) => normalizeName(f) === target);
}

async function loadMigration(file) {
  if (file.endsWith('.cjs')) return require(path.join(__dirname, file));
  return import(pathToFileURL(path.join(__dirname, file)).href);
}

export async function migrate(db, { direction = 'up', quiet = false } = {}) {
  ensureMetaTable(db);

  if (direction === 'up') {
    const pending = getPendingMigrations(db);
    if (pending.length === 0) {
      if (!quiet) console.log('[Migrations] All migrations already applied.');
      return [];
    }

    const applied = [];
    for (const file of pending) {
      const migration = await loadMigration(file);
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

    const lastName = appliedNames[appliedNames.length - 1];
    const lastFile = resolveFile(lastName);
    if (!lastFile) {
      throw new Error(`Cannot roll back "${lastName}": no matching migration file found on disk.`);
    }
    const migration = await loadMigration(lastFile);
    if (!quiet) console.log(`[Migrations] Rolling back: ${lastName}`);

    db.transaction(() => {
      if (migration.down) migration.down(db);
      db.prepare(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = ?`).run(lastName);
    })();

    if (!quiet) console.log('[Migrations] Rolled back 1 migration.');
    return [lastName];
  }

  throw new Error(`Unknown migration direction: ${direction}`);
}

export function migrationStatus(db) {
  ensureMetaTable(db);
  const applied = new Set(getAppliedMigrations(db).map(normalizeName));
  return getMigrationFiles().map((f) => ({
    name: f,
    applied: applied.has(normalizeName(f)),
  }));
}
