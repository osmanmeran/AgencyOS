import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { getDb, uid } from '../db.js';
import logger from '../lib/logger.js';
import { sanitizeFilename } from '../lib/sanitizeFilename.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = !!process.env.VERCEL;
const UPLOAD_DIR = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
];

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

export function saveDocument({ file, entityType, entityId, userId }) {
  const db = getDb();
  const id = uid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO documents (id, entity_type, entity_id, original_name, stored_name, mime_type, size, uploaded_by, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entityType || null, entityId || null, file.originalname, file.filename, file.mimetype, file.size, userId || null, now);

  logger.info({ id, entityType, entityId }, 'Document saved');

  return {
    id, originalName: file.originalname, storedName: file.filename,
    mimeType: file.mimetype, size: file.size, url: `/uploads/${file.filename}`,
  };
}

export function getDocuments(entityType, entityId) {
  const db = getDb();
  let rows;
  if (entityType && entityId) {
    rows = db.prepare(
      'SELECT * FROM documents WHERE entity_type = ? AND entity_id = ? ORDER BY created_date DESC'
    ).all(entityType, entityId);
  } else {
    rows = db.prepare('SELECT * FROM documents ORDER BY created_date DESC LIMIT 100').all();
  }
  return rows.map(d => ({ ...d, url: `/uploads/${d.stored_name}` }));
}

export function getDocumentById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

export function deleteDocument(id) {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return null;

  const filePath = path.join(UPLOAD_DIR, doc.stored_name);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) {
    logger.error({ err, path: filePath }, 'Failed to delete file');
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  logger.info({ id }, 'Document deleted');
  return doc;
}
