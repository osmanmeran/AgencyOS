export function up(db) {
  const cols = db
    .prepare("PRAGMA table_info('users')")
    .all()
    .map((c) => c.name);
  if (!cols.includes('invite_token')) {
    db.exec('ALTER TABLE users ADD COLUMN invite_token TEXT');
  }
  if (!cols.includes('invite_expires')) {
    db.exec('ALTER TABLE users ADD COLUMN invite_expires TEXT');
  }
}

export function down() {
  // SQLite does not support DROP COLUMN in older versions
  // These columns will remain but won't be used
}
