import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import { listTasks } from '../../server/services/tasks.js';

const db = getDb();
const admin = { user_tier: 'admin', id: 'admin-list', custom_permissions: [] };
// Staff reads of Task are unconditional, so they take findEntities' SQL path.
// A portal user is row-scoped, which drops to the JS filter path — the
// multi-status filter has to produce the same result on both.
const portalUser = { user_tier: 'client', id: 'portal-list', client_id: 'client-1', custom_permissions: [] };

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

function titles(result) {
  return (Array.isArray(result) ? result : result.data).map((t) => t.title).sort();
}

describe('listTasks status filtering', () => {
  beforeEach(() => {
    db.prepare("DELETE FROM entities WHERE type = 'Task'").run();
    insertTask({ title: 'open', status: 'pending', created_by: portalUser.id });
    insertTask({ title: 'started', status: 'in_progress', created_by: portalUser.id });
    insertTask({ title: 'finished', status: 'completed', created_by: portalUser.id });
    insertTask({ title: 'dropped', status: 'cancelled', created_by: portalUser.id });
  });

  it('filters to a single status', () => {
    expect(titles(listTasks({ status: 'pending', user: admin }))).toEqual(['open']);
  });

  it('accepts a comma-separated list of statuses', () => {
    expect(titles(listTasks({ status: 'pending,in_progress', user: admin }))).toEqual(['open', 'started']);
  });

  it('applies the same list filter on the row-scoped (non-SQL) read path', () => {
    expect(titles(listTasks({ status: 'pending,in_progress', user: portalUser }))).toEqual(['open', 'started']);
  });

  it('tolerates whitespace and a trailing comma', () => {
    expect(titles(listTasks({ status: 'pending, in_progress,', user: admin }))).toEqual(['open', 'started']);
  });

  it('paginates a single-status query and reports the unpaginated total', () => {
    const result = listTasks({ status: 'completed', limit: 1, user: admin });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('supports comma-separated priority and type filters too', () => {
    db.prepare("DELETE FROM entities WHERE type = 'Task'").run();
    insertTask({ title: 'a', status: 'pending', priority: 'low', type: 'task' });
    insertTask({ title: 'b', status: 'pending', priority: 'critical', type: 'note' });
    insertTask({ title: 'c', status: 'pending', priority: 'medium', type: 'reminder' });

    expect(titles(listTasks({ priority: 'low,critical', user: admin }))).toEqual(['a', 'b']);
    expect(titles(listTasks({ type: 'note,reminder', user: admin }))).toEqual(['b', 'c']);
  });
});
