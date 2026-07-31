// Stores this tenant's Stripe Express (Connect) account — a single row (id=1)
// tracking the account id and its onboarding/capability flags, refreshed from
// Stripe after onboarding completes and on every `account.updated` webhook.
// The account id is also mirrored onto the platform tenant registry (see
// migrations/platform/004_stripe_connect.js) so an incoming webhook — which
// carries no tenant-resolving subdomain — can look up which tenant owns it.
export function up(db) {
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

export function down(db) {
  db.prepare('DROP TABLE IF EXISTS stripe_connect_account').run();
}
