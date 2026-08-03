// Bring-your-own-key Stripe settings, per tenant. Each workspace pastes its
// own Stripe secret key (and, separately, a webhook signing secret) directly
// from its own Stripe Dashboard — there is no platform-level Stripe key and
// no Stripe Connect "platform" application to be approved for. This trades a
// small amount of manual setup per workspace (generating a key takes seconds,
// no approval process) for zero hosting-level configuration: nothing in
// Railway's env vars needs to change, ever, for a new workspace to accept
// online payments.
import Stripe from 'stripe';
import { getDb } from '../db.js';
import { BadRequestError, NotFoundError } from '../middleware/errors.js';
import logger from '../lib/logger.js';
import { encrypt, decrypt } from '../lib/encryption.js';

// secret_key and webhook_secret are stored encrypted at rest (see
// lib/encryption.js and migrations/029_encrypt_stripe_secrets.js) — readRow
// returns the raw (encrypted) row; every call site below decrypts the two
// secret fields immediately after reading, so plaintext only ever exists
// in memory, never on disk.
function readRow(db) {
  return db.prepare('SELECT * FROM stripe_settings WHERE id = 1').get() || null;
}

function maskKey(key) {
  if (!key) return null;
  return key.length <= 8 ? '****' : `${key.slice(0, 7)}…${key.slice(-4)}`;
}

/** @returns {{configured: boolean, webhookConfigured: boolean, secretKeyMasked: string|null, verifiedAt: string|null}} */
export function getPaymentSettingsStatus(tenantId) {
  const row = readRow(getDb(tenantId));
  if (!row) return { configured: false, webhookConfigured: false, secretKeyMasked: null, verifiedAt: null };
  const secretKey = decrypt(row.secret_key);
  return {
    configured: Boolean(secretKey),
    webhookConfigured: Boolean(row.webhook_secret),
    secretKeyMasked: maskKey(secretKey),
    verifiedAt: row.verified_at || null,
  };
}

/**
 * Saves a tenant's own Stripe secret key and/or webhook secret. Either field
 * may be provided independently (the tenant typically pastes the secret key
 * first, then comes back with the webhook secret once they've created the
 * endpoint in their own Stripe Dashboard). The secret key is verified with a
 * lightweight, harmless Stripe API call before being stored, so a copy-paste
 * mistake is caught immediately instead of surfacing as a confusing failure
 * the next time a client tries to pay.
 * @throws {BadRequestError} If a provided secretKey is rejected by Stripe.
 */
export async function saveStripeSettings(tenantId, { secretKey, webhookSecret }) {
  const db = getDb(tenantId);
  const now = new Date().toISOString();
  const existing = readRow(db);

  let verifiedAt = existing?.verified_at || null;
  if (secretKey !== undefined) {
    try {
      await new Stripe(secretKey, { timeout: 10000 }).balance.retrieve();
    } catch (err) {
      throw new BadRequestError(`Stripe rejected this secret key: ${err.message}`, 'STRIPE_KEY_INVALID');
    }
    verifiedAt = now;
  }

  const nextSecretKey = secretKey !== undefined ? secretKey : (decrypt(existing?.secret_key) ?? null);
  const nextWebhookSecret = webhookSecret !== undefined ? webhookSecret : (decrypt(existing?.webhook_secret) ?? null);

  if (existing) {
    db.prepare(
      'UPDATE stripe_settings SET secret_key = ?, webhook_secret = ?, verified_at = ?, updated_at = ? WHERE id = 1',
    ).run(encrypt(nextSecretKey), encrypt(nextWebhookSecret), verifiedAt, now);
  } else {
    db.prepare(
      `INSERT INTO stripe_settings (id, secret_key, webhook_secret, verified_at, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)`,
    ).run(encrypt(nextSecretKey), encrypt(nextWebhookSecret), verifiedAt, now, now);
  }

  logger.info({ tenantId, webhookConfigured: Boolean(nextWebhookSecret) }, 'Stripe settings saved for tenant');
  return getPaymentSettingsStatus(tenantId);
}

/** @throws {BadRequestError} If this workspace hasn't saved a Stripe secret key yet. */
export function getStripeClientForTenant(tenantId) {
  const row = readRow(getDb(tenantId));
  const secretKey = row && decrypt(row.secret_key);
  if (!secretKey) {
    throw new BadRequestError('Online payments are not configured for this workspace yet.', 'STRIPE_NOT_CONFIGURED');
  }
  return new Stripe(secretKey, { timeout: 10000 });
}

/**
 * Verifies a webhook request's signature against this tenant's own webhook
 * secret and returns the parsed event.
 * @throws {NotFoundError} If this workspace hasn't saved a webhook secret yet.
 * @throws {BadRequestError} If the signature doesn't match.
 */
export function verifyStripeSignatureForTenant(tenantId, rawBody, signatureHeader) {
  const row = readRow(getDb(tenantId));
  const webhookSecret = row && decrypt(row.webhook_secret);
  if (!webhookSecret) {
    throw new NotFoundError('No webhook secret configured for this workspace');
  }
  const stripe = getStripeClientForTenant(tenantId);
  try {
    return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch (err) {
    throw new BadRequestError(`Webhook signature verification failed: ${err.message}`, 'INVALID_SIGNATURE');
  }
}
