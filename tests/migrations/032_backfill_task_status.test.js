import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as migration from '../../server/migrations/031_backfill_task_status.js';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_date TEXT,
    updated_date TEXT
  )`);
  return db;
}

function insert(db, id, type, data) {
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    type,
    typeof data === 'string' ? data : JSON.stringify(data),
    'now',
    'now',
  );
}

function data(db, id) {
  return JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(id).data);
}

describe('migration 031: backfill Task status', () => {
  /** @type {any} */
  let db;
  beforeEach(() => {
    db = makeDb();
  });

  it('sets pending on a task stored without a status', () => {
    insert(db, 't1', 'Task', { title: 'Hand-made task', priority: 'medium' });
    migration.up(db);
    expect(data(db, 't1').status).toBe('pending');
    expect(data(db, 't1').title).toBe('Hand-made task');
  });

  it('sets completed when the task was already ticked off', () => {
    insert(db, 't2', 'Task', { title: 'Done long ago', completed_at: '2026-01-01T00:00:00.000Z' });
    migration.up(db);
    expect(data(db, 't2').status).toBe('completed');
  });

  it('treats an empty-string status the same as a missing one', () => {
    insert(db, 't3', 'Task', { title: 'Blank status', status: '' });
    migration.up(db);
    expect(data(db, 't3').status).toBe('pending');
  });

  it('leaves tasks that already have a status alone', () => {
    insert(db, 't4', 'Task', { title: 'In flight', status: 'in_progress' });
    insert(db, 't5', 'Task', { title: 'Cancelled', status: 'cancelled' });
    migration.up(db);
    expect(data(db, 't4').status).toBe('in_progress');
    expect(data(db, 't5').status).toBe('cancelled');
  });

  it('ignores other entity types', () => {
    insert(db, 'c1', 'Client', { name: 'Acme' });
    migration.up(db);
    expect(data(db, 'c1').status).toBeUndefined();
  });

  it('skips a malformed row instead of throwing', () => {
    insert(db, 'bad', 'Task', 'not json at all');
    insert(db, 'ok', 'Task', { title: 'Fine' });
    expect(() => migration.up(db)).not.toThrow();
    expect(data(db, 'ok').status).toBe('pending');
  });

  it('is idempotent', () => {
    insert(db, 't6', 'Task', { title: 'Twice' });
    migration.up(db);
    migration.up(db);
    expect(data(db, 't6').status).toBe('pending');
  });
});
