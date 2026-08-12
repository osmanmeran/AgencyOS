// Display currency a client-portal user picked for themselves (the portal's
// top-bar settings menu). Deliberately a separate column from
// `default_currency`: that one was added with `DEFAULT 'USD'` (migration 005),
// so every existing row already reads 'USD' and "never chose" is
// indistinguishable from "chose USD". This column is nullable with no default,
// so NULL means "no client-side preference" and the staff-set
// `Client.preferred_currency` keeps driving the B2B catalog (server/routes/b2b.js).
export function up(db) {
  const cols = db
    .prepare("PRAGMA table_info('users')")
    .all()
    .map((c) => c.name);
  if (!cols.includes('portal_currency')) {
    db.exec('ALTER TABLE users ADD COLUMN portal_currency TEXT');
  }
}

export function down() {
  // SQLite does not support DROP COLUMN in older versions; leave it unused.
}
