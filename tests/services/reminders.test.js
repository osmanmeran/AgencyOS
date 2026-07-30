import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, uid } from '../../server/db.js';

const db = getDb();

// checkPendingInvoices/checkUpcomingTrips are not exported, so we drive them
// through the public startReminderService() entry point and inspect the
// notifications table it writes to.
import { startReminderService, stopReminderService } from '../../server/services/reminders.js';

function insertEntity(type, data) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    type,
    JSON.stringify(data),
    now,
    now,
  );
  return id;
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function notificationsFor(entityId) {
  return db.prepare(`SELECT * FROM notifications WHERE json_extract(data, '$.entityId') = ?`).all(entityId);
}

function insertUser({ email, emailNotifications }) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, is_active, email_notifications, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
  ).run(id, email, 'hashed', 'Test User', 'agent', 'agent', emailNotifications ? 1 : 0, now, now);
  return id;
}

describe('Reminder Service', () => {
  beforeEach(() => {
    db.prepare(`DELETE FROM entities WHERE type IN ('Invoice', 'Trip')`).run();
    db.prepare(`DELETE FROM notifications`).run();
    // startReminderService() runs an immediate check() synchronously before
    // scheduling the interval, then we stop the interval so tests don't leak timers.
  });

  it('creates a notification for an invoice due within 3 days, using created_by from the JSON data blob', () => {
    const userId = 'user-abc';
    const invoiceId = insertEntity('Invoice', {
      invoice_number: 'INV-100',
      status: 'sent',
      due_date: daysFromNow(2),
      created_by: userId,
    });

    startReminderService();
    stopReminderService();

    const notes = notificationsFor(invoiceId);
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('invoice_due_soon');
    expect(notes[0].user_id).toBe(userId);
  });

  it('creates a notification for an overdue invoice', () => {
    const userId = 'user-def';
    const invoiceId = insertEntity('Invoice', {
      invoice_number: 'INV-200',
      status: 'sent',
      due_date: daysFromNow(-5),
      created_by: userId,
    });

    startReminderService();
    stopReminderService();

    const notes = notificationsFor(invoiceId);
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('invoice_overdue');
  });

  it('does not notify for invoices outside the due-soon/overdue window', () => {
    const invoiceId = insertEntity('Invoice', {
      invoice_number: 'INV-300',
      status: 'sent',
      due_date: daysFromNow(30),
      created_by: 'user-ghi',
    });

    startReminderService();
    stopReminderService();

    expect(notificationsFor(invoiceId)).toHaveLength(0);
  });

  it('does not notify for paid invoices even if overdue', () => {
    const invoiceId = insertEntity('Invoice', {
      invoice_number: 'INV-400',
      status: 'paid',
      due_date: daysFromNow(-5),
      created_by: 'user-jkl',
    });

    startReminderService();
    stopReminderService();

    expect(notificationsFor(invoiceId)).toHaveLength(0);
  });

  it('skips entities with no created_by instead of throwing', () => {
    const invoiceId = insertEntity('Invoice', {
      invoice_number: 'INV-500',
      status: 'sent',
      due_date: daysFromNow(-1),
      // no created_by
    });

    expect(() => {
      startReminderService();
      stopReminderService();
    }).not.toThrow();

    expect(notificationsFor(invoiceId)).toHaveLength(0);
  });

  it('creates a notification for a trip starting tomorrow', () => {
    const userId = 'user-mno';
    const tripId = insertEntity('Trip', {
      name: 'Safari Adventure',
      destination: 'Kenya',
      status: 'confirmed',
      start_date: daysFromNow(1),
      created_by: userId,
    });

    startReminderService();
    stopReminderService();

    const notes = notificationsFor(tripId);
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('trip_starting_soon');
    expect(notes[0].message).toContain('Safari Adventure');
  });

  it('escapes HTML in the emailed body but leaves the in-app notification message as plain text', () => {
    const userId = insertUser({ email: 'reminder-xss@example.com', emailNotifications: true });
    const tripId = insertEntity('Trip', {
      name: '<img src=x onerror=alert(1)>Safari',
      destination: 'Kenya',
      status: 'confirmed',
      start_date: daysFromNow(1),
      created_by: userId,
    });

    startReminderService();
    stopReminderService();

    const notes = notificationsFor(tripId);
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain('<img src=x onerror=alert(1)>Safari');

    const emailed = db.prepare('SELECT * FROM email_logs WHERE to_email = ?').all('reminder-xss@example.com');
    expect(emailed).toHaveLength(1);
    expect(emailed[0].body).not.toContain('<img src=x onerror=alert(1)>');
    expect(emailed[0].body).toContain('&lt;img src=x onerror=alert(1)&gt;Safari');
  });

  it('also emails a user who opted into email notifications', () => {
    const userId = insertUser({ email: 'reminder-opt-in@example.com', emailNotifications: true });
    const invoiceId = insertEntity('Invoice', {
      invoice_number: 'INV-700',
      status: 'sent',
      due_date: daysFromNow(1),
      created_by: userId,
    });

    startReminderService();
    stopReminderService();

    expect(notificationsFor(invoiceId)).toHaveLength(1);
    const emailed = db.prepare('SELECT * FROM email_logs WHERE to_email = ?').all('reminder-opt-in@example.com');
    expect(emailed).toHaveLength(1);
    expect(emailed[0].subject).toContain('INV-700');
  });

  it('does not email a user who has not opted in', () => {
    const userId = insertUser({ email: 'reminder-opt-out@example.com', emailNotifications: false });
    insertEntity('Invoice', {
      invoice_number: 'INV-800',
      status: 'sent',
      due_date: daysFromNow(1),
      created_by: userId,
    });

    startReminderService();
    stopReminderService();

    const emailed = db.prepare('SELECT * FROM email_logs WHERE to_email = ?').all('reminder-opt-out@example.com');
    expect(emailed).toHaveLength(0);
  });

  it('does not duplicate a notification already created within the last 24 hours', () => {
    const userId = 'user-pqr';
    const invoiceId = insertEntity('Invoice', {
      invoice_number: 'INV-600',
      status: 'sent',
      due_date: daysFromNow(1),
      created_by: userId,
    });

    startReminderService();
    stopReminderService();
    startReminderService();
    stopReminderService();

    expect(notificationsFor(invoiceId)).toHaveLength(1);
  });
});
