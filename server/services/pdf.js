import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';
import logger from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.join(__dirname, '..', '..', 'data', 'pdfs');

if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

function getAppSettings() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT data FROM entities WHERE type = 'AppSettings' LIMIT 1").get();
    if (row) return JSON.parse(row.data);
  } catch {}
  return {};
}

function createDoc(filename) {
  const filePath = path.join(PDF_DIR, filename);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  doc.on('error', (err) => stream.destroy(err));
  stream.on('error', (err) => {
    logger.error({ err: err.message, filename }, 'PDF stream error');
  });
  return { doc, filePath, filename, stream };
}

function finalizeDoc({ doc, stream, filePath, filename }) {
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      logger.info({ filename }, 'PDF generated');
      resolve({ filePath, filename });
    });
    stream.on('error', reject);
    doc.end();
  });
}

function drawHeader(doc, settings, subtitle) {
  const companyName = settings.invoice_header?.company_name || settings.app_name || '';
  const address = [
    settings.invoice_header?.address_line1,
    settings.invoice_header?.address_line2,
    settings.invoice_header?.city,
    settings.invoice_header?.country,
  ]
    .filter(Boolean)
    .join(', ');

  if (companyName) {
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#1a1a2e').text(companyName, { align: 'left' });
  }
  if (address) {
    doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(address, { align: 'left' });
  }
  if (settings.invoice_header?.phone) {
    doc.fontSize(9).fillColor('#64748b').text(settings.invoice_header.phone, { align: 'left' });
  }
  if (settings.invoice_header?.email || settings.support_email) {
    doc
      .fontSize(9)
      .fillColor('#64748b')
      .text(settings.invoice_header?.email || settings.support_email, { align: 'left' });
  }

  doc.moveDown(0.5);
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8);

  if (subtitle) {
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#374151').text(subtitle, { align: 'left' });
    doc.moveDown(0.8);
  }

  doc.fillColor('#1a1a2e').fontSize(11).font('Helvetica');
}

function drawFooter(doc, settings) {
  const footerText = settings.invoice_footer || '';
  if (footerText) {
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(footerText, 50, doc.page.height - 55, { align: 'center', width: 500 });
  }
  // Page number only
  doc
    .fontSize(8)
    .fillColor('#cbd5e1')
    .text(`${new Date().toLocaleDateString('it-IT')}`, 50, doc.page.height - 40, { align: 'right', width: 500 });
}

function drawField(doc, label, value) {
  if (!value) return;
  doc.fillColor('#64748b').font('Helvetica-Bold').text(`${label}:`, { continued: true });
  doc.fillColor('#1a1a2e').font('Helvetica').text(`  ${value}`);
  doc.moveDown(0.4);
}

/**
 * Render a booking-confirmation PDF to disk, branded with the agency's app settings.
 * @returns {Promise<{filePath: string, filename: string}>}
 */
export async function generateBookingConfirmation({ clientName, reference, destination, dates, details } = {}) {
  const settings = getAppSettings();
  const filename = `booking_${reference || 'draft'}_${Date.now()}.pdf`;
  const ctx = createDoc(filename);
  const { doc } = ctx;

  drawHeader(doc, settings, 'Booking Confirmation');

  doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text('✓ Booking Confirmed');
  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica');

  drawField(doc, 'Reference', reference);
  drawField(doc, 'Client', clientName);
  drawField(doc, 'Destination', destination);
  drawField(doc, 'Dates', dates);
  if (details) {
    doc.moveDown(0.5);
    doc.fillColor('#64748b').font('Helvetica-Bold').text('Notes:');
    doc.fillColor('#1a1a2e').font('Helvetica').text(details);
  }

  drawFooter(doc, settings);
  return finalizeDoc(ctx);
}

/**
 * Render a travel-proposal PDF to disk, including itemized services if provided.
 * @returns {Promise<{filePath: string, filename: string}>}
 */
export async function generateProposal({
  clientName,
  destination,
  proposalUrl,
  agentName,
  details,
  startDate,
  endDate,
  totalPrice,
  currency,
  items,
} = {}) {
  const settings = getAppSettings();
  const filename = `proposal_${(clientName || 'draft').replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  const ctx = createDoc(filename);
  const { doc } = ctx;

  drawHeader(doc, settings, 'Travel Proposal');

  doc.fontSize(11).font('Helvetica');
  drawField(doc, 'Client', clientName);
  drawField(doc, 'Destination', destination);
  if (startDate || endDate) drawField(doc, 'Dates', [startDate, endDate].filter(Boolean).join(' – '));
  if (totalPrice) drawField(doc, 'Total', `${totalPrice} ${currency || ''}`);
  drawField(doc, 'Travel Specialist', agentName);
  if (proposalUrl) drawField(doc, 'Proposal Link', proposalUrl);

  if (items && items.length > 0) {
    doc.moveDown(0.8);
    doc.fillColor('#374151').font('Helvetica-Bold').text('Services Included:');
    doc.moveDown(0.4);
    for (const item of items) {
      doc
        .fillColor('#1a1a2e')
        .font('Helvetica')
        .text(`• ${item.name}${item.price ? ` — ${item.price} ${currency || ''}` : ''}`);
    }
  }

  if (details) {
    doc.moveDown(0.8);
    doc.fillColor('#64748b').font('Helvetica-Bold').text('Notes:');
    doc.fillColor('#1a1a2e').font('Helvetica').text(details);
  }

  drawFooter(doc, settings);
  return finalizeDoc(ctx);
}

/**
 * Render an invoice PDF to disk.
 * @returns {Promise<{filePath: string, filename: string}>}
 */
export async function generateInvoice({ clientName, invoiceNumber, amount, dueDate, details } = {}) {
  const settings = getAppSettings();
  const filename = `invoice_${invoiceNumber || 'draft'}_${Date.now()}.pdf`;
  const ctx = createDoc(filename);
  const { doc } = ctx;

  drawHeader(doc, settings, 'Invoice');

  doc.fontSize(11).font('Helvetica');
  drawField(doc, 'Invoice No.', invoiceNumber);
  drawField(doc, 'Client', clientName);
  drawField(doc, 'Amount Due', amount);
  drawField(doc, 'Due Date', dueDate);

  if (details) {
    doc.moveDown(0.5);
    doc.fillColor('#64748b').font('Helvetica-Bold').text('Details:');
    doc.fillColor('#1a1a2e').font('Helvetica').text(details);
  }

  drawFooter(doc, settings);
  return finalizeDoc(ctx);
}
