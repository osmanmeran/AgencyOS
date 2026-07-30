import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getDb, uid, getUploadDir } from '../db.js';
import logger from '../lib/logger.js';
import { sanitizeFilename } from '../lib/sanitizeFilename.js';
import { ALLOWED_MIME_TYPES } from '../lib/mimeTypes.js';
import { findEntityById } from './entities.js';
import { ForbiddenError } from '../middleware/errors.js';

// Upload paths are resolved per request, not once at module load: each tenant
// stores its files under its own directory (getUploadDir reads the request's
// tenant context), so one agency's documents never land in another's folder.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getUploadDir()),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = sanitizeFilename(path.basename(file.originalname, ext));
    // uid() (not just Date.now()) so two uploads in the same millisecond can't
    // collide and overwrite each other's stored file.
    cb(null, `${Date.now()}_${uid()}_${safeName}${ext}`);
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
 * Whether `user` may read/download/delete a document, based on the entity it's
 * attached to (reusing the same row-level rule the generic entity routes use)
 * rather than any document-specific ownership field.
 * @returns {boolean}
 */
export function userCanAccessDocument(user, doc) {
  const tier = user.user_tier || 'agent';
  if (tier === 'admin' || tier === 'manager') return true;
  if (doc.uploaded_by && doc.uploaded_by === user.id) return true;
  if (!doc.entity_type || !doc.entity_id) return false;
  try {
    findEntityById(doc.entity_type, doc.entity_id, user);
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {object[]} Documents for the given entity, filtered to what `user` can access.
 * Without an entity_type/entity_id, only admins/managers get the 100 most recent overall —
 * everyone else must scope by entity.
 */
export function getDocuments(entityType, entityId, user) {
  const db = getDb();
  let rows;
  if (entityType && entityId) {
    findEntityById(entityType, entityId, user); // throws NotFound/Forbidden if inaccessible
    rows = db
      .prepare('SELECT * FROM documents WHERE entity_type = ? AND entity_id = ? ORDER BY created_date DESC')
      .all(entityType, entityId);
  } else {
    const tier = user.user_tier || 'agent';
    if (tier !== 'admin' && tier !== 'manager') {
      throw new ForbiddenError('entity_type and entity_id are required');
    }
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

  const filePath = path.join(getUploadDir(), path.basename(doc.stored_name));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    logger.error({ err, path: filePath }, 'Failed to delete file');
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  logger.info({ id }, 'Document deleted');
  return doc;
}
