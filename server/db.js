import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { migrate } from './migrations/runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = !!process.env.VERCEL;

const DATA_DIR = isVercel
  ? path.join('/tmp', 'data')
  : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');

let db;

const ENTITIES = [
  'AppSettings', 'BookingRequest', 'BookingTemplate', 'Client', 'ClientPayment',
  'ClientTask', 'EmailLog', 'Invoice', 'ItineraryEvent', 'Message', 'PackingItem',
  'Proposal', 'ProposalTemplate', 'ReferenceCounter', 'ServiceCategory',
  'ServiceTemplate', 'Supplier', 'SupplierBooking', 'SupplierCategory',
  'SupplierInvoice', 'SupplierPricing', 'SupplierReview', 'SupplierService',
  'SupplierSubcategory', 'Trip', 'OutlookToken'
];

export function getDb() {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    migrate(db, { quiet: false });
    rebuildFts(db);
  }
  return db;
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

export function getEntities() {
  return ENTITIES;
}

export function uid() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}
