import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getPdfDir } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, sendError } from '../middleware/errors.js';
import { generateBookingConfirmation, generateProposal, generateInvoice } from '../services/pdf.js';
import { createNotification } from '../services/notifications.js';
import { logAudit, AUDIT_ACTIONS } from '../services/audit.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/booking',
  catchAsync(async (req, res) => {
    const { clientName, reference, destination, dates, details } = req.body;
    if (!clientName || !reference)
      return sendError(res, 400, 'VALIDATION_ERROR', 'clientName and reference are required');
    const { filename } = await generateBookingConfirmation(req.body);

    createNotification({
      userId: req.user.id,
      type: 'success',
      title: 'PDF Generated',
      message: `Booking confirmation ${reference} generated`,
    });
    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: AUDIT_ACTIONS.PDF_GENERATED,
      entityType: 'booking',
      entityId: reference,
      ip: req.ip,
    });

    res.json({ success: true, filename, url: `/api/pdf/download/${filename}` });
  }),
);

router.post(
  '/proposal',
  catchAsync(async (req, res) => {
    const { clientName, destination } = req.body;
    if (!clientName || !destination)
      return sendError(res, 400, 'VALIDATION_ERROR', 'clientName and destination are required');
    const { filename } = await generateProposal(req.body);

    createNotification({
      userId: req.user.id,
      type: 'info',
      title: 'PDF Generated',
      message: `Proposal for ${clientName} generated`,
    });
    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: AUDIT_ACTIONS.PDF_GENERATED,
      entityType: 'proposal',
      entityId: clientName,
      ip: req.ip,
    });

    res.json({ success: true, filename, url: `/api/pdf/download/${filename}` });
  }),
);

router.post(
  '/invoice',
  catchAsync(async (req, res) => {
    const { invoiceNumber } = req.body;
    if (!invoiceNumber) return sendError(res, 400, 'VALIDATION_ERROR', 'invoiceNumber is required');
    const { filename } = await generateInvoice(req.body);

    createNotification({
      userId: req.user.id,
      type: 'info',
      title: 'PDF Generated',
      message: `Invoice ${invoiceNumber} generated`,
    });
    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: AUDIT_ACTIONS.PDF_GENERATED,
      entityType: 'invoice',
      entityId: invoiceNumber,
      ip: req.ip,
    });

    res.json({ success: true, filename, url: `/api/pdf/download/${filename}` });
  }),
);

router.post(
  '/test',
  catchAsync(async (req, res) => {
    const { filename } = await generateProposal({
      clientName: 'Test Client',
      destination: 'Rome, Italy',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      totalPrice: 2500,
      currency: 'EUR',
      items: [{ name: 'Test Service', price: 2500, quantity: 1 }],
    });
    res.json({ success: true, filename, url: `/api/pdf/download/${filename}` });
  }),
);

router.get('/download/:filename', (req, res) => {
  // The tenant's own PDF directory — generated filenames are guessable
  // (`booking_<reference>_<ts>.pdf`), so resolving per tenant is what stops a
  // user of one workspace from fetching another workspace's documents.
  const pdfDir = getPdfDir();
  const filename = path.basename(req.params.filename);
  const filePath = path.join(pdfDir, filename);
  if (!filePath.startsWith(pdfDir + path.sep)) return sendError(res, 400, 'INVALID_FILENAME', 'Invalid filename');
  if (!fs.existsSync(filePath)) return sendError(res, 404, 'FILE_NOT_FOUND', 'File not found');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(filePath).pipe(res);
});

export default router;
