export function up(db) {
  const cols = db
    .prepare("PRAGMA table_info('users')")
    .all()
    .map((c) => c.name);
  if (!cols.includes('email_notifications')) {
    // Opt-in, defaults off so existing users don't suddenly start getting
    // emails they didn't ask for.
    db.exec('ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 0');
  }
}

export function down(db) {
  // SQLite does not support DROP COLUMN in older versions; leave it unused.
}
