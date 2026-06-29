import { randomUUID } from 'crypto';
import { getDb } from '../db.js';
import logger from '../lib/logger.js';

let intervalHandle = null;

export function startReminderService() {
  logger.info('Reminder service started');

  const check = () => {
    try {
      checkPendingInvoices();
      checkUpcomingTrips();
    } catch (err) {
      logger.error({ err }, 'Reminder check error');
    }
  };

  check();
  intervalHandle = setInterval(check, 60 * 60 * 1000);
  logger.info('Reminder service scheduled (every 60 minutes)');
}

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

  const dueSoon = db.prepare(`
    SELECT id, data FROM entities WHERE type = 'Invoice'
    AND json_extract(data, '$.status') = 'sent'
    AND json_extract(data, '$.due_date') = ?
  `).all(threeDaysFromNow);

  for (const row of dueSoon) {
    const data = JSON.parse(row.data);
    logger.info({ invoice_id: row.id, number: data.invoice_number }, 'Invoice due in 3 days');
    createNotificationForEntity(db, row.id, 'invoice_due_soon', `Invoice ${data.invoice_number} is due in 3 days`);
  }

  const overdue = db.prepare(`
    SELECT id, data FROM entities WHERE type = 'Invoice'
    AND json_extract(data, '$.status') = 'sent'
    AND json_extract(data, '$.due_date') < ?
  `).all(today);

  let notifiedOverdue;
  try {
    notifiedOverdue = new Set(
      db.prepare(`SELECT reference_id FROM email_logs WHERE reference_type = 'overdue_reminder' AND created_date >= ?`)
        .all(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .map(r => r.reference_id)
    );
  } catch {
    notifiedOverdue = new Set();
  }

  for (const row of overdue) {
    if (notifiedOverdue.has(row.id)) continue;
    const data = JSON.parse(row.data);
    logger.info({ invoice_id: row.id, number: data.invoice_number }, 'Invoice overdue');
    createNotificationForEntity(db, row.id, 'invoice_overdue', `Invoice ${data.invoice_number} is overdue`);
  }
}

function checkUpcomingTrips() {
  const db = getDb();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const starting = db.prepare(`
    SELECT id, data FROM entities WHERE type = 'Trip'
    AND json_extract(data, '$.status') IN ('confirmed', 'in_progress')
    AND json_extract(data, '$.start_date') = ?
  `).all(tomorrow);

  for (const row of starting) {
    const data = JSON.parse(row.data);
    logger.info({ trip_id: row.id, name: data.name }, 'Trip starting tomorrow');
    createNotificationForEntity(db, row.id, 'trip_starting_soon', `Trip "${data.name}" to ${data.destination} starts tomorrow!`);
  }
}

function createNotificationForEntity(db, entityId, type, message) {
  const now = new Date().toISOString();
  const entity = db.prepare('SELECT created_by FROM entities WHERE id = ?').get(entityId);
  if (!entity) return;

  const userId = entity.created_by;
  if (!userId) return;

  const existing = db.prepare(
    'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND reference_id = ? AND created_date > ?'
  ).get(userId, type, entityId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (existing) return;

  db.prepare(
    'INSERT INTO notifications (id, user_id, type, title, message, reference_id, is_read, created_date) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ).run(
    randomUUID(),
    userId,
    type,
    message,
    message,
    entityId,
    now
  );

  logger.info({ userId, type, entityId }, 'Auto-reminder notification created');
}
