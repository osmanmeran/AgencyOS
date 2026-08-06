import { db } from '@/lib/DbContext';

/**
 * Shared React Query descriptors for the Task list.
 *
 * The Task Board and the Dashboard's "My Tasks" widget want the same rows —
 * every open task — so they share one cache entry rather than each fetching
 * their own copy. Keeping the key and the fetch together in one place is what
 * makes that true: they previously agreed only by a comment, which quietly
 * stopped holding the moment one of them changed its query.
 *
 * Both queries are scoped server-side. A workspace auto-generates up to nine
 * tasks per booking, so "list every task" grows without bound; open tasks and
 * a recent page of completed ones do not.
 */

/** Every open (pending / in-progress) task, due soonest first. */
export function activeTasksQuery() {
  return {
    queryKey: ['tasks', 'active'],
    queryFn: () => db.tasks.list({ status: 'pending,in_progress', sort: 'due_date' }),
  };
}

/** The most recently updated page of completed tasks (a `{ data, total }` envelope). */
export function completedTasksQuery(limit) {
  return {
    queryKey: ['tasks', 'completed', limit],
    queryFn: () => db.tasks.list({ status: 'completed', sort: '-updated_date', limit }),
  };
}

/** Invalidate every task list at once, from anywhere that mutates a task. */
export function invalidateTasks(queryClient) {
  return queryClient.invalidateQueries({ queryKey: ['tasks'] });
}

/**
 * Move a task to `status` (what dragging a board card between columns does).
 *
 * Completing goes through the audited `/complete` endpoint so a board
 * completion is logged the same way one from a booking's task panel is; a
 * plain entity write would silently skip the audit trail. Every other
 * transition sends just the two fields that changed — echoing the whole task
 * back would also send the SLA flags the server computed on read.
 */
export function setTaskStatus(id, status) {
  if (status === 'completed') return db.tasks.complete(id);
  return db.entities.Task.update(id, { status, completed_at: null });
}
