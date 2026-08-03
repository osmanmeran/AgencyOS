import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { getUploadDir } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, sendError } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import {
  getExchangeRate,
  getOutlookStatus,
  connectOutlook,
  disconnectOutlook,
  sendOutlookEmail,
  searchSupplier,
  refreshRates,
  getStoredRates,
} from '../services/integrations.js';
import { sendEmail, isSmtpConfigured } from '../services/email.js';
import { sanitizeFilename } from '../lib/sanitizeFilename.js';
import { ALLOWED_MIME_TYPES } from '../lib/mimeTypes.js';

// On Railway, /app/data is the persistent volume (same as the DB). Resolved per
// request so each tenant writes into its own uploads directory.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getUploadDir()),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, `${Date.now()}_${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  },
});

const router = Router();

router.use(authMiddleware);

router.get(
  '/exchange-rate',
  validate(schemas.exchangeRate, 'query'),
  catchAsync(async (req, res) => {
    const result = await getExchangeRate(req.query.from, req.query.to);
    res.json(result);
  }),
);

// Latest stored daily exchange-rate snapshot (source + fetch timestamp).
router.get('/exchange-rates', (req, res) => {
  const stored = getStoredRates();
  if (!stored) {
    return res.status(404).json({ error: { code: 'NO_RATES', message: 'No exchange rates stored yet' } });
  }
  res.json(stored);
});

// Force an immediate refresh of the stored snapshot from the provider.
router.post(
  '/exchange-rates/refresh',
  catchAsync(async (req, res) => {
    const result = await refreshRates();
    res.json(result);
  }),
);

router.post(
  '/email',
  validate(schemas.sendEmail),
  catchAsync(async (req, res) => {
    const { to, subject, body, cc, bcc } = req.body;
    const result = await sendEmail({ to, subject, body, cc, bcc });
    res.json({ success: true, ...result });
  }),
);

router.post(
  '/email/template',
  validate(schemas.sendEmailTemplate),
  catchAsync(async (req, res) => {
    const { to, subject, cc, bcc } = req.body;
    const { template, templateData } = req.body;
    const result = await sendEmail({ to, subject, template, templateData, cc, bcc });
    res.json({ success: true, ...result });
  }),
);

router.get('/email/status', (req, res) => {
  res.json({
    smtp: isSmtpConfigured(),
    outlook: true, // outlook is always available if configured
  });
});

router.post(
  '/sms',
  validate(schemas.sendSms),
  catchAsync(async (req, res) => {
    res.json({ success: true, message: 'SMS sent (logged locally)' });
  }),
);

router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return sendError(res, 400, 'UPLOAD_ERROR', `Upload error: ${err.message}`);
      }
      return sendError(res, 400, 'UPLOAD_ERROR', err.message);
    }
    if (!req.file) return sendError(res, 400, 'NO_FILE', 'No file uploaded');
    res.json({ file_url: `/uploads/${req.file.filename}`, success: true });
  });
});

router.post(
  '/supplier-web-search',
  validate(schemas.supplierWebSearch),
  catchAsync(async (req, res) => {
    const results = await searchSupplier(req.body.name, req.body.city);
    res.json({ success: true, results });
  }),
);

router.get('/outlook/status', (req, res) => {
  res.json(getOutlookStatus(req.user.id));
});

router.post(
  '/outlook/connect',
  validate(schemas.outlookConnect),
  catchAsync(async (req, res) => {
    const result = await connectOutlook(req.user.id, req.body);
    res.json({ success: true, ...result });
  }),
);

router.post(
  '/outlook/send',
  validate(schemas.sendEmail),
  catchAsync(async (req, res) => {
    await sendOutlookEmail(req.user.id, req.body);
    res.json({ success: true, message: 'Email sent via Outlook' });
  }),
);

router.post('/outlook/disconnect', (req, res) => {
  disconnectOutlook(req.user.id);
  res.json({ success: true, message: 'Outlook disconnected' });
});

export default router;
