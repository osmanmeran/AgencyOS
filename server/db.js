import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { fileURLToPath } from 'url';
import { migrate, migrationStatus, migratePlatform } from './migrations/runner.js';
import { createBackupSync } from './services/backup.js';
import logger from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests get a throwaway DB in a fresh temp dir instead of the real dev
// database — otherwise every test run permanently writes real rows (users,
// entities) into data/marvelops.db with no cleanup. Otherwise honor DATA_DIR
// (documented in the README, already respected for uploads in app.js /
// routes/documents.js / routes/integrations.js) so the DB lives on the same
// configurable path — on Railway the persistent volume is mounted at the
// default `./data` already, so this is a no-op there, not a path change.
const DATA_DIR =
  process.env.NODE_ENV === 'test'
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'marvelops-test-'))
    : process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');
const PLATFORM_DB_PATH = path.join(DATA_DIR, 'platform.db');
const TENANTS_DIR = path.join(DATA_DIR, 'tenants');

// Tenant "zero" is the legacy single-tenant database that existed before
// multi-tenancy. It keeps its original on-disk path so the existing production
// data is adopted in place (see SAAS_PROJECT.md, Phase 1 — the critical
// one-off tenant-zero adoption) rather than copied. Every other tenant lives
// under data/tenants/<tenantId>/.
export const DEFAULT_TENANT_ID = '0';

// Cap on simultaneously-open tenant DB file descriptors. Each tenant is a live
// SQLite file handle, so we LRU-evict the least-recently-used one (never the
// default/legacy tenant).
const MAX_OPEN_DBS = 50;

const ENTITIES = [
  'AppSettings',
  'BookingRequest',
  'BookingTemplate',
  'Client',
  'ClientPayment',
  'Company',
  'EmailLog',
  'Invoice',
  'ItineraryEvent',
  'Message',
  'PackingItem',
  'Proposal',
  'ProposalTemplate',
  'QuoteRequest',
  'ReferenceCounter',
  'Supplier',
  'SupplierBooking',
  'SupplierCategory',
  'SupplierInvoice',
  'SupplierPricing',
  'SupplierReview',
  'SupplierService',
  'SupplierStopSale',
  'SupplierSubcategory',
  'Task',
  'Trip',
  'TourContract',
  'GuidedTour',
  'TourBooking',
  'ReportSchedule',
];
// Deliberately NOT in ENTITIES: 'OutlookToken' (per-user Microsoft Graph
// OAuth tokens). It lives in the entities table but is managed exclusively by
// server/services/integrations.js with direct SQL — exposing it through the
// generic /api/entities routes would let any staff user read other users'
// tokens.

// tenantId -> open Database, in LRU order (most-recently-used at the end).
const dbCache = new Map();

// Request-scoped tenant context. An incoming request resolves its tenant (from
// the Host subdomain / JWT claim) and runs the rest of the request inside
// runWithTenant(), so the ~100 existing call sites that call getDb() with no
// argument transparently hit the correct tenant's isolated database — no
// per-call threading of tenantId required. Code that runs outside a request
// (tests, schedulers, scripts) gets the default/legacy tenant.
const tenantContext = new AsyncLocalStorage();

/** The tenant id for the current request, or null if none is set. */
export function getTenantId() {
  return tenantContext.getStore() ?? null;
}

/** Run `fn` (optionally with `args`) with `tenantId` as the active tenant context. */
export function runWithTenant(tenantId, fn, ...args) {
  return tenantContext.run(String(tenantId), fn, ...args);
}

function tenantDbPath(tenantId) {
  if (!tenantId || tenantId === DEFAULT_TENANT_ID) {
    // Tenant zero's DB is adopted in place. Once the adoption script has run,
    // it lives at data/tenants/0/marvelops.db; until then (and in every existing
    // deployment that hasn't adopted yet) it stays at the legacy
    // data/marvelops.db. Preferring the adopted path keeps the app working in
    // both states without wiping or duplicating production data.
    const adopted = path.join(TENANTS_DIR, String(DEFAULT_TENANT_ID), 'marvelops.db');
    if (fs.existsSync(adopted)) return adopted;
    return DB_PATH;
  }
  return path.join(TENANTS_DIR, String(tenantId), 'marvelops.db');
}

function openTenantDb(tenantId) {
  const dbPath = tenantDbPath(tenantId);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  return database;
}

// Boot the legacy/default tenant exactly as the pre-multi-tenant code did:
// snapshot before applying pending migrations, then run the migration chain.
function bootstrapDefaultTenant() {
  const database = openTenantDb(DEFAULT_TENANT_ID);
  if (process.env.NODE_ENV !== 'test') {
    // One-time safety snapshot the very first time this deployment boots with
    // the multi-tenant code: no platform.db yet means the legacy database has
    // never run under multi-tenancy. Taken before the server can accept a
    // single request, it is the restore point if the SaaS rollout ever needs
    // to be undone. Never auto-pruned (backup rotation is label-scoped).
    if (!fs.existsSync(PLATFORM_DB_PATH)) {
      try {
        const dest = createBackupSync(database, DATA_DIR, 'pre-saas');
        logger.info({ dest }, 'Pre-SaaS adoption snapshot of the legacy database created');
      } catch (err) {
        logger.warn({ err: err.message }, 'Pre-SaaS adoption snapshot failed');
      }
    }
    if (migrationStatus(database).some((m) => !m.applied)) {
      try {
        const dest = createBackupSync(database, DATA_DIR, 'pre-migration');
        logger.info({ dest }, 'Pre-migration backup created');
      } catch (err) {
        logger.warn({ err: err.message }, 'Pre-migration backup failed');
      }
    }
  }
  return database;
}

function evictLruTenant() {
  while (dbCache.size > MAX_OPEN_DBS) {
    // Never evict the default/legacy tenant — keep it pinned open.
    let victim = null;
    for (const key of dbCache.keys()) {
      if (key !== DEFAULT_TENANT_ID) {
        victim = key;
        break;
      }
    }
    if (victim === null) break; // only the default tenant remains open
    const database = dbCache.get(victim);
    dbCache.delete(victim);
    try {
      database.pragma('wal_checkpoint(TRUNCATE)');
      database.close();
    } catch {
      // ignore close errors on eviction
    }
  }
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultDb = bootstrapDefaultTenant();
dbCache.set(DEFAULT_TENANT_ID, defaultDb);
await migrate(defaultDb, { quiet: false });

logger.info({ path: DB_PATH }, 'Database initialized');

// --- Exports ---

/**
 * Get (or open + migrate) the SQLite connection for a tenant.
 *
 * In Phase 1 the tenant id defaults to the legacy single-tenant database so the
 * app keeps working unchanged; Phase 2 will thread `req.tenant_id` through every
 * call. Each tenant DB is an isolated file descriptor, cached and LRU-bounded.
 * @param {string|number} [tenantId] Tenant id; omit for the default/legacy tenant.
 * @returns {import('better-sqlite3').Database}
 */
export function getDb(tenantId) {
  // Explicit argument wins; otherwise use the request's tenant context, falling
  // back to the default/legacy tenant when called outside a request.
  const key = tenantId !== undefined ? String(tenantId) : (getTenantId() ?? DEFAULT_TENANT_ID);
  const cached = dbCache.get(key);
  if (cached) {
    // Refresh recency so the most-used tenants stay open.
    dbCache.delete(key);
    dbCache.set(key, cached);
    return cached;
  }

  const database = openTenantDb(key);
  // Migrations are idempotent (tracked in each DB's `_migrations` table), so
  // re-running on an already-migrated tenant is a cheap no-op.
  migrate(database, { quiet: true });

  dbCache.set(key, database);
  evictLruTenant();
  return database;
}

// Lazily-opened platform DB singleton (central `platform.db`).
let platformDb;

/**
 * Get the central platform database (the tenant registry). Created and migrated
 * on first use. Returns `null` only if the environment can't provision it.
 * @returns {import('better-sqlite3').Database}
 */
export function getPlatformDb() {
  if (platformDb) return platformDb;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  platformDb = new Database(PLATFORM_DB_PATH);
  platformDb.pragma('journal_mode = WAL');
  // Run platform migrations (tenants table, etc.) on first open.
  migratePlatform(platformDb, { quiet: false });
  return platformDb;
}

/**
 * Re-run the full business migration chain against every tenant database found
 * under data/tenants/. Used by the `db:migrate bootstrap` command. The default
 * (legacy) tenant is already migrated at startup and is not part of this loop.
 * @returns {Array<{tenantId: string, applied: number}>}
 */
export function migrateAllTenants({ quiet = false } = {}) {
  if (!fs.existsSync(TENANTS_DIR)) return [];
  const results = [];
  for (const entry of fs.readdirSync(TENANTS_DIR)) {
    const dir = path.join(TENANTS_DIR, entry);
    if (!fs.statSync(dir).isDirectory()) continue;
    const dbPath = path.join(dir, 'marvelops.db');
    if (!fs.existsSync(dbPath)) continue;
    const database = new Database(dbPath);
    database.pragma('journal_mode = WAL');
    const applied = migrate(database, { quiet });
    database.pragma('wal_checkpoint(TRUNCATE)');
    database.close();
    results.push({ tenantId: entry, applied: applied.length });
  }
  return results;
}

/**
 * Close and forget one tenant's connection. Required before removing a
 * workspace's files: an open handle left in the cache would be handed to a
 * later request for a tenant whose database no longer exists.
 * @returns {boolean} Whether a cached connection was closed.
 */
export function closeTenantDb(tenantId) {
  const key = String(tenantId);
  const database = dbCache.get(key);
  if (!database) return false;
  try {
    database.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // ignore — we're discarding this database anyway
  }
  try {
    database.close();
  } catch {
    // ignore
  }
  dbCache.delete(key);
  return true;
}

export function closeDb() {
  for (const [, database] of dbCache) {
    try {
      database.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // ignore
    }
    database.close();
  }
  dbCache.clear();
  if (platformDb) {
    try {
      platformDb.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // ignore
    }
    platformDb.close();
    platformDb = null;
  }
}

export async function reopenDb() {
  closeDb();
  const database = openTenantDb(DEFAULT_TENANT_ID);
  database.pragma('journal_mode = WAL');
  await migrate(database, { quiet: false });
  dbCache.set(DEFAULT_TENANT_ID, database);
  return database;
}

export function getDbPath(tenantId = DEFAULT_TENANT_ID) {
  return tenantDbPath(tenantId);
}

export function getPlatformDbPath() {
  return PLATFORM_DB_PATH;
}

export function getDataDir() {
  return DATA_DIR;
}

export function getTenantsDir() {
  return TENANTS_DIR;
}

/**
 * Root data directory for a tenant's *files* (uploads, generated PDFs).
 *
 * The legacy/default tenant keeps the original top-level paths (`data/uploads`,
 * `data/pdfs`) so every file uploaded before multi-tenancy resolves unchanged —
 * note that adopt-tenant-zero moves only the .db file, never the file dirs.
 * Every other tenant gets its own subtree under `data/tenants/<id>/`, which is
 * what keeps one agency's documents off another's filesystem.
 * @param {string|number} [tenantId] Omit to use the current request's tenant.
 */
export function getTenantDataDir(tenantId) {
  const key = tenantId !== undefined ? String(tenantId) : (getTenantId() ?? DEFAULT_TENANT_ID);
  if (key === DEFAULT_TENANT_ID) return DATA_DIR;
  return path.join(TENANTS_DIR, key);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Upload directory for a tenant (created on demand). @param {string|number} [tenantId] */
export function getUploadDir(tenantId) {
  return ensureDir(path.join(getTenantDataDir(tenantId), 'uploads'));
}

/** Generated-PDF directory for a tenant (created on demand). @param {string|number} [tenantId] */
export function getPdfDir(tenantId) {
  return ensureDir(path.join(getTenantDataDir(tenantId), 'pdfs'));
}

export function getEntities() {
  return ENTITIES;
}

export function uid() {
  return crypto.randomBytes(8).toString('hex');
}

/** Whether the `entities_fts` FTS5 virtual table exists on this connection. */
export function hasFts(dbConn) {
  try {
    dbConn.prepare('SELECT 1 FROM entities_fts LIMIT 0').get();
    return true;
  } catch {
    return false;
  }
}

// Eagerly provision the platform registry so the pre-SaaS snapshot taken in
// bootstrapDefaultTenant() stays strictly one-time: its trigger is
// "platform.db absent at boot", so creating the registry in the same boot
// guarantees later boots never re-snapshot. Down here (after all declarations)
// because getPlatformDb() touches the module-level `platformDb` binding.
// Tests keep the lazy path (each test file gets its own temp data dir).
if (process.env.NODE_ENV !== 'test') getPlatformDb();
