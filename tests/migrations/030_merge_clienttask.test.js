import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as migration from '../../server/migrations/030_merge_clienttask_into_task.js';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_date TEXT,
    updated_date TEXT
  )`);
  db.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL
  )`);
  return db;
}

function insertClientTask(db, id, data) {
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'ClientTask',
    JSON.stringify(data),
    'now',
    'now',
  );
}

function insertTask(db, id, data) {
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'Task',
    JSON.stringify(data),
    'now',
    'now',
  );
}

function insertUser(db, id, email) {
  db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(id, email);
}

function row(db, id) {
  const r = db.prepare('SELECT type, data FROM entities WHERE id = ?').get(id);
  return { ...JSON.parse(r.data), entityType: r.type };
}

function taskRows(db) {
  return db
    .prepare("SELECT id, data FROM entities WHERE type = 'Task'")
    .all()
    .map((r) => ({ id: r.id, ...JSON.parse(r.data) }));
}

describe('030 merge ClientTask into Task', () => {
  let db;
  beforeEach(() => {
    db = makeDb();
  });

  it('retypes ClientTask rows to Task and remaps client_id to customer_id', () => {
    insertClientTask(db, 'ct1', { title: 'Send docs', client_id: 'client-1', status: 'pending', type: 'task' });

    migration.up(db);

    const r = row(db, 'ct1');
    expect(r.entityType).toBe('Task');
    expect(r.customer_id).toBe('client-1');
    expect(r.client_id).toBeUndefined();
  });

  it('maps status "done" to "completed", passes through pending/in_progress unchanged', () => {
    insertClientTask(db, 'done1', { title: 'A', status: 'done' });
    insertClientTask(db, 'pending1', { title: 'B', status: 'pending' });
    insertClientTask(db, 'progress1', { title: 'C', status: 'in_progress' });

    migration.up(db);

    expect(row(db, 'done1').status).toBe('completed');
    expect(row(db, 'pending1').status).toBe('pending');
    expect(row(db, 'progress1').status).toBe('in_progress');
  });

  it('resolves assigned_to email to assigned_to_user_id via the users table', () => {
    insertUser(db, 'user-42', 'agent@example.com');
    insertClientTask(db, 'assigned1', { title: 'Follow up', assigned_to: 'agent@example.com', status: 'pending' });
    insertClientTask(db, 'assigned2', { title: 'Follow up 2', assigned_to: 'AGENT@EXAMPLE.COM', status: 'pending' });

    migration.up(db);

    expect(row(db, 'assigned1').assigned_to_user_id).toBe('user-42');
    expect(row(db, 'assigned1').assigned_to).toBeUndefined();
    // case-insensitive email match
    expect(row(db, 'assigned2').assigned_to_user_id).toBe('user-42');
  });

  it('leaves assigned_to_user_id null when the assignee email has no matching user', () => {
    insertClientTask(db, 'orphan1', { title: 'Orphaned', assigned_to: 'gone@example.com', status: 'pending' });

    migration.up(db);

    expect(row(db, 'orphan1').assigned_to_user_id).toBeNull();
  });

  it('preserves type (task/reminder/note), title, description, due_date, priority, created_by', () => {
    insertClientTask(db, 'full1', {
      title: 'Call client',
      description: 'Discuss itinerary',
      type: 'reminder',
      due_date: '2026-09-01',
      priority: 'high',
      created_by: 'creator-1',
    });

    migration.up(db);

    const r = row(db, 'full1');
    expect(r.title).toBe('Call client');
    expect(r.description).toBe('Discuss itinerary');
    expect(r.type).toBe('reminder');
    expect(r.due_date).toBe('2026-09-01');
    expect(r.priority).toBe('high');
    expect(r.created_by).toBe('creator-1');
  });

  it('does not touch existing native Task rows', () => {
    insertTask(db, 'native1', { title: 'Collect Final Balance', status: 'pending', booking_id: 'trip-1' });

    migration.up(db);

    expect(taskRows(db)).toHaveLength(1);
    expect(row(db, 'native1').booking_id).toBe('trip-1');
  });

  it('is idempotent — running twice does not error or duplicate', () => {
    insertClientTask(db, 'idem1', { title: 'X', status: 'pending' });
    migration.up(db);
    migration.up(db);
    expect(taskRows(db)).toHaveLength(1);
  });
});
