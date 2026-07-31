// Adds the Stripe Connect account id to the tenant registry. A webhook event
// from Stripe carries no Host subdomain or cookie the way a normal request
// does (see server/routes/stripeWebhook.js), so the only way to route an
// incoming event back to the right tenant database is to look up the
// connected account id it arrives on (`event.account`) against this column.
export function up(db) {
  const columns = db.prepare('PRAGMA table_info(tenants)').all();
  if (!columns.some((c) => c.name === 'stripe_account_id')) {
    db.exec(`ALTER TABLE tenants ADD COLUMN stripe_account_id TEXT`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_account_id
    ON tenants (stripe_account_id) WHERE stripe_account_id IS NOT NULL`);
}

export function down(db) {
  db.exec(`DROP INDEX IF EXISTS idx_tenants_stripe_account_id`);
  const columns = db.prepare('PRAGMA table_info(tenants)').all();
  if (columns.some((c) => c.name === 'stripe_account_id')) {
    db.exec(`ALTER TABLE tenants DROP COLUMN stripe_account_id`);
  }
}
