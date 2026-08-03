// Backfill for 026_stripe_settings.js: encrypts any secret_key/webhook_secret
// left over from before those columns were encrypted at rest (see
// lib/encryption.js and services/stripeSettings.js). Idempotent — a value
// already carrying the encryption prefix is left untouched — so it's safe to
// run against a tenant DB more than once (e.g. a rollback-then-reapply).
import { encrypt, isEncrypted } from '../lib/encryption.js';

export function up(db) {
  const row = db.prepare('SELECT * FROM stripe_settings WHERE id = 1').get();
  if (!row) return;

  const nextSecretKey = row.secret_key && !isEncrypted(row.secret_key) ? encrypt(row.secret_key) : row.secret_key;
  const nextWebhookSecret =
    row.webhook_secret && !isEncrypted(row.webhook_secret) ? encrypt(row.webhook_secret) : row.webhook_secret;

  if (nextSecretKey !== row.secret_key || nextWebhookSecret !== row.webhook_secret) {
    db.prepare('UPDATE stripe_settings SET secret_key = ?, webhook_secret = ? WHERE id = 1').run(
      nextSecretKey,
      nextWebhookSecret,
    );
  }
}

export function down(_db) {
  // Data-only migration (encryption format change) — nothing structural to
  // revert, and decrypting back to plaintext isn't a real rollback need.
}
