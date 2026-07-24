import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const MIGRATIONS_TABLE = '_migrations';

// Business migrations live alongside this file. Platform-level migrations
// (the central `platform.db` — tenants table, etc.) live in a sub-directory so
// they never get applied to a tenant database and vice-versa.
export const PLATFORM_MIGRATIONS_DIR = path.join(__dirname, 'platform');

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

function getMigrationFiles(dir = __dirname) {
  return fs
    .readdirSync(dir)
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

function getPendingMigrations(db, dir = __dirname) {
  const applied = new Set(getAppliedMigrations(db).map(normalizeName));
  return getMigrationFiles(dir).filter((f) => !applied.has(normalizeName(f)));
}

// Resolves a name recorded in `_migrations` (possibly with a since-renamed
// extension) back to the file that currently exists on disk for it.
function resolveFile(appliedName, dir = __dirname) {
  const target = normalizeName(appliedName);
  return getMigrationFiles(dir).find((f) => normalizeName(f) === target);
}

async function loadMigration(file, dir = __dirname) {
  const full = path.join(dir, file);
  if (file.endsWith('.cjs')) return require(full);
  return import(pathToFileURL(full).href);
}

// Migration modules are loaded once at startup and cached, so migrate() can run
// fully synchronously. Callers like getDb()/getPlatformDb() are synchronous and
// must apply pending migrations before returning the connection — a fire-and-
// forget async import would race with connection teardown and throw "connection
// not open". Keyed by `dir::normalizedName` so business and platform migrations
// never collide even if they share a numeric prefix.
const migrationModules = new Map();

function moduleKey(dir, file) {
  return `${dir}::${normalizeName(file)}`;
}

async function preload(dir) {
  for (const file of getMigrationFiles(dir)) {
    migrationModules.set(moduleKey(dir, file), await loadMigration(file, dir));
  }
}

function getMigrationModule(file, dir = __dirname) {
  const mod = migrationModules.get(moduleKey(dir, file));
  if (!mod) throw new Error(`Migration module not loaded: ${file}`);
  return mod;
}

// Preload both business and platform migrations before any migrate() call.
await preload(__dirname);
await preload(PLATFORM_MIGRATIONS_DIR);

export function migrate(db, { direction = 'up', quiet = false, dir = __dirname } = {}) {
  ensureMetaTable(db);

  if (direction === 'up') {
    const pending = getPendingMigrations(db, dir);
    if (pending.length === 0) {
      if (!quiet) console.log('[Migrations] All migrations already applied.');
      return [];
    }

    const applied = [];
    for (const file of pending) {
      const migration = getMigrationModule(file, dir);
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
    const lastFile = resolveFile(lastName, dir);
    if (!lastFile) {
      throw new Error(`Cannot roll back "${lastName}": no matching migration file found on disk.`);
    }
    const migration = getMigrationModule(lastFile, dir);
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

export function migrationStatus(db, dir = __dirname) {
  ensureMetaTable(db);
  const applied = new Set(getAppliedMigrations(db).map(normalizeName));
  return getMigrationFiles(dir).map((f) => ({
    name: f,
    applied: applied.has(normalizeName(f)),
  }));
}

// --- Platform (`platform.db`) migrations ---

export function migratePlatform(db, opts = {}) {
  return migrate(db, { ...opts, dir: PLATFORM_MIGRATIONS_DIR });
}

export function platformMigrationStatus(db) {
  return migrationStatus(db, PLATFORM_MIGRATIONS_DIR);
}
