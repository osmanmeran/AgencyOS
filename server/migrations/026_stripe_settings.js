// Bring-your-own-key Stripe settings: a single row (id=1) per tenant holding
// the workspace's own Stripe secret key and webhook signing secret, pasted in
// directly from their own Stripe Dashboard (Settings -> Integrations ->
// Payments). Deliberately NOT a generic `entities` row — like `OutlookToken`,
// these are secrets and must never be exposed through the generic
// /api/entities API, only through the narrow, masked status endpoint in
// server/routes/payments.js.
export function up(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS stripe_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      secret_key TEXT,
      webhook_secret TEXT,
      verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();
}

export function down(db) {
  db.prepare('DROP TABLE IF EXISTS stripe_settings').run();
}
