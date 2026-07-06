import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { migrate, migrationStatus } from './migrations/runner.js';
import { createBackupSync } from './services/backup.js';
import logger from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests get a throwaway DB in a fresh temp dir instead of the real dev
// database — otherwise every test run permanently writes real rows (users,
// entities) into data/marvelops.db with no cleanup.
const DATA_DIR =
  process.env.NODE_ENV === 'test'
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'marvelops-test-'))
    : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');

const ENTITIES = [
  'AppSettings',
  'BookingRequest',
  'BookingTemplate',
  'Client',
  'ClientPayment',
  'ClientTask',
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
  'ServiceCategory',
  'ServiceTemplate',
  'Supplier',
  'SupplierBooking',
  'SupplierCategory',
  'SupplierInvoice',
  'SupplierPricing',
  'SupplierReview',
  'SupplierService',
  'SupplierSubcategory',
  'Trip',
  'OutlookToken',
  'TourContract',
  'ReportSchedule',
];

let db;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Snapshot the DB before applying any pending migration, so a bad migration
// (or a bad deploy in general) can be undone by restoring this file instead
// of just reverting the code — see scripts/backup-cli.mjs.
// Skipped in test env: every test run starts from a fresh, empty temp DB,
// so there's nothing worth snapshotting and it would just add file I/O.
if (process.env.NODE_ENV !== 'test' && migrationStatus(db).some((m) => !m.applied)) {
  try {
    const dest = createBackupSync(db, DATA_DIR, 'pre-migration');
    logger.info({ dest }, 'Pre-migration backup created');
  } catch (err) {
    logger.warn({ err: err.message }, 'Pre-migration backup failed');
  }
}

migrate(db, { quiet: false });

logger.info({ path: DB_PATH }, 'Database initialized');

// --- Exports ---

export function getDb() {
  return db;
}

export function closeDb() {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}
    db.close();
    db = null;
  }
}

export function reopenDb() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  migrate(db, { quiet: false });
}

export function getDbPath() {
  return DB_PATH;
}

export function getDataDir() {
  return DATA_DIR;
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
