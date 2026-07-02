import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, uid } from '../../server/db.js';

const db = getDb();

// Clean up before each test
function cleanTable(table) {
  db.prepare(`DELETE FROM ${table}`).run();
}

function insertUser({ email, emailNotifications }) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, is_active, email_notifications, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)'
  ).run(id, email, 'hashed', 'Test User', 'agent', 'agent', emailNotifications ? 1 : 0, now, now);
  return id;
}

import {
  createNotification, getUnreadCount, getNotifications, markRead, markAllRead,
} from '../../server/services/notifications.js';

describe('Notifications Service', () => {
  beforeAll(() => cleanTable('notifications'));

  it('should create a notification', () => {
    const n = createNotification({ userId: 'user1', type: 'info', title: 'Test', message: 'Hello' });
    expect(n.id).toBeTruthy();
    expect(n.userId).toBe('user1');
    expect(n.title).toBe('Test');
  });

  it('should return unread count', () => {
    expect(getUnreadCount('user1')).toBeGreaterThanOrEqual(1);
  });

  it('should list notifications', () => {
    const list = getNotifications('user1', { limit: 10 });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].title).toBe('Test');
    expect(list[0].data).toBeNull();
  });

  it('should mark notification as read', () => {
    const list = getNotifications('user1', { limit: 10 });
    const unread = list.find(n => !n.read);
    if (unread) {
      markRead(unread.id);
      const updated = getNotifications('user1', { limit: 10 });
      const found = updated.find(n => n.id === unread.id);
      expect(found.read).toBe(true);
    }
  });

  it('should mark all as read', () => {
    createNotification({ userId: 'user2', title: 'Unread', message: 'test' });
    markAllRead('user2');
    expect(getUnreadCount('user2')).toBe(0);
  });

  describe('email opt-in', () => {
    function emailLogsFor(subject) {
      return db.prepare('SELECT * FROM email_logs WHERE subject = ?').all(subject);
    }

    it('emails the user when they opted into email notifications', () => {
      const userId = insertUser({ email: 'opted-in@example.com', emailNotifications: true });
      const subject = `Invoice due soon ${userId}`;

      createNotification({
        userId, type: 'invoice_due_soon', title: subject, message: 'Invoice INV-1 is due soon',
        email: { subject, body: 'Invoice INV-1 is due soon' },
      });

      const logs = emailLogsFor(subject);
      expect(logs).toHaveLength(1);
      expect(logs[0].to_email).toBe('opted-in@example.com');
    });

    it('does not email a user who has not opted in', () => {
      const userId = insertUser({ email: 'opted-out@example.com', emailNotifications: false });
      const subject = `Invoice overdue ${userId}`;

      createNotification({
        userId, type: 'invoice_overdue', title: subject, message: 'Invoice INV-2 is overdue',
        email: { subject, body: 'Invoice INV-2 is overdue' },
      });

      expect(emailLogsFor(subject)).toHaveLength(0);
    });

    it('does not email when the notification has no email payload, even if opted in', () => {
      const userId = insertUser({ email: 'no-payload@example.com', emailNotifications: true });
      const subject = `No email payload ${userId}`;

      createNotification({ userId, type: 'info', title: subject, message: 'In-app only' });

      expect(emailLogsFor(subject)).toHaveLength(0);
    });

    it('does not throw when the notification targets a nonexistent user', () => {
      expect(() => createNotification({
        userId: 'nonexistent-user', type: 'info', title: 'x', message: 'x',
        email: { subject: 'x', body: 'x' },
      })).not.toThrow();
    });
  });
});
