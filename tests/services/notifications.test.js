import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../server/db.js';

const db = getDb();

// Clean up before each test
function cleanTable(table) {
  db.prepare(`DELETE FROM ${table}`).run();
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
});
