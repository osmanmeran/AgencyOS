import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb, getUploadDir } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendError } from '../middleware/errors.js';
import { userCanAccessDocument } from '../services/documents.js';

const router = Router();

// Uploaded files used to be served by `express.static`, which meant no session
// check, no tenant scoping and no row-level permission check: anyone with (or
// guessing) a URL could read any agency's passport scans and contracts, since
// stored names embed the original filename. Every read now goes through this
// route instead — authenticated, resolved inside the requesting tenant's own
// uploads directory, and permission-checked against the document's entity.
router.use(authMiddleware);

router.get('/:filename', (req, res) => {
  const uploadDir = getUploadDir();
  // basename() strips any traversal; the realpath check below is the backstop
  // (e.g. a symlink planted inside the uploads directory).
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, filename);
  if (!filePath.startsWith(uploadDir + path.sep)) {
    return sendError(res, 400, 'INVALID_FILENAME', 'Invalid filename');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return sendError(res, 404, 'FILE_NOT_FOUND', 'File not found');
  }
  if (fs.realpathSync(filePath) !== path.join(fs.realpathSync(uploadDir), filename)) {
    return sendError(res, 400, 'INVALID_FILENAME', 'Invalid filename');
  }

  // Files attached to a business record inherit that record's access rule.
  // Files without a `documents` row (e.g. the workspace logo uploaded through
  // /api/integrations/upload) stay readable by any member of the workspace —
  // tenant isolation is already enforced by the directory we resolved above.
  const doc = getDb().prepare('SELECT * FROM documents WHERE stored_name = ?').get(filename);
  if (doc && !userCanAccessDocument(req.user, doc)) {
    return sendError(res, 403, 'FORBIDDEN', 'Access denied');
  }

  if (doc?.mime_type) res.setHeader('Content-Type', doc.mime_type);
  // Private: these are per-user-authorized responses, so shared caches must not
  // store them, but the browser may (uploads are immutable once written).
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(filePath, { dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) sendError(res, 500, 'FILE_READ_ERROR', 'Failed to read file');
  });
});

export default router;
