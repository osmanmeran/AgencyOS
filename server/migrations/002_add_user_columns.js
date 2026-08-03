export function up(db) {
  const columns = db
    .prepare("PRAGMA table_info('users')")
    .all()
    .map((c) => c.name);

  if (!columns.includes('microsoft_id')) {
    db.exec('ALTER TABLE users ADD COLUMN microsoft_id TEXT');
  }

  if (!columns.includes('departments')) {
    db.exec("ALTER TABLE users ADD COLUMN departments TEXT DEFAULT '[]'");
  }
}

export function down() {
  console.warn('[Migration 002] Skipping down — SQLite cannot drop columns safely.');
}
