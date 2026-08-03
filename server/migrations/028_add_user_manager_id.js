// Reporting line for escalation notifications (server/services/tasks.js's
// checkEscalations): nullable so existing/new users default to no manager,
// which falls back to the pre-existing "broadcast to every admin/manager"
// behavior. Not a foreign key constraint — SQLite FKs aren't enforced unless
// PRAGMA foreign_keys=ON, and this codebase doesn't turn that on elsewhere.
export function up(db) {
  const cols = db
    .prepare("PRAGMA table_info('users')")
    .all()
    .map((c) => c.name);
  if (!cols.includes('manager_id')) {
    db.exec('ALTER TABLE users ADD COLUMN manager_id TEXT');
  }
}

export function down() {
  // SQLite does not support DROP COLUMN in older versions; leave it unused.
}
