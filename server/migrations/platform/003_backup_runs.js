// Records the outcome of each scheduled backup run.
//
// Until now a failed backup logged a line and the process moved on, so a
// workspace could go unprotected indefinitely without anyone noticing — a
// backup nobody monitors isn't a backup. This table is the operator-visible
// record: what ran, when, and which workspaces failed. It lives in the platform
// DB rather than any tenant's, because a run spans every workspace (and because
// the tenant DB is exactly what might be broken).
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      ok INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      offsite INTEGER NOT NULL DEFAULT 0,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_backup_runs_started ON backup_runs(started_at DESC);
  `);
}

export function down(db) {
  db.exec(`DROP INDEX IF EXISTS idx_backup_runs_started;`);
  db.exec(`DROP TABLE IF EXISTS backup_runs;`);
}
