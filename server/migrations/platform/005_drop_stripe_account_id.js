// Reverses migrations/platform/004_stripe_connect.js. The Stripe Connect
// (Express account, platform-managed) model was replaced with bring-your-own-key:
// each workspace pastes its own Stripe secret/webhook key directly (stored in
// its own tenant DB — see migrations/025_stripe_settings.js), so there is no
// connected-account id to mirror onto the platform tenant registry anymore.
export function up(db) {
  db.exec(`DROP INDEX IF EXISTS idx_tenants_stripe_account_id`);
  const columns = db.prepare('PRAGMA table_info(tenants)').all();
  if (columns.some((c) => c.name === 'stripe_account_id')) {
    db.exec(`ALTER TABLE tenants DROP COLUMN stripe_account_id`);
  }
}

export function down(db) {
  const columns = db.prepare('PRAGMA table_info(tenants)').all();
  if (!columns.some((c) => c.name === 'stripe_account_id')) {
    db.exec(`ALTER TABLE tenants ADD COLUMN stripe_account_id TEXT`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_account_id
    ON tenants (stripe_account_id) WHERE stripe_account_id IS NOT NULL`);
}
