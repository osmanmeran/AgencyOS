import { getDb } from '../db.js';
import logger from '../lib/logger.js';
import { createNotification } from './notifications.js';
import { forEachTenant } from './tenants.js';
import { escapeHtml } from './email.js';

let intervalHandle = null;

/** Run an immediate reminder check, then repeat it every 60 minutes (due-soon/overdue invoices, trips starting tomorrow). Covers every workspace. */
export function startReminderService() {
  logger.info('Reminder service started');

  const check = () => {
    forEachTenant(
      () => {
        checkPendingInvoices();
        checkUpcomingTrips();
      },
      { label: 'reminders' },
    ).catch((err) => logger.error({ err }, 'Reminder check error'));
  };

  check();
  intervalHandle = setInterval(check, 60 * 60 * 1000);
  logger.info('Reminder service scheduled (every 60 minutes)');
}

/** Cancel the scheduled reminder-check interval, if running. */
export function stopReminderService() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Reminder service stopped');
  }
}

function checkPendingInvoices() {
  const db = getDb();
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Range (not exact-day equality) so a missed hourly run — e.g. the server
  // was down on the exact day an invoice crossed the 3-day mark — still
  // catches up instead of permanently skipping that invoice's reminder.
  const dueSoon = db
    .prepare(
      `
    SELECT id, data FROM entities WHERE type = 'Invoice'
    AND json_extract(data, '$.status') = 'sent'
    AND json_extract(data, '$.due_date') BETWEEN ? AND ?
  `,
    )
    .all(today, threeDaysFromNow);

  for (const row of dueSoon) {
    const data = JSON.parse(row.data);
    logger.info({ invoice_id: row.id, number: data.invoice_number }, 'Invoice due soon');
    createNotificationForEntity(db, row.id, 'invoice_due_soon', `Invoice ${data.invoice_number} is due soon`);
  }

  const overdue = db
    .prepare(
      `
    SELECT id, data FROM entities WHERE type = 'Invoice'
    AND json_extract(data, '$.status') = 'sent'
    AND json_extract(data, '$.due_date') < ?
  `,
    )
    .all(today);

  for (const row of overdue) {
    const data = JSON.parse(row.data);
    logger.info({ invoice_id: row.id, number: data.invoice_number }, 'Invoice overdue');
    createNotificationForEntity(db, row.id, 'invoice_overdue', `Invoice ${data.invoice_number} is overdue`);
  }
}

function checkUpcomingTrips() {
  const db = getDb();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const starting = db
    .prepare(
      `
    SELECT id, data FROM entities WHERE type = 'Trip'
    AND json_extract(data, '$.status') IN ('confirmed', 'in_progress')
    AND json_extract(data, '$.start_date') = ?
  `,
    )
    .all(tomorrow);

  for (const row of starting) {
    const data = JSON.parse(row.data);
    logger.info({ trip_id: row.id, name: data.name }, 'Trip starting tomorrow');
    createNotificationForEntity(
      db,
      row.id,
      'trip_starting_soon',
      `Trip "${data.name}" to ${data.destination} starts tomorrow!`,
    );
  }
}

function createNotificationForEntity(db, entityId, type, message) {
  const entity = db.prepare('SELECT data FROM entities WHERE id = ?').get(entityId);
  if (!entity) return;

  // created_by lives inside the JSON data blob, not as a SQL column
  const userId = JSON.parse(entity.data).created_by;
  if (!userId) return;

  // The notifications table has no reference_id column — the actual schema
  // is (id, user_id, type, title, message, data, read, created_date), same
  // as server/services/notifications.js. Store the entity link in `data`.
  const existing = db
    .prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND type = ? AND json_extract(data, '$.entityId') = ? AND created_date > ?`,
    )
    .get(userId, type, entityId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (existing) return;

  // Also emails the user if they've opted into email notifications
  // (services/notifications.js checks the preference and no-ops otherwise).
  // `message` embeds user-controlled fields (trip name, destination, invoice
  // number) — sendEmail() sends `body` verbatim as the email's HTML, so it
  // must be escaped here even though the in-app `message`/`title` (rendered
  // as text by React, never as HTML) is left as-is.
  createNotification({
    userId,
    type,
    title: message,
    message,
    data: { entityId },
    email: { subject: message, body: escapeHtml(message) },
  });

  logger.info({ userId, type, entityId }, 'Auto-reminder notification created');
}
