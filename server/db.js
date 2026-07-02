import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { migrate, migrationStatus } from './migrations/runner.js';
import { createBackupSync } from './services/backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests get a throwaway DB in a fresh temp dir instead of the real dev
// database — otherwise every test run permanently writes real rows (users,
// entities) into data/marvelops.db with no cleanup.
const DATA_DIR = process.env.NODE_ENV === 'test'
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'marvelops-test-'))
  : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');

const ENTITIES = [
  'AppSettings', 'BookingRequest', 'BookingTemplate', 'Client', 'ClientPayment',
  'ClientTask', 'EmailLog', 'Invoice', 'ItineraryEvent', 'Message', 'PackingItem',
  'Proposal', 'ProposalTemplate', 'ReferenceCounter', 'ServiceCategory',
  'ServiceTemplate', 'Supplier', 'SupplierBooking', 'SupplierCategory',
  'SupplierInvoice', 'SupplierPricing', 'SupplierReview', 'SupplierService',
  'SupplierSubcategory', 'Trip', 'OutlookToken', 'TourContract', 'ReportSchedule'
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
if (process.env.NODE_ENV !== 'test' && migrationStatus(db).some(m => !m.applied)) {
  try {
    const dest = createBackupSync(db, DATA_DIR, 'pre-migration');
    console.log(`[DB] Pre-migration backup created at ${dest}`);
  } catch (err) {
    // A failed backup shouldn't block the app from starting — log loudly
    // and proceed. Worst case, the daily scheduled backup is the safety net.
    console.error('[DB] Pre-migration backup failed:', err.message);
  }
}

migrate(db, { quiet: false });

console.log(`[DB] Initialized at ${DB_PATH}`);

// --- Exports ---

export function getDb() {
  return db;
}

export function closeDb() {
  if (db) {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
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

function rebuildFts(db) {
  try {
    db.exec('DROP TRIGGER IF EXISTS entities_fts_insert');
    db.exec('DROP TRIGGER IF EXISTS entities_fts_delete');
    db.exec('DROP TRIGGER IF EXISTS entities_fts_update');
  } catch {}
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
      id UNINDEXED, type UNINDEXED, label, content, tokenize='unicode61'
    )`);
    db.exec('DELETE FROM entities_fts');
    db.exec(`INSERT INTO entities_fts(id, type, label, content)
      SELECT id, type, type, data FROM entities`);
  } catch (e) {
    console.error('[FTS] rebuild failed:', e.message);
  }
}
