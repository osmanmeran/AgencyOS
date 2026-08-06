// Google SSO: link a Google identity to an existing user account.
//
// Deliberately mirrors `microsoft_id` (migration 002) rather than introducing a
// separate identities table — a user row can carry both columns at once, so the
// same account signs in through either provider.
//
// Unlike Microsoft, Google sign-in never provisions: a token whose email has no
// user row is rejected. There is therefore no Google equivalent of
// `tenants.azure_tenant_id` — the workspace is whichever one already holds the
// user, so nothing gates which Google accounts may exist, only which ones an
// admin has created a row for.
export function up(db) {
  const columns = db
    .prepare("PRAGMA table_info('users')")
    .all()
    .map((c) => c.name);

  if (!columns.includes('google_id')) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
  }

  // Lookup by google_id happens on every Google login, same as microsoft_id.
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
}

export function down() {
  console.warn('[Migration 031] Skipping down — SQLite cannot drop columns safely.');
}
