// Folds the older, simpler ClientTask entity (client-scoped task/reminder/
// note, manual only) into Task (the richer engine with SLA escalation,
// booking/supplier links, and admin-configurable auto-generation templates)
// so the app has one to-do system instead of two. See entities/Task's
// description for the rationale.
//
// Field mapping, applied to every existing ClientTask row:
//   client_id            -> customer_id       (same FK target, renamed)
//   status: 'done'       -> 'completed'       (Task's vocabulary; pending/
//                                               in_progress pass through)
//   assigned_to (email)  -> assigned_to_user_id (FK), resolved by looking up
//                           the email in this tenant's users table. Left null
//                           if no match (e.g. the user was since deleted) —
//                           the row still migrates, just unassigned.
//   type/title/description/due_date/priority/completed_at/created_by carry
//   over unchanged (Task already accepts a `type` field for this purpose).
//
// Idempotent: re-running finds no remaining type='ClientTask' rows and is a
// no-op. Not reversible — see down().
export function up(db) {
  const rows = db.prepare("SELECT id, data FROM entities WHERE type = 'ClientTask'").all();
  if (rows.length === 0) return;

  const userByEmail = new Map(
    db
      .prepare('SELECT id, email FROM users')
      .all()
      .map((u) => [String(u.email || '').toLowerCase(), u.id]),
  );

  const now = new Date().toISOString();
  const update = db.prepare('UPDATE entities SET type = ?, data = ?, updated_date = ? WHERE id = ?');

  const run = db.transaction((records) => {
    let migrated = 0;
    let unresolvedAssignee = 0;
    for (const row of records) {
      let data;
      try {
        data = JSON.parse(row.data);
      } catch {
        continue;
      }

      const { client_id, assigned_to, status, ...rest } = data;
      const assignedUserId = assigned_to ? userByEmail.get(String(assigned_to).toLowerCase()) : undefined;
      if (assigned_to && !assignedUserId) unresolvedAssignee += 1;

      const migratedData = {
        ...rest,
        customer_id: client_id || null,
        status: status === 'done' ? 'completed' : status || 'pending',
        assigned_to_user_id: assignedUserId || null,
      };

      update.run('Task', JSON.stringify(migratedData), now, row.id);
      migrated += 1;
    }
    return { migrated, unresolvedAssignee };
  });

  const { migrated, unresolvedAssignee } = run(rows);
  console.log(
    `[Migration] Merged ${migrated} ClientTask row(s) into Task` +
      (unresolvedAssignee > 0 ? ` (${unresolvedAssignee} had an assignee email with no matching user)` : '') +
      '.',
  );
}

export function down() {
  // Not reversible: once merged, a migrated row is indistinguishable from a
  // Task created natively (both are now plain type='Task' rows), and any
  // Task created/edited since the merge would be wrongly swept up by an
  // attempt to convert "every Task with no booking_id/template_key" back.
}
