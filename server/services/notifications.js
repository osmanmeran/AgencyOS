import { getDb, uid } from '../db.js';
import logger from '../lib/logger.js';
import { sendEmail } from './email.js';

// WebSocket hub — set by server.js after HTTP server starts
let broadcast = null;

export function setBroadcastFn(fn) {
  broadcast = fn;
}

// Fire-and-forget: mirrors a notification to email for users who opted in.
// Failures are logged, never thrown — a broken email send must not break
// the in-app notification it's attached to.
function maybeSendEmail(userId, email) {
  if (!email) return;
  const db = getDb();
  const user = db.prepare('SELECT email, email_notifications FROM users WHERE id = ?').get(userId);
  if (!user || !user.email_notifications || !user.email) return;

  sendEmail({ to: user.email, subject: email.subject, body: email.body })
    .catch(err => logger.error({ err: err.message, userId }, 'Failed to send notification email'));
}

export function createNotification({ userId, type, title, message, data, email } = {}) {
  const db = getDb();
  const id = uid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data, read, created_date)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, userId, type || 'info', title, message || '', data ? JSON.stringify(data) : null, now);

  const notification = { id, userId, type: type || 'info', title, message, data, read: false, created_date: now };

  if (broadcast) {
    try { broadcast(userId, notification); } catch (err) { logger.error({ err }, 'Broadcast failed'); }
  }

  maybeSendEmail(userId, email);

  return notification;
}

export function getUnreadCount(userId) {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(userId);
  return row.count;
}

export function getNotifications(userId, { limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_date DESC LIMIT ? OFFSET ?
  `).all(userId, limit, offset);
  return rows.map(n => ({ ...n, data: n.data ? JSON.parse(n.data) : null, read: !!n.read }));
}

export function markRead(id) {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}

export function markAllRead(userId) {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(userId);
}
