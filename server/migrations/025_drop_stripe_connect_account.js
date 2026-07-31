// Reverses migrations/023_stripe_connect_account.js. The Stripe Connect
// (Express account, platform-managed) onboarding model was replaced with
// bring-your-own-key (see migrations/026_stripe_settings.js) — there is no
// connected-account id/capability-flags to track per tenant anymore.
export function up(db) {
  db.prepare('DROP TABLE IF EXISTS stripe_connect_account').run();
}

export function down(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS stripe_connect_account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      account_id TEXT NOT NULL,
      charges_enabled INTEGER NOT NULL DEFAULT 0,
      payouts_enabled INTEGER NOT NULL DEFAULT 0,
      details_submitted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();
}
