// Self-service password reset, mirroring the invite-token columns added in
// 007_add_invite_token.js: a token + expiry stored directly on the user row.
export function up(db) {
  const cols = db
    .prepare("PRAGMA table_info('users')")
    .all()
    .map((c) => c.name);
  if (!cols.includes('password_reset_token')) {
    db.exec('ALTER TABLE users ADD COLUMN password_reset_token TEXT');
  }
  if (!cols.includes('password_reset_expires')) {
    db.exec('ALTER TABLE users ADD COLUMN password_reset_expires TEXT');
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_password_reset_token
    ON users (password_reset_token) WHERE password_reset_token IS NOT NULL`);
}

export function down(db) {
  db.exec('DROP INDEX IF EXISTS idx_users_password_reset_token');
  // SQLite's DROP COLUMN support varies by version; these columns are left in
  // place (unused) on rollback, same convention as 007_add_invite_token.js.
}
