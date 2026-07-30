import nodemailer from 'nodemailer';
import { getDb, uid } from '../db.js';
import logger from '../lib/logger.js';

// ── SMTP Configuration ─────────────────────────────────────────────────

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };
}

function getFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@marvelops.app';
}

let transporter = null;
let smtpFailed = false;

function getTransporter() {
  if (transporter) return transporter;
  if (smtpFailed) return null;

  const config = getSmtpConfig();
  if (!config) return null;

  transporter = nodemailer.createTransport(config);

  transporter
    .verify()
    .then(() => {
      logger.info({ host: config.host }, 'SMTP connection verified');
    })
    .catch((err) => {
      logger.error({ err: err.message }, 'SMTP connection verification failed');
      transporter = null;
      smtpFailed = true;
    });

  return transporter;
}

/** @returns {boolean} True if SMTP_HOST is set, i.e. real email sending is possible. */
export function isSmtpConfigured() {
  return !!getSmtpConfig();
}

// ── Email Templates ────────────────────────────────────────────────────

const TEMPLATES = {
  generic: ({ content }) => `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Marvelops TravelPro</h1>
        </div>
        <div style="background: #ffffff; padding: 32px 24px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
          ${content}
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
          <p>Sent via Marvelops TravelPro</p>
        </div>
      </div>
    </body>
    </html>
  `,

  proposal: ({ clientName, destination, proposalUrl, agentName }) =>
    TEMPLATES.generic({
      content: `
    <h2 style="color: #1e293b; margin-top: 0;">New Travel Proposal</h2>
    <p>Dear ${clientName},</p>
    <p>We are excited to present a personalized travel proposal for your trip to <strong>${destination}</strong>.</p>
    <p>Click the button below to review the full itinerary, pricing, and inclusions:</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${proposalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Your Proposal</a>
    </div>
    <p style="color: #64748b; font-size: 14px;">If you have any questions, please reply to this email or contact your travel specialist ${agentName}.</p>
  `,
    }),

  booking_confirmation: ({ clientName, reference, destination, dates, details }) =>
    TEMPLATES.generic({
      content: `
    <h2 style="color: #1e293b; margin-top: 0;">Booking Confirmed!</h2>
    <p>Dear ${clientName},</p>
    <p>Your booking has been confirmed. Here are the details:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Reference</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${reference}</td></tr>
      <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Destination</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${destination}</td></tr>
      <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Dates</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${dates}</td></tr>
    </table>
    ${details ? `<p>${details}</p>` : ''}
  `,
    }),

  invite_user: ({ inviteUrl, inviterName }) =>
    TEMPLATES.generic({
      content: `
    <h2 style="color: #1e293b; margin-top: 0;">You're Invited!</h2>
    <p>You've been invited by <strong>${inviterName}</strong> to join <strong>Marvelops TravelPro</strong>.</p>
    <p>Click the button below to set up your account and get started:</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Accept Invitation</a>
    </div>
    <p style="color: #64748b; font-size: 14px;">This link expires in 7 days.</p>
  `,
    }),

  quote_response: ({ clientName, quoteTitle, status, responseNotes, quoteUrl }) =>
    TEMPLATES.generic({
      content: `
    <h2 style="color: #1e293b; margin-top: 0;">Your Quote Request Has Been Updated</h2>
    <p>Dear ${clientName},</p>
    <p>Your quote request <strong>${quoteTitle}</strong> is now marked as <strong>${status}</strong>.</p>
    ${responseNotes ? `<p style="background:#f8fafc;border-left:3px solid #2563eb;padding:12px 16px;color:#334155;">${responseNotes}</p>` : ''}
    <div style="text-align: center; margin: 24px 0;">
      <a href="${quoteUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Your Quote</a>
    </div>
  `,
    }),

  invoice: ({ clientName, invoiceNumber, amount, dueDate, invoiceUrl }) =>
    TEMPLATES.generic({
      content: `
    <h2 style="color: #1e293b; margin-top: 0;">Invoice Ready</h2>
    <p>Dear ${clientName},</p>
    <p>Invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> is now available.</p>
    <p>Payment is due by <strong>${dueDate}</strong>.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Invoice</a>
    </div>
  `,
    }),
};

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Exported so callers building ad hoc HTML email bodies (outside the `template`
// path, which already escapes via escapeTemplateData below) can escape
// user-controlled fields — trip/client names, notes — before interpolating
// them into HTML that gets sent verbatim as the email's `html` body.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Named template fields are user-controlled (client names, trip details,
 * staff notes) but get interpolated directly into HTML — escape every string
 * field before it reaches a template. `*Url` fields are server-built links,
 * not user text, so they're passed through unescaped.
 */
function escapeTemplateData(data) {
  const escaped = {};
  for (const [key, value] of Object.entries(data || {})) {
    escaped[key] = typeof value === 'string' && !key.endsWith('Url') ? escapeHtml(value) : value;
  }
  return escaped;
}

/**
 * Render one of the named HTML {@link TEMPLATES}, falling back to the generic
 * wrapper with raw `data.content` if the template name isn't recognized.
 * @returns {string} Full HTML email body.
 */
export function renderTemplate(templateName, data) {
  const template = TEMPLATES[templateName];
  if (!template) return TEMPLATES.generic({ content: data.content || '' });
  return template(escapeTemplateData(data));
}

// ── Sending ────────────────────────────────────────────────────────────

/**
 * Send an email via SMTP if configured, otherwise just log it — either way the
 * attempt is recorded in `email_logs`.
 * @returns {Promise<{id: string, status: string, message: string}>}
 */
export async function sendEmail({ to, subject, body, template, templateData, cc, bcc }) {
  const db = getDb();
  const now = new Date().toISOString();
  const logId = uid();
  const recipients = Array.isArray(to) ? to : [to];

  // Try SMTP first, fall back to logging
  const transport = getTransporter();
  let status = 'logged';

  if (transport) {
    try {
      const html = template ? renderTemplate(template, templateData) : body;
      const info = await transport.sendMail({
        from: getFromAddress(),
        to: recipients.join(', '),
        cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
        subject,
        html: html || body || '',
      });
      status = 'sent';
      logger.info({ messageId: info.messageId, to: recipients }, 'Email sent via SMTP');
    } catch (err) {
      logger.error({ err: err.message, to: recipients }, 'SMTP send failed, falling back to log');
      status = 'failed';
    }
  } else {
    logger.info({ to: recipients, subject }, 'Email logged locally (SMTP not configured)');
  }

  // Always log to the database
  db.prepare('INSERT INTO email_logs (id, to_email, subject, body, status, sent_date) VALUES (?, ?, ?, ?, ?, ?)').run(
    logId,
    recipients.join(', '),
    subject,
    body || '',
    status,
    now,
  );

  return { id: logId, status, message: status === 'sent' ? 'Email sent' : 'Email logged locally' };
}
