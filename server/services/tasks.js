import { getDb, uid } from '../db.js';
import { findEntities, updateEntity } from './entities.js';
import { logAudit, AUDIT_ACTIONS } from './audit.js';
import { createNotification } from './notifications.js';
import { escapeHtml } from './email.js';
import logger from '../lib/logger.js';

const TASK_TYPE = 'Task';
const ACTIVE_STATUSES = ['pending', 'in_progress'];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The operational tasks auto-generated for every booking. Each template is
 * anchored to one of the Trip's dates (`anchor`) and offset by a signed
 * number of days (`offsetDays`: negative = before the anchor, positive =
 * after). `department` restricts the template to trips in that department
 * (`AppSettings.departments`); '' / null applies to every department.
 *
 * This is also the fallback used when the workspace hasn't customized
 * `AppSettings.task_templates` (see {@link getTaskTemplates}) — admins can
 * add/edit/remove templates from Settings > Task Templates without touching
 * code.
 */
export const DEFAULT_TASK_TEMPLATES = [
  {
    template_key: 'collect_deposit',
    title: 'Collect Deposit',
    anchor: 'created_date',
    offsetDays: 3,
    priority: 'high',
    department: '',
    description: 'Collect the initial deposit from {client_name} to confirm the booking.',
  },
  {
    template_key: 'travel_insurance_window',
    title: 'Follow Up on Travel Insurance',
    anchor: 'created_date',
    offsetDays: 14,
    priority: 'medium',
    department: '',
    description:
      'Follow up with {client_name} about purchasing travel insurance while "cancel for any reason" coverage is still available.',
  },
  {
    template_key: 'visa_document_deadline',
    title: 'Confirm Visa / Travel Documents',
    anchor: 'start_date',
    offsetDays: -45,
    priority: 'high',
    department: '',
    description: 'Confirm {client_name} has valid visas/travel documents for {destination} — departure {start_date}.',
  },
  {
    template_key: 'supplier_payment_due',
    title: 'Pay Supplier Balance',
    anchor: 'start_date',
    offsetDays: -21,
    priority: 'high',
    department: '',
    description:
      "Pay the outstanding supplier balance for {client_name}'s {destination} booking before departure {start_date}.",
  },
  {
    template_key: 'collect_final_balance',
    title: 'Collect Final Balance',
    anchor: 'start_date',
    offsetDays: -30,
    priority: 'high',
    department: '',
    description: 'Final balance collection for {client_name} — departure {start_date}.',
  },
  {
    template_key: 'send_rooming_list',
    title: 'Send Rooming List to Hotel',
    anchor: 'start_date',
    offsetDays: -14,
    priority: 'medium',
    department: '',
    description: 'Prepare and send the rooming list to the hotel for {client_name} ahead of departure {start_date}.',
  },
  {
    template_key: 'issue_final_docs',
    title: 'Issue Tickets / Final Docs',
    anchor: 'start_date',
    offsetDays: -7,
    priority: 'critical',
    department: '',
    description: 'Issue final tickets / travel documents for {client_name} before departure {start_date}.',
  },
  {
    template_key: 'pre_departure_call',
    title: 'Pre-Departure Confirmation Call',
    anchor: 'start_date',
    offsetDays: -3,
    priority: 'medium',
    department: '',
    description: 'Call {client_name} to confirm final details ahead of departure {start_date}.',
  },
  {
    template_key: 'post_trip_followup',
    title: 'Post-Trip Follow-Up',
    anchor: 'end_date',
    offsetDays: 2,
    priority: 'low',
    department: '',
    description: 'Follow up with {client_name} for feedback / a review after their trip to {destination}.',
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

/** Resolve a template's anchor to a `YYYY-MM-DD` string on this trip, or null if that date isn't set yet. */
function getAnchorDate(trip, anchor) {
  if (anchor === 'end_date') return trip.end_date || null;
  if (anchor === 'created_date') return trip.created_date ? trip.created_date.slice(0, 10) : null;
  return trip.start_date || null; // default: 'start_date'
}

/** Due date for a template on this trip, or null if its anchor date isn't available. */
function dueDateForTemplate(trip, tpl) {
  const anchorDate = getAnchorDate(trip, tpl.anchor);
  if (!anchorDate) return null;
  return addDaysYMD(anchorDate, tpl.offsetDays);
}

function escalationTriggerFor(dueDateYmd, priority) {
  const lead = SLA_LEAD_MS[priority] || 0;
  if (!dueDateYmd) return null;
  return new Date(new Date(`${dueDateYmd}T00:00:00Z`).getTime() - lead).toISOString();
}

/** Fill `{client_name}` / `{destination}` / `{start_date}` / `{end_date}` / `{reference_number}` placeholders in a template description. */
function renderTemplateDescription(description, trip) {
  if (!description) return '';
  return description.replace(/\{(\w+)\}/g, (match, key) => {
    if (key === 'client_name') return trip.client_name || 'client';
    if (key === 'destination') return trip.destination || '';
    if (key === 'start_date') return trip.start_date || '';
    if (key === 'end_date') return trip.end_date || '';
    if (key === 'reference_number') return trip.reference_number || '';
    return match;
  });
}

// --- low-level row access (system context: no per-row RLS, used by the engine) ---

function fetchTrip(bookingId) {
  const db = getDb();
  const row = db.prepare("SELECT id, data, created_date FROM entities WHERE type = 'Trip' AND id = ?").get(bookingId);
  if (!row) return null;
  return { id: row.id, ...JSON.parse(row.data), created_date: row.created_date };
}

/**
 * The workspace's configured task templates (`AppSettings.task_templates`),
 * or {@link DEFAULT_TASK_TEMPLATES} if the workspace hasn't customized them.
 * A configured list fully replaces the defaults (no merging) — Settings >
 * Task Templates pre-populates the form with the defaults so admins edit
 * from a visible starting point rather than an empty list.
 */
function getTaskTemplates() {
  const db = getDb();
  try {
    const row = db.prepare("SELECT data FROM entities WHERE type = 'AppSettings' LIMIT 1").get();
    if (row) {
      const settings = JSON.parse(row.data);
      if (Array.isArray(settings.task_templates) && settings.task_templates.length > 0) {
        return settings.task_templates;
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to load task_templates from AppSettings, using defaults');
  }
  return DEFAULT_TASK_TEMPLATES;
}

/** Templates applicable to this trip's department (or workspace-wide ones, `department` unset/''). */
function templatesForTrip(trip) {
  return getTaskTemplates().filter((tpl) => !tpl.department || tpl.department === trip.department);
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
 * Auto-generate this booking's operational tasks from the workspace's
 * configured templates (see {@link getTaskTemplates}), idempotently.
 *
 * - If a task with the same `(booking_id, template_key)` already exists and is
 *   still active, its due date / SLA window are resynced to the current
 *   trip dates (so editing the Trip updates the tasks).
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
    for (const tpl of templatesForTrip(trip)) {
      const dueDate = dueDateForTemplate(trip, tpl);
      if (!dueDate) continue; // e.g. an end_date-anchored template on a trip with no end_date yet
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
            description: renderTemplateDescription(tpl.description, trip),
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
 * booking when its departure or return date changes. Manual tasks (no
 * `template_key`) — and tasks whose template was since removed from
 * `AppSettings.task_templates` — keep their own due dates. Idempotent and
 * best-effort: completed/cancelled tasks are skipped.
 *
 * Looks up templates by key across the *full* configured list (not
 * department-filtered) since the task already exists regardless of whether
 * the trip's department later changed.
 *
 * @param {string} bookingId - Trip id.
 * @returns {{ rescheduled: number }}
 */
export function rescheduleTasksForBooking(bookingId) {
  const trip = fetchTrip(bookingId);
  if (!trip || !trip.start_date) return { rescheduled: 0 };

  const templates = getTaskTemplates();
  const db = getDb();
  const tasks = findTasksForBooking(bookingId);
  let rescheduled = 0;
  const tx = db.transaction(() => {
    for (const task of tasks) {
      if (!ACTIVE_STATUSES.includes(task.status)) continue;
      const tpl = templates.find((t) => t.template_key === task.template_key);
      if (!tpl) continue; // manual task, or its template was removed — leave its due date untouched
      const dueDate = dueDateForTemplate(trip, tpl);
      if (!dueDate) continue;
      patchTask(task.id, {
        due_date: dueDate,
        escalation_trigger_time: escalationTriggerFor(dueDate, tpl.priority),
        is_escalated: false,
      });
      rescheduled += 1;
    }
  });
  tx();
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

/**
 * Scan active tasks for escalation windows that have newly elapsed, persist
 * `is_escalated` (previously write-only — nothing ever set it `true`), and
 * notify the assignee plus every manager/admin in the current tenant.
 *
 * Selecting only rows where `is_escalated` isn't already `true` makes this
 * naturally idempotent: once a task is flagged, later calls (this runs on
 * every reminders-service tick) skip it, so there's no separate dedup window
 * to maintain like the reminders.js notifications-table check.
 *
 * @returns {number} Count of tasks newly escalated in this pass.
 */
export function checkEscalations() {
  const db = getDb();
  const nowIso = new Date().toISOString();

  const rows = db
    .prepare(
      `
    SELECT id, data FROM entities WHERE type = ?
    AND json_extract(data, '$.status') IN ('pending', 'in_progress')
    AND json_extract(data, '$.escalation_trigger_time') IS NOT NULL
    AND json_extract(data, '$.escalation_trigger_time') <= ?
    AND (json_extract(data, '$.is_escalated') IS NULL OR json_extract(data, '$.is_escalated') = 0)
  `,
    )
    .all(TASK_TYPE, nowIso);

  for (const row of rows) {
    const task = { id: row.id, ...JSON.parse(row.data) };
    patchTask(task.id, { is_escalated: true });
    notifyEscalation(db, task);
  }

  return rows.length;
}

/**
 * Who to notify for an escalated task: always the assignee, plus either
 * their specific `manager_id` (if set and still an active admin/manager —
 * teams that configure "Reports to" in User Management get targeted
 * escalation) or, as a fallback, every admin/manager in the tenant (teams
 * that never set one keep the original broadcast behavior).
 */
function resolveEscalationRecipients(db, task) {
  const recipientIds = new Set();
  if (task.assigned_to_user_id) recipientIds.add(task.assigned_to_user_id);

  let managerId = null;
  if (task.assigned_to_user_id) {
    const assignee = db.prepare('SELECT manager_id FROM users WHERE id = ?').get(task.assigned_to_user_id);
    managerId = assignee?.manager_id || null;
  }

  if (managerId) {
    const manager = db
      .prepare(`SELECT id FROM users WHERE id = ? AND user_tier IN ('admin', 'manager') AND is_active = 1`)
      .get(managerId);
    if (manager) {
      recipientIds.add(manager.id);
      return recipientIds;
    }
    // manager_id is stale (deleted/demoted/deactivated) — fall through to the broadcast.
  }

  for (const m of db.prepare(`SELECT id FROM users WHERE user_tier IN ('admin', 'manager') AND is_active = 1`).all()) {
    recipientIds.add(m.id);
  }
  return recipientIds;
}

function notifyEscalation(db, task) {
  const recipientIds = resolveEscalationRecipients(db, task);
  if (recipientIds.size === 0) return;

  const title = `Task escalated: ${task.title}`;
  const message = `"${task.title}"${task.due_date ? ` (due ${task.due_date})` : ''} is escalated and still ${(task.status || 'pending').replace('_', ' ')}.`;
  const data = { entityId: task.id, bookingId: task.booking_id || null };
  if (task.booking_id) data.url = `/ReservationDetails?id=${task.booking_id}`;

  for (const userId of recipientIds) {
    createNotification({
      userId,
      type: 'task_escalated',
      title,
      message,
      data,
      email: { subject: title, body: escapeHtml(message) },
    });
  }

  logger.info({ taskId: task.id, recipients: recipientIds.size }, 'Task escalation notified');
}
