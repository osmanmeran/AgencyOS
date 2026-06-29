import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { upload, saveDocument, getDocuments, getDocumentById, deleteDocument } from '../services/documents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const router = Router();

router.use(authMiddleware);

router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.name === 'MulterError' ? `Upload error: ${err.message}` : err.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const doc = saveDocument({
      file: req.file,
      entityType: req.body.entity_type,
      entityId: req.body.entity_id,
      userId: req.user.id,
    });

    res.json({ success: true, document: doc });
  });
});

router.get('/', catchAsync(async (req, res) => {
  const { entity_type, entity_id } = req.query;
  const documents = getDocuments(entity_type, entity_id);
  res.json({ documents });
}));

router.get('/:id', catchAsync(async (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json({ document: { ...doc, url: `/uploads/${doc.stored_name}` } });
}));

router.get('/:id/download', catchAsync(async (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const filePath = path.join(UPLOAD_DIR, doc.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
  res.setHeader('Content-Type', doc.mime_type);
  fs.createReadStream(filePath).pipe(res);
}));

router.delete('/:id', catchAsync(async (req, res) => {
  const doc = deleteDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json({ success: true });
}));

export default router;
