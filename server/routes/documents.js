import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { getUploadDir } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, sendError } from '../middleware/errors.js';
import {
  upload,
  saveDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  userCanAccessDocument,
} from '../services/documents.js';

const router = Router();

router.use(authMiddleware);

router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.name === 'MulterError' ? `Upload error: ${err.message}` : err.message;
      return sendError(res, 400, 'UPLOAD_ERROR', message);
    }
    if (!req.file) return sendError(res, 400, 'NO_FILE', 'No file uploaded');

    const doc = saveDocument({
      file: req.file,
      entityType: req.body.entity_type,
      entityId: req.body.entity_id,
      userId: req.user.id,
    });

    res.json({ success: true, document: doc });
  });
});

router.get(
  '/',
  catchAsync(async (req, res) => {
    const { entity_type, entity_id } = req.query;
    const documents = getDocuments(entity_type, entity_id, req.user);
    res.json({ documents });
  }),
);

router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const doc = getDocumentById(req.params.id);
    if (!doc) return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    if (!userCanAccessDocument(req.user, doc)) return sendError(res, 403, 'FORBIDDEN', 'Access denied');
    res.json({ document: { ...doc, url: `/uploads/${doc.stored_name}` } });
  }),
);

router.get(
  '/:id/download',
  catchAsync(async (req, res) => {
    const doc = getDocumentById(req.params.id);
    if (!doc) return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    if (!userCanAccessDocument(req.user, doc)) return sendError(res, 403, 'FORBIDDEN', 'Access denied');

    // Resolved inside the requesting workspace's own uploads directory, so a
    // document id from another tenant can't reach that tenant's file.
    const filePath = path.join(getUploadDir(), path.basename(doc.stored_name));
    if (!fs.existsSync(filePath)) return sendError(res, 404, 'FILE_NOT_FOUND', 'File not found on disk');

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`);
    res.setHeader('Content-Type', doc.mime_type);
    fs.createReadStream(filePath).pipe(res);
  }),
);

router.delete(
  '/:id',
  catchAsync(async (req, res) => {
    const doc = getDocumentById(req.params.id);
    if (!doc) return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    if (!userCanAccessDocument(req.user, doc)) return sendError(res, 403, 'FORBIDDEN', 'Access denied');
    deleteDocument(req.params.id);
    res.json({ success: true });
  }),
);

export default router;
