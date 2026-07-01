import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { getExchangeRate, logEmail, getOutlookStatus, connectOutlook, disconnectOutlook, sendOutlookEmail, searchSupplier } from '../services/integrations.js';
import { sendEmail, isSmtpConfigured, renderTemplate } from '../services/email.js';
import { sanitizeFilename } from '../lib/sanitizeFilename.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = !!process.env.VERCEL;
// On Railway, /app/data is the persistent volume (same as the DB). On Vercel use /tmp.
const uploadDir = isVercel
  ? path.join('/tmp', 'uploads')
  : (process.env.DATA_DIR
      ? path.join(process.env.DATA_DIR, 'uploads')
      : path.join(__dirname, '..', '..', 'data', 'uploads'));
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, `${Date.now()}_${safeName}${ext}`);
  }
});

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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }
});

const router = Router();

router.use(authMiddleware);

router.get('/exchange-rate', validate(schemas.exchangeRate, 'query'), catchAsync(async (req, res) => {
  const result = await getExchangeRate(req.query.from, req.query.to);
  res.json(result);
}));

router.post('/email', validate(schemas.sendEmail), catchAsync(async (req, res) => {
  const { to, subject, body, cc, bcc } = req.body;
  const result = await sendEmail({ to, subject, body, cc, bcc });
  res.json({ success: true, ...result });
}));

router.post('/email/template', validate(schemas.sendEmailTemplate), catchAsync(async (req, res) => {
  const { to, subject, cc, bcc } = req.body;
  const { template, templateData } = req.body;
  const result = await sendEmail({ to, subject, template, templateData, cc, bcc });
  res.json({ success: true, ...result });
}));

router.get('/email/status', (req, res) => {
  res.json({
    smtp: isSmtpConfigured(),
    outlook: true, // outlook is always available if configured
  });
});

router.post('/sms', validate(schemas.sendSms), catchAsync(async (req, res) => {
  res.json({ success: true, message: 'SMS sent (logged locally)' });
}));

router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ file_url: `/uploads/${req.file.filename}`, success: true });
  });
});

router.post('/supplier-web-search', validate(schemas.supplierWebSearch), catchAsync(async (req, res) => {
  const results = await searchSupplier(req.body.name, req.body.city);
  res.json({ success: true, results });
}));

router.get('/outlook/status', (req, res) => {
  res.json(getOutlookStatus(req.user.id));
});

router.post('/outlook/connect', validate(schemas.outlookConnect), catchAsync(async (req, res) => {
  const result = await connectOutlook(req.user.id, req.body);
  res.json({ success: true, ...result });
}));

router.post('/outlook/send', validate(schemas.sendEmail), catchAsync(async (req, res) => {
  await sendOutlookEmail(req.user.id, req.body);
  res.json({ success: true, message: 'Email sent via Outlook' });
}));

router.post('/outlook/disconnect', (req, res) => {
  disconnectOutlook(req.user.id);
  res.json({ success: true, message: 'Outlook disconnected' });
});

export default router;
