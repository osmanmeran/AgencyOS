import { getDb, uid } from '../db.js';
import { findEntities, updateEntity } from './entities.js';
import { NotFoundError, BadRequestError } from '../middleware/errors.js';
import { logAudit, AUDIT_ACTIONS } from './audit.js';

const TASK_TYPE = 'Task';
const ACTIVE_STATUSES = ['pending', 'in_progress'];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The operational tasks auto-generated for every booking, derived from the
 * Trip's departure date (`start_date`). `offsetDays` is subtracted from the
 * departure date to get the due date (`-30` => 30 days before departure).
 */
export const TASK_TEMPLATES = [
  {
    template_key: 'collect_final_balance',
    title: 'Collect Final Balance',
    offsetDays: 30,
    priority: 'high',
    describe: (trip) =>
      `Final balance collection for ${trip.client_name || 'client'}` +
      (trip.reference_number ? ` (${trip.reference_number})` : '') +
      ` — departure ${trip.start_date}.`,
  },
  {
    template_key: 'send_rooming_list',
    title: 'Send Rooming List to Hotel',
    offsetDays: 14,
    priority: 'medium',
    describe: (trip) =>
      `Prepare and send the rooming list to the hotel for ${trip.client_name || 'client'} ` +
      `ahead of departure ${trip.start_date}.`,
  },
  {
    template_key: 'issue_final_docs',
    title: 'Issue Tickets / Final Docs',
    offsetDays: 7,
    priority: 'critical',
    describe: (trip) =>
      `Issue final tickets / travel documents for ${trip.client_name || 'client'} ` +
      `before departure ${trip.start_date}.`,
  },
];

/**
 * SLA lead time before a task's due date at which it becomes "escalated"
 * (surfaces in the escalation queue / priority banner). Higher priority =
 * longer advance warning.
 */
const SLA_LEAD_MS = {
  low: 0,
  medium: 12 * 60 * 60 * 1000,
  high: 24 * 60 * 60 * 1000,
  critical: 48 * 60 * 60 * 1000,
};

// --- date helpers (UTC-based to avoid timezone off-by-one on date-only strings) ---

/** Add `deltaDays` to a `YYYY-MM-DD` string, returning `YYYY-MM-DD`. */
function addDaysYMD(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function dueDateForTemplate(trip, tpl) {
  return addDaysYMD(trip.start_date, -tpl.offsetDays);
}

function escalationTriggerFor(dueDateYmd, priority) {
  const lead = SLA_LEAD_MS[priority] || 0;
  if (!dueDateYmd) return null;
  return new Date(new Date(`${dueDateYmd}T00:00:00Z`).getTime() - lead).toISOString();
}

// --- low-level row access (system context: no per-row RLS, used by the engine) ---

function fetchTrip(bookingId) {
  const db = getDb();
  const row = db.prepare("SELECT id, data FROM entities WHERE type = 'Trip' AND id = ?").get(bookingId);
  if (!row) return null;
  return { id: row.id, ...JSON.parse(row.data) };
}

function findTaskByTemplate(bookingId, templateKey) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, data FROM entities WHERE type = ? AND json_extract(data, '$.booking_id') = ? AND json_extract(data, '$.template_key') = ?",
    )
    .get(TASK_TYPE, bookingId, templateKey);
  if (!row) return null;
  return { id: row.id, ...JSON.parse(row.data) };
}

function findTasksForBooking(bookingId) {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, data FROM entities WHERE type = ? AND json_extract(data, '$.booking_id') = ?")
    .all(TASK_TYPE, bookingId);
  return rows.map((r) => ({ id: r.id, ...JSON.parse(r.data) }));
}

function insertTask(task, actor) {
  const db = getDb();
  const id = uid();
  const now = new Date().toISOString();
  const data = { ...task, created_by: actor?.id || 'system' };
  delete data.id;
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    TASK_TYPE,
    JSON.stringify(data),
    now,
    now,
  );
  return { id, ...data, created_date: now, updated_date: now };
}

function patchTask(id, patch) {
  const db = getDb();
  const now = new Date().toISOString();
  const row = db.prepare('SELECT data FROM entities WHERE id = ?').get(id);
  if (!row) return null;
  const data = { ...JSON.parse(row.data), ...patch };
  db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(data), now, id);
  return { id, ...data, updated_date: now };
}

// --- public API ---

/**
 * Auto-generate the three operational tasks for a booking, idempotently.
 *
 * - If a task with the same `(booking_id, template_key)` already exists and is
 *   still active, its due date / SLA window are resynced to the current
 *   departure date (so editing the Trip updates the tasks).
 * - Completed/cancelled tasks are left alone (never resurrected).
 * - Tasks are attributed to `actor` (the booking's creator) via `created_by`,
 *   and pre-assigned to that user.
 *
 * Returns the array of newly created tasks. Safe to call on both create and
 * update of a Trip; a missing/blank `start_date` is a no-op.
 *
 * @param {string} bookingId - Trip id.
 * @param {{id?: string, name?: string}} [actor] - User triggering generation.
 * @returns {object[]} The created task records.
 */
export function generateTasksForBooking(bookingId, actor = { id: 'system' }) {
  const trip = fetchTrip(bookingId);
  if (!trip || !trip.start_date) return [];

  const db = getDb();
  const created = [];
  const tx = db.transaction(() => {
    for (const tpl of TASK_TEMPLATES) {
      const dueDate = dueDateForTemplate(trip, tpl);
      const escalationTrigger = escalationTriggerFor(dueDate, tpl.priority);
      const existing = findTaskByTemplate(bookingId, tpl.template_key);

      if (existing) {
        if (ACTIVE_STATUSES.includes(existing.status)) {
          patchTask(existing.id, {
            due_date: dueDate,
            escalation_trigger_time: escalationTrigger,
            priority: tpl.priority,
            is_escalated: false,
          });
        }
        continue;
      }

      created.push(
        insertTask(
          {
            template_key: tpl.template_key,
            title: tpl.title,
            description: tpl.describe(trip),
            status: 'pending',
            priority: tpl.priority,
            due_date: dueDate,
            booking_id: bookingId,
            customer_id: trip.client_id || null,
            supplier_id: trip.supplier_id || null,
            assigned_to_user_id: trip.created_by || null,
            assigned_to_team_id: null,
            escalation_trigger_time: escalationTrigger,
            is_escalated: false,
          },
          actor,
        ),
      );
    }
  });
  tx();
  return created;
}

/**
 * Recompute due dates + SLA windows for every *auto-generated* task of a
 * booking when its departure date changes. Manual tasks (no `template_key`)
 * keep their own due dates. Idempotent and best-effort: completed/cancelled
 * tasks are skipped.
 *
 * @param {string} bookingId - Trip id.
 * @returns {{ rescheduled: number }}
 */
export function rescheduleTasksForBooking(bookingId) {
  const trip = fetchTrip(bookingId);
  if (!trip || !trip.start_date) return { rescheduled: 0 };

  const db = getDb();
  const tasks = findTasksForBooking(bookingId);
  const tx = db.transaction(() => {
    for (const task of tasks) {
      if (!ACTIVE_STATUSES.includes(task.status)) continue;
      const tpl = TASK_TEMPLATES.find((t) => t.template_key === task.template_key);
      if (!tpl) continue; // manual task — leave its due date untouched
      const dueDate = dueDateForTemplate(trip, tpl);
      patchTask(task.id, {
        due_date: dueDate,
        escalation_trigger_time: escalationTriggerFor(dueDate, tpl.priority),
        is_escalated: false,
      });
    }
  });
  tx();
  const rescheduled = tasks.filter(
    (t) => ACTIVE_STATUSES.includes(t.status) && TASK_TEMPLATES.some((x) => x.template_key === t.template_key),
  ).length;
  return { rescheduled };
}

/**
 * Mark a task completed and write an audit entry. Reuses the generic entity
 * update (permission + RLS checked against `actor`).
 *
 * @param {string} taskId
 * @param {{id?: string, name?: string, ip?: string}} actor
 * @param {string} [note]
 * @returns {object} The updated task.
 */
export function completeTask(taskId, actor, note) {
  const patch = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    is_escalated: false,
  };
  if (note) patch.completion_note = note;
  const updated = updateEntity(TASK_TYPE, taskId, patch, actor);
  logAudit({
    userId: actor?.id,
    userName: actor?.name,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: TASK_TYPE,
    entityId: taskId,
    changes: { status: 'completed', completion_note: note || null },
    ip: actor?.ip,
  });
  return updated;
}

/** Attach live SLA flags used by the UI (overdue / due-soon / escalated). */
export function enrichTask(task, now = Date.now()) {
  const dueTs = task.due_date ? new Date(`${task.due_date}T00:00:00Z`).getTime() : null;
  const active = ACTIVE_STATUSES.includes(task.status);
  const isOverdue = active && dueTs != null && dueTs < now;
  const msToDue = dueTs != null ? dueTs - now : null;
  const isDueSoon = active && msToDue != null && msToDue >= 0 && msToDue <= DAY_MS;
  const escTs = task.escalation_trigger_time ? new Date(task.escalation_trigger_time).getTime() : null;
  const isEscalated = active && (task.is_escalated === true || (escTs != null && escTs <= now));
  return { ...task, is_overdue: isOverdue, is_due_soon: isDueSoon, is_escalated: isEscalated };
}

/**
 * List tasks with the contextual filters the UI needs.
 *
 * Direct equality filters (`booking_id`, `customer_id`, `supplier_id`,
 * `assigned_to_user_id`, `status`, `priority`) are pushed into SQL via
 * `findEntities`. `overdue` / `escalated` are derived flags, so they are
 * computed after fetch (and force a full fetch before any pagination).
 *
 * @returns {object[] | {data: object[], total: number}}
 */
export function listTasks({
  booking_id,
  customer_id,
  supplier_id,
  assigned_to_user_id,
  status,
  priority,
  overdue,
  escalated,
  sort,
  limit,
  offset,
  user,
} = {}) {
  const filter = {};
  if (booking_id) filter.booking_id = booking_id;
  if (customer_id) filter.customer_id = customer_id;
  if (supplier_id) filter.supplier_id = supplier_id;
  if (assigned_to_user_id) filter.assigned_to_user_id = assigned_to_user_id;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  // Derived filters need the full set first; otherwise honor SQL pagination.
  const needsPostFilter = overdue || escalated;
  const result = findEntities(TASK_TYPE, {
    filter: JSON.stringify(filter),
    sort,
    limit: needsPostFilter ? undefined : limit,
    offset: needsPostFilter ? undefined : offset,
    user,
  });

  const now = Date.now();
  let items = (Array.isArray(result) ? result : result.data).map((t) => enrichTask(t, now));
  if (overdue) items = items.filter((t) => t.is_overdue);
  if (escalated) items = items.filter((t) => t.is_escalated);

  if (Array.isArray(result)) return items;

  // Paginate the post-filtered array to mirror the { data, total } envelope.
  const total = items.length;
  if (limit !== undefined || offset !== undefined) {
    const start = offset !== undefined ? Number(offset) : 0;
    const size = limit !== undefined ? Number(limit) : items.length;
    return { data: items.slice(start, start + size), total };
  }
  return { data: items, total };
}

/** Convenience: tasks linked to a single booking (the Contextual Task Widget). */
export function getTasksForBooking(bookingId, user) {
  return listTasks({ booking_id: bookingId, user });
}
