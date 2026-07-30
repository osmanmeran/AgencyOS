// Adds the trial deadline to the tenant registry.
//
// `status` already existed ('trial' | 'active' | 'suspended') but nothing ever
// read it, and a trial had no end date — so "trial" was a label with no
// mechanism behind it. `trial_ends_at` (ISO 8601, nullable) is what the request
// path checks: a workspace still on `status = 'trial'` past this timestamp is
// refused. NULL means "no deadline" so every workspace that predates this
// migration keeps working exactly as before until an operator sets one.
export function up(db) {
  const columns = db.prepare('PRAGMA table_info(tenants)').all();
  if (!columns.some((c) => c.name === 'trial_ends_at')) {
    db.exec(`ALTER TABLE tenants ADD COLUMN trial_ends_at TEXT`);
  }
}

export function down(db) {
  // SQLite supports DROP COLUMN from 3.35; better-sqlite3 ships a newer build.
  const columns = db.prepare('PRAGMA table_info(tenants)').all();
  if (columns.some((c) => c.name === 'trial_ends_at')) {
    db.exec(`ALTER TABLE tenants DROP COLUMN trial_ends_at`);
  }
}
