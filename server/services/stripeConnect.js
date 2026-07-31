// Per-tenant Stripe Connect (Express accounts) onboarding and status.
//
// One platform-level Stripe secret key drives every workspace's connected
// account — there is no per-tenant secret to store. What IS per-tenant is the
// connected account id itself, kept in two places: a local singleton row
// (`stripe_connect_account`, this tenant's own DB — the source of truth for
// "can this workspace accept payments right now") and mirrored onto the
// platform tenant registry (`tenants.stripe_account_id`) purely so an
// incoming webhook — which carries no tenant-resolving Host header or cookie
// — can look up which tenant a connected-account event belongs to.
import Stripe from 'stripe';
import { getDb } from '../db.js';
import { BadRequestError, NotFoundError } from '../middleware/errors.js';
import { setTenantStripeAccountId } from './tenants.js';
import logger from '../lib/logger.js';

let stripeClient = null;

/** @throws {BadRequestError} If STRIPE_SECRET_KEY isn't configured. */
export function getStripeClient() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new BadRequestError(
      'Online payments are not configured (missing STRIPE_SECRET_KEY).',
      'STRIPE_NOT_CONFIGURED',
    );
  }
  stripeClient = new Stripe(key, { timeout: 10000 });
  return stripeClient;
}

/** Whether a Stripe secret key is configured at all, regardless of any tenant's onboarding state. */
export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Verifies a webhook request's signature against the raw request body and
 * returns the parsed event. One webhook endpoint/secret covers both the
 * platform account and every connected account's events — set up in the
 * Stripe Dashboard as listening to "events on connected accounts".
 * @param {Buffer} rawBody
 * @param {string} signatureHeader
 * @throws {BadRequestError} If STRIPE_WEBHOOK_SECRET is unset, or the signature is invalid.
 */
export function verifyStripeSignature(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new BadRequestError('Missing STRIPE_WEBHOOK_SECRET', 'STRIPE_NOT_CONFIGURED');
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
}

function readLocalRow(db) {
  return db.prepare('SELECT * FROM stripe_connect_account WHERE id = 1').get() || null;
}

function upsertLocalRow(db, { accountId, chargesEnabled, payoutsEnabled, detailsSubmitted }) {
  const now = new Date().toISOString();
  const existing = readLocalRow(db);
  if (existing) {
    db.prepare(
      `UPDATE stripe_connect_account
       SET account_id = ?, charges_enabled = ?, payouts_enabled = ?, details_submitted = ?, updated_at = ?
       WHERE id = 1`,
    ).run(accountId, chargesEnabled ? 1 : 0, payoutsEnabled ? 1 : 0, detailsSubmitted ? 1 : 0, now);
  } else {
    db.prepare(
      `INSERT INTO stripe_connect_account
        (id, account_id, charges_enabled, payouts_enabled, details_submitted, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
    ).run(accountId, chargesEnabled ? 1 : 0, payoutsEnabled ? 1 : 0, detailsSubmitted ? 1 : 0, now, now);
  }
  return readLocalRow(db);
}

/** @returns {{connected: boolean, accountId?: string, chargesEnabled?: boolean, payoutsEnabled?: boolean, detailsSubmitted?: boolean}} */
export function getConnectStatus(tenantId) {
  const db = getDb(tenantId);
  const row = readLocalRow(db);
  if (!row) return { connected: false };
  return {
    connected: true,
    accountId: row.account_id,
    chargesEnabled: Boolean(row.charges_enabled),
    payoutsEnabled: Boolean(row.payouts_enabled),
    detailsSubmitted: Boolean(row.details_submitted),
  };
}

/**
 * Creates (if needed) this tenant's Stripe Express account and a fresh
 * onboarding Account Link. Safe to call again for a tenant that already has
 * an account — Stripe's onboarding flow is resumable, so this just re-links
 * into the same account rather than creating a second one.
 * @throws {BadRequestError} If the tenant has no platform registry row to key the account to.
 */
export async function createOnboardingLink(tenantId, { returnUrl, refreshUrl }) {
  const stripe = getStripeClient();
  const db = getDb(tenantId);
  let row = readLocalRow(db);

  if (!row) {
    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { tenant_id: String(tenantId) },
    });
    row = upsertLocalRow(db, {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
    const mirrored = setTenantStripeAccountId(tenantId, account.id);
    if (!mirrored) {
      logger.warn(
        { tenantId, accountId: account.id },
        'Created a Stripe Connect account for a tenant with no platform registry row — webhook events for it cannot be routed back until the tenant is registered (see scripts/adopt-tenant-zero.mjs)',
      );
    }
  }

  const accountLink = await stripe.accountLinks.create({
    account: row.account_id,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  });

  return { url: accountLink.url, accountId: row.account_id };
}

/** Re-fetches account status directly from Stripe (used after onboarding return, or if a webhook was missed). */
export async function syncConnectStatus(tenantId) {
  const db = getDb(tenantId);
  const row = readLocalRow(db);
  if (!row) throw new NotFoundError('No Stripe Connect account for this workspace yet');

  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(row.account_id);
  upsertLocalRow(db, {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
  return getConnectStatus(tenantId);
}

/**
 * Applies an `account.updated` webhook payload's flags to the tenant's local
 * row directly, without an extra Stripe API round-trip (the webhook payload
 * already carries the full account object).
 */
export function applyAccountUpdate(tenantId, account) {
  const db = getDb(tenantId);
  const row = readLocalRow(db);
  // Ignore updates for an account id we don't recognize as this tenant's
  // current one — defends against a stale mapping after a disconnect/reconnect.
  if (!row || row.account_id !== account.id) return;
  upsertLocalRow(db, {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
}
