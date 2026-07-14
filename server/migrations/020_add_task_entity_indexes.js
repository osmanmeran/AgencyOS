// Indexes that back the contextual Task system's hot filter paths.
//
// Tasks live in the shared `entities` table as `type = 'Task'` with their
// fields in the JSON `data` blob (consistent with every other entity in this
// app). The contextual widget, the global task inbox, and the overdue/SLA
// queues all filter on `booking_id`, `customer_id`, `supplier_id`,
// `assigned_to_user_id`, `status`, `priority`, `due_date`, and `is_escalated`
// — so we mirror migration 013's pattern and add `(type, json_extract(...))`
// functional indexes. The planner can then seek straight to the matching
// (type, value) pairs instead of scanning every Task row.
//
// The expression text must match the query's json_extract exactly for SQLite
// to use it. Keep these in sync with services/tasks.js (listTasks) and the
// GET /api/tasks filters.
//
// Guard: if any entity row has malformed JSON, skip index creation rather than
// crash startup (same rationale as migration 013).
const INDEX_STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS idx_entities_type_task_booking_id
     ON entities(type, json_extract(data, '$.booking_id'))`,
  `CREATE INDEX IF NOT EXISTS idx_entities_type_task_customer_id
     ON entities(type, json_extract(data, '$.customer_id'))`,
  `CREATE INDEX IF NOT EXISTS idx_entities_type_task_supplier_id
     ON entities(type, json_extract(data, '$.supplier_id'))`,
  `CREATE INDEX IF NOT EXISTS idx_entities_type_task_assigned_user
     ON entities(type, json_extract(data, '$.assigned_to_user_id'))`,
  `CREATE INDEX IF NOT EXISTS idx_entities_type_task_status
     ON entities(type, json_extract(data, '$.status'))`,
  `CREATE INDEX IF NOT EXISTS idx_entities_type_task_priority
     ON entities(type, json_extract(data, '$.priority'))`,
  `CREATE INDEX IF NOT EXISTS idx_entities_type_task_due_date
     ON entities(type, json_extract(data, '$.due_date'))`,
  `CREATE INDEX IF NOT EXISTS idx_entities_type_task_escalated
     ON entities(type, json_extract(data, '$.is_escalated'))`,
];

export function up(db) {
  const malformed = db.prepare('SELECT COUNT(*) AS c FROM entities WHERE json_valid(data) = 0').get().c;
  if (malformed > 0) {
    console.warn(
      `[Migrations] 020: ${malformed} entity row(s) contain malformed JSON; skipping Task json_extract indexes. ` +
        `Clean up the data and re-create these indexes manually to enable them.`,
    );
    return;
  }
  for (const stmt of INDEX_STATEMENTS) db.exec(stmt);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_entities_type_task_booking_id;
    DROP INDEX IF EXISTS idx_entities_type_task_customer_id;
    DROP INDEX IF EXISTS idx_entities_type_task_supplier_id;
    DROP INDEX IF EXISTS idx_entities_type_task_assigned_user;
    DROP INDEX IF EXISTS idx_entities_type_task_status;
    DROP INDEX IF EXISTS idx_entities_type_task_priority;
    DROP INDEX IF EXISTS idx_entities_type_task_due_date;
    DROP INDEX IF EXISTS idx_entities_type_task_escalated;
  `);
}
