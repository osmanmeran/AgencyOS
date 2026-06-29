import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { generateBookingConfirmation, generateProposal, generateInvoice } from '../services/pdf.js';
import { createNotification } from '../services/notifications.js';
import { logAudit, AUDIT_ACTIONS } from '../services/audit.js';

const router = Router();

router.use(authMiddleware);

router.post('/booking', catchAsync(async (req, res) => {
  const { clientName, reference, destination, dates, details } = req.body;
  if (!clientName || !reference) return res.status(400).json({ error: 'clientName and reference are required' });
  const { filename } = await generateBookingConfirmation(req.body);

  createNotification({
    userId: req.user.id, type: 'success', title: 'PDF Generated',
    message: `Booking confirmation ${reference} generated`,
  });
  logAudit({ userId: req.user.id, userName: req.user.email, action: AUDIT_ACTIONS.PDF_GENERATED,
    entityType: 'booking', entityId: reference, ip: req.ip });

  res.json({ success: true, filename, url: `/api/pdf/download/${filename}` });
}));

router.post('/proposal', catchAsync(async (req, res) => {
  const { clientName, destination } = req.body;
  if (!clientName || !destination) return res.status(400).json({ error: 'clientName and destination are required' });
  const { filename } = await generateProposal(req.body);

  createNotification({
    userId: req.user.id, type: 'info', title: 'PDF Generated',
    message: `Proposal for ${clientName} generated`,
  });
  logAudit({ userId: req.user.id, userName: req.user.email, action: AUDIT_ACTIONS.PDF_GENERATED,
    entityType: 'proposal', entityId: clientName, ip: req.ip });

  res.json({ success: true, filename, url: `/api/pdf/download/${filename}` });
}));

router.post('/invoice', catchAsync(async (req, res) => {
  const { invoiceNumber } = req.body;
  if (!invoiceNumber) return res.status(400).json({ error: 'invoiceNumber is required' });
  const { filename } = await generateInvoice(req.body);

  createNotification({
    userId: req.user.id, type: 'info', title: 'PDF Generated',
    message: `Invoice ${invoiceNumber} generated`,
  });
  logAudit({ userId: req.user.id, userName: req.user.email, action: AUDIT_ACTIONS.PDF_GENERATED,
    entityType: 'invoice', entityId: invoiceNumber, ip: req.ip });

  res.json({ success: true, filename, url: `/api/pdf/download/${filename}` });
}));

router.get('/download/:filename', (req, res) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(__dirname, '..', '..', 'data', 'pdfs', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(filePath).pipe(res);
});

export default router;
