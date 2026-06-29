import { getDb, uid } from '../db.js';
import logger from '../lib/logger.js';

// WebSocket hub — set by server.js after HTTP server starts
let broadcast = null;

export function setBroadcastFn(fn) {
  broadcast = fn;
}

export function createNotification({ userId, type, title, message, data } = {}) {
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
