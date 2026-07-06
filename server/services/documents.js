import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { getDb, uid } from '../db.js';
import logger from '../lib/logger.js';
import { sanitizeFilename } from '../lib/sanitizeFilename.js';
import { ALLOWED_MIME_TYPES } from '../lib/mimeTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, '..', 'data', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, `${Date.now()}_${safeName}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  },
});

/**
 * Persist metadata for an already-uploaded (multer) file into the `documents` table.
 * @returns {object} Document summary including its public `/uploads/...` URL.
 */
export function saveDocument({ file, entityType, entityId, userId }) {
  const db = getDb();
  const id = uid();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO documents (id, entity_type, entity_id, original_name, stored_name, mime_type, size, uploaded_by, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    entityType || null,
    entityId || null,
    file.originalname,
    file.filename,
    file.mimetype,
    file.size,
    userId || null,
    now,
  );

  logger.info({ id, entityType, entityId }, 'Document saved');

  return {
    id,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`,
  };
}

/**
 * @returns {object[]} Documents for the given entity, or (if omitted) the 100 most recent overall.
 */
export function getDocuments(entityType, entityId) {
  const db = getDb();
  let rows;
  if (entityType && entityId) {
    rows = db
      .prepare('SELECT * FROM documents WHERE entity_type = ? AND entity_id = ? ORDER BY created_date DESC')
      .all(entityType, entityId);
  } else {
    rows = db.prepare('SELECT * FROM documents ORDER BY created_date DESC LIMIT 100').all();
  }
  return rows.map((d) => ({ ...d, url: `/uploads/${d.stored_name}` }));
}

/** @returns {object|undefined} The raw document row, without a resolved URL. */
export function getDocumentById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

/**
 * Delete a document's DB row and its file on disk (file removal errors are logged, not thrown).
 * @returns {object|null} The deleted document's row, or null if it didn't exist.
 */
export function deleteDocument(id) {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return null;

  const filePath = path.join(UPLOAD_DIR, doc.stored_name);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    logger.error({ err, path: filePath }, 'Failed to delete file');
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  logger.info({ id }, 'Document deleted');
  return doc;
}
