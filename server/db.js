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

const ENTITIES = [
  'AppSettings', 'BookingRequest', 'BookingTemplate', 'Client', 'ClientPayment',
  'ClientTask', 'EmailLog', 'Invoice', 'ItineraryEvent', 'Message', 'PackingItem',
  'Proposal', 'ProposalTemplate', 'ReferenceCounter', 'ServiceCategory',
  'ServiceTemplate', 'Supplier', 'SupplierBooking', 'SupplierCategory',
  'SupplierInvoice', 'SupplierPricing', 'SupplierReview', 'SupplierService',
  'SupplierSubcategory', 'Trip', 'OutlookToken'
];

let db;

// --- Vercel Blob persistence ---

async function loadDbFromBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ token: process.env.BLOB_READ_WRITE_TOKEN });
    const blob = blobs.find(b => b.pathname === 'marvelops.db');
    if (blob) {
      const resp = await fetch(blob.url);
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_PATH, buffer);
      console.log('[DB] Restored from Vercel Blob');
      return true;
    }
  } catch (e) {
    console.log('[DB] Blob load skipped:', e.message);
  }
  return false;
}

async function persistDb() {
  const { put } = await import('@vercel/blob');
  db.pragma('wal_checkpoint(TRUNCATE)');
  const buffer = fs.readFileSync(DB_PATH);
  await put('marvelops.db', buffer, {
    token: process.env.BLOB_READ_WRITE_TOKEN,
    access: 'private',
    addRandomSuffix: false,
  });
  console.log('[DB] Persisted to Vercel Blob');
}

function startBlobPersistence(db) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  let uploading = false;
  let lastMtime = 0;

  const upload = async () => {
    if (uploading) return;
    uploading = true;
    try {
      let currentMtime;
      try { currentMtime = fs.statSync(DB_PATH).mtimeMs; } catch { currentMtime = 0; }
      if (currentMtime <= lastMtime) {
        lastMtime = currentMtime;
        return;
      }
      await persistDb();
      try { lastMtime = fs.statSync(DB_PATH).mtimeMs; } catch {}
    } catch (e) {
      console.error('[DB] Blob persist failed:', e.message);
    } finally {
      uploading = false;
    }
  };

  setInterval(upload, 60000);

  const cleanup = async () => {
    if (uploading) return;
    uploading = true;
    try {
      await persistDb();
    } catch (e) {
      console.error('[DB] Final persist failed:', e.message);
    }
  };
  process.on('beforeExit', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

// --- Eager initialization with top-level await ---

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// On Vercel, try to restore from Blob before opening DB
if (isVercel) {
  await loadDbFromBlob();
}

db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
migrate(db, { quiet: false });

if (isVercel) {
  startBlobPersistence(db);
}

console.log(`[DB] Initialized at ${DB_PATH}`);

// --- Exports ---

export function getDb() {
  return db;
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
