// Idempotency ledger for processed Stripe webhook events. Stripe retries
// delivery on anything but a 2xx response, and can also send a genuine
// duplicate — recording each event id lets the webhook handler skip work
// it has already done instead of double-crediting a payment.
export function up(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      id TEXT PRIMARY KEY,
      processed_at TEXT NOT NULL
    )`,
  ).run();
}

export function down(db) {
  db.prepare('DROP TABLE IF EXISTS stripe_webhook_events').run();
}
