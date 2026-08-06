// Backfills `status: 'pending'` on Task rows that were stored without one.
//
// POST /api/tasks delegates to the generic entity writer, and neither create
// dialog (Task Board's "New Task", the client Tasks panel) sends a `status` —
// so every hand-created task since the ClientTask merge landed with the field
// missing entirely. The Task Board tolerated that by accident, bucketing an
// unknown status into "Pending" client-side, which is why it went unnoticed.
// Anything that filters by status did not: the client panel's pending count,
// `checkEscalations`' status predicate, and now the board's own server-side
// column queries all skip these rows.
//
// The route defaults the field going forward; this fixes the rows already
// written. Auto-generated tasks always set a status, so they're untouched.
//
// Idempotent: a second run matches no rows. The `json_valid` guard matters —
// `json_extract` raises on a malformed blob, which would abort the migration
// (and with it startup) over one bad row that this migration can't fix anyway.
export function up(db) {
  const rows = db
    .prepare(
      `SELECT id, data FROM entities
       WHERE type = 'Task'
         AND json_valid(data)
         AND (json_extract(data, '$.status') IS NULL OR json_extract(data, '$.status') = '')`,
    )
    .all();
  if (rows.length === 0) return;

  const update = db.prepare('UPDATE entities SET data = ? WHERE id = ?');
  const run = db.transaction((records) => {
    for (const row of records) {
      let data;
      try {
        data = JSON.parse(row.data);
      } catch {
        continue; // a malformed row is not this migration's problem to fix
      }
      // A completed task always has completed_at stamped; honor that rather
      // than reopening something someone already ticked off.
      data.status = data.completed_at ? 'completed' : 'pending';
      update.run(JSON.stringify(data), row.id);
    }
  });
  run(rows);
}

// Not reversible: the original rows had no status at all, and restoring that
// would only reintroduce the bug. Down is a deliberate no-op.
export function down() {}
