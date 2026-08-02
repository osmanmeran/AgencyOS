import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import { checkEscalations } from '../../server/services/tasks.js';

const db = getDb();

function insertTask(data) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'Task',
    JSON.stringify(data),
    now,
    now,
  );
  return id;
}

function getTaskData(id) {
  const row = db.prepare('SELECT data FROM entities WHERE id = ?').get(id);
  return JSON.parse(row.data);
}

function notificationsFor(taskId) {
  return db.prepare(`SELECT * FROM notifications WHERE json_extract(data, '$.entityId') = ?`).all(taskId);
}

function insertUser({ email, tier, emailNotifications, managerId, isActive = true }) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, is_active, email_notifications, manager_id, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    email,
    'hashed',
    'Test User',
    tier,
    tier,
    isActive ? 1 : 0,
    emailNotifications ? 1 : 0,
    managerId || null,
    now,
    now,
  );
  return id;
}

function hoursFromNow(n) {
  return new Date(Date.now() + n * 60 * 60 * 1000).toISOString();
}

describe('Task escalation check', () => {
  beforeEach(() => {
    db.prepare(`DELETE FROM entities WHERE type = 'Task'`).run();
    db.prepare(`DELETE FROM notifications`).run();
    db.prepare(`DELETE FROM users`).run();
  });

  it('escalates a task whose escalation window has passed and notifies the assignee', () => {
    const assigneeId = insertUser({ email: 'assignee@example.com', tier: 'agent' });
    const taskId = insertTask({
      title: 'Collect Final Balance',
      status: 'pending',
      due_date: '2026-01-01',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
      assigned_to_user_id: assigneeId,
      booking_id: 'trip-1',
    });

    const count = checkEscalations();

    expect(count).toBe(1);
    expect(getTaskData(taskId).is_escalated).toBe(true);
    const notes = notificationsFor(taskId);
    expect(notes.some((n) => n.user_id === assigneeId)).toBe(true);
    expect(notes[0].type).toBe('task_escalated');
  });

  it('also notifies every manager/admin in the tenant, not just the assignee', () => {
    const assigneeId = insertUser({ email: 'assignee2@example.com', tier: 'agent' });
    const managerId = insertUser({ email: 'manager@example.com', tier: 'manager' });
    const adminId = insertUser({ email: 'admin@example.com', tier: 'admin' });
    insertUser({ email: 'other-agent@example.com', tier: 'agent' });

    const taskId = insertTask({
      title: 'Issue Tickets',
      status: 'pending',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
      assigned_to_user_id: assigneeId,
    });

    checkEscalations();

    const recipientIds = notificationsFor(taskId).map((n) => n.user_id);
    expect(recipientIds).toEqual(expect.arrayContaining([assigneeId, managerId, adminId]));
    expect(recipientIds).not.toContain('other-agent@example.com');
  });

  it('does not escalate a task before its trigger time', () => {
    const taskId = insertTask({
      title: 'Send Rooming List',
      status: 'pending',
      escalation_trigger_time: hoursFromNow(5),
      is_escalated: false,
    });

    expect(checkEscalations()).toBe(0);
    expect(getTaskData(taskId).is_escalated).toBe(false);
    expect(notificationsFor(taskId)).toHaveLength(0);
  });

  it('does not re-escalate a task already flagged is_escalated, even on repeated calls', () => {
    const taskId = insertTask({
      title: 'Already escalated',
      status: 'pending',
      escalation_trigger_time: hoursFromNow(-2),
      is_escalated: true,
    });

    checkEscalations();
    checkEscalations();

    expect(notificationsFor(taskId)).toHaveLength(0);
  });

  it('does not notify twice across separate ticks for the same task', () => {
    const assigneeId = insertUser({ email: 'assignee3@example.com', tier: 'agent' });
    const taskId = insertTask({
      title: 'Confirm supplier payment',
      status: 'pending',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
      assigned_to_user_id: assigneeId,
    });

    checkEscalations();
    checkEscalations();

    expect(notificationsFor(taskId)).toHaveLength(1);
  });

  it('skips completed and cancelled tasks even if their escalation window has passed', () => {
    const completedId = insertTask({
      title: 'Done task',
      status: 'completed',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
    });
    const cancelledId = insertTask({
      title: 'Cancelled task',
      status: 'cancelled',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
    });

    expect(checkEscalations()).toBe(0);
    expect(notificationsFor(completedId)).toHaveLength(0);
    expect(notificationsFor(cancelledId)).toHaveLength(0);
  });

  it('escapes HTML in the emailed body but leaves the in-app message as plain text', () => {
    const assigneeId = insertUser({
      email: 'escalation-xss@example.com',
      tier: 'agent',
      emailNotifications: true,
    });
    insertTask({
      title: '<img src=x onerror=alert(1)>Collect Balance',
      status: 'pending',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
      assigned_to_user_id: assigneeId,
    });

    checkEscalations();

    const note = db.prepare('SELECT * FROM notifications WHERE user_id = ?').get(assigneeId);
    expect(note.message).toContain('<img src=x onerror=alert(1)>Collect Balance');

    const emailed = db.prepare('SELECT * FROM email_logs WHERE to_email = ?').all('escalation-xss@example.com');
    expect(emailed).toHaveLength(1);
    expect(emailed[0].body).not.toContain('<img src=x onerror=alert(1)>');
    expect(emailed[0].body).toContain('&lt;img src=x onerror=alert(1)&gt;Collect Balance');
  });

  it('links the notification to the booking when the task has one', () => {
    const assigneeId = insertUser({ email: 'assignee4@example.com', tier: 'agent' });
    insertTask({
      title: 'Booking-linked task',
      status: 'pending',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
      assigned_to_user_id: assigneeId,
      booking_id: 'trip-42',
    });

    checkEscalations();

    const note = db.prepare('SELECT * FROM notifications WHERE user_id = ?').get(assigneeId);
    const data = JSON.parse(note.data);
    expect(data.url).toBe('/ReservationDetails?id=trip-42');
  });

  it('notifies only the assignee and their configured manager, not every admin/manager, when manager_id is set', () => {
    const managerId = insertUser({ email: 'direct-manager@example.com', tier: 'manager' });
    const otherManagerId = insertUser({ email: 'unrelated-manager@example.com', tier: 'manager' });
    const adminId = insertUser({ email: 'admin@example.com', tier: 'admin' });
    const assigneeId = insertUser({ email: 'assignee5@example.com', tier: 'agent', managerId });

    const taskId = insertTask({
      title: 'Targeted escalation',
      status: 'pending',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
      assigned_to_user_id: assigneeId,
    });

    checkEscalations();

    const recipientIds = notificationsFor(taskId).map((n) => n.user_id);
    expect(recipientIds.sort()).toEqual([assigneeId, managerId].sort());
    expect(recipientIds).not.toContain(otherManagerId);
    expect(recipientIds).not.toContain(adminId);
  });

  it('falls back to broadcasting to every admin/manager when manager_id points to a deactivated or demoted user', () => {
    const staleManagerId = insertUser({ email: 'demoted@example.com', tier: 'agent' }); // no longer a manager
    const adminId = insertUser({ email: 'fallback-admin@example.com', tier: 'admin' });
    const assigneeId = insertUser({ email: 'assignee6@example.com', tier: 'agent', managerId: staleManagerId });

    const taskId = insertTask({
      title: 'Stale manager escalation',
      status: 'pending',
      escalation_trigger_time: hoursFromNow(-1),
      is_escalated: false,
      assigned_to_user_id: assigneeId,
    });

    checkEscalations();

    const recipientIds = notificationsFor(taskId).map((n) => n.user_id);
    expect(recipientIds).toContain(assigneeId);
    expect(recipientIds).toContain(adminId);
    expect(recipientIds).not.toContain(staleManagerId);
  });
});
