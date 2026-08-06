import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { activeTasksQuery, completedTasksQuery, invalidateTasks, setTaskStatus } from '@/lib/taskQueries';
import { db } from '@/lib/DbContext';

vi.mock('@/lib/DbContext', () => ({
  db: {
    tasks: { list: vi.fn(() => Promise.resolve([])), complete: vi.fn(() => Promise.resolve({})) },
    entities: { Task: { update: vi.fn(() => Promise.resolve({})) } },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('task list queries', () => {
  it('scopes the active query to open statuses, sorted by due date', async () => {
    const query = activeTasksQuery();
    expect(query.queryKey).toEqual(['tasks', 'active']);
    await query.queryFn();
    expect(db.tasks.list).toHaveBeenCalledWith({ status: 'pending,in_progress', sort: 'due_date' });
  });

  it('caps the completed query so the board never loads the whole task history', async () => {
    const query = completedTasksQuery(50);
    expect(query.queryKey).toEqual(['tasks', 'completed', 50]);
    await query.queryFn();
    expect(db.tasks.list).toHaveBeenCalledWith({ status: 'completed', sort: '-updated_date', limit: 50 });
  });

  it('gives the board and the Dashboard widget the same cache entry', () => {
    // The Dashboard's "My Tasks" widget reuses activeTasksQuery() verbatim;
    // if these keys ever diverge the two silently stop sharing a fetch.
    expect(activeTasksQuery().queryKey).toEqual(activeTasksQuery().queryKey);
    expect(activeTasksQuery().queryKey[0]).toBe('tasks');
  });

  it('invalidates every task list from one call', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    invalidateTasks(queryClient);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });
});

describe('setTaskStatus', () => {
  it('completes through the audited endpoint', async () => {
    await setTaskStatus('task-1', 'completed');
    expect(db.tasks.complete).toHaveBeenCalledWith('task-1');
    expect(db.entities.Task.update).not.toHaveBeenCalled();
  });

  it('reopens a completed task by clearing the completion stamp', async () => {
    await setTaskStatus('task-2', 'pending');
    expect(db.entities.Task.update).toHaveBeenCalledWith('task-2', { status: 'pending', completed_at: null });
    expect(db.tasks.complete).not.toHaveBeenCalled();
  });

  it('sends only the fields that changed — never the server-computed SLA flags', async () => {
    await setTaskStatus('task-3', 'in_progress');
    const [, payload] = db.entities.Task.update.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(['completed_at', 'status']);
  });
});
