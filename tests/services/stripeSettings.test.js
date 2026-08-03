import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDb } from '../../server/db.js';
import { createTenant } from '../../server/services/tenants.js';
import { isEncrypted, decrypt } from '../../server/lib/encryption.js';

// The Stripe SDK is mocked: these tests pin our own bring-your-own-key
// storage/validation logic, not Stripe's HTTP client.
const calls = { balanceRetrieve: [], constructEvent: [] };
let balanceShouldFail = false;

vi.mock('stripe', () => {
  class Stripe {
    constructor(secretKey) {
      this.secretKey = secretKey;
      this.balance = {
        retrieve: async () => {
          calls.balanceRetrieve.push(secretKey);
          if (balanceShouldFail) throw new Error('Invalid API Key provided');
          return { available: [] };
        },
      };
      this.webhooks = {
        constructEvent: (rawBody, sig, secret) => {
          calls.constructEvent.push({ sig, secret });
          if (sig === 'bad-signature') throw new Error('signature mismatch');
          return JSON.parse(rawBody.toString());
        },
      };
    }
  }
  return { default: Stripe };
});

const { getPaymentSettingsStatus, saveStripeSettings, getStripeClientForTenant, verifyStripeSignatureForTenant } =
  await import('../../server/services/stripeSettings.js');

describe('Stripe bring-your-own-key settings', () => {
  let tenant;

  beforeEach(() => {
    calls.balanceRetrieve.length = 0;
    calls.constructEvent.length = 0;
    balanceShouldFail = false;
    tenant = createTenant({
      slug: `stripe-byok-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: 'BYOK Test Agency',
    });
    getDb(tenant.id).exec('DELETE FROM stripe_settings');
  });

  it('reports not configured with no saved settings', () => {
    expect(getPaymentSettingsStatus(tenant.id)).toEqual({
      configured: false,
      webhookConfigured: false,
      secretKeyMasked: null,
      verifiedAt: null,
    });
  });

  it('saves a secret key after verifying it with Stripe, and masks it in status', async () => {
    const status = await saveStripeSettings(tenant.id, { secretKey: 'sk_test_abcdef1234' });
    expect(status.configured).toBe(true);
    expect(status.secretKeyMasked).toBe('sk_test…1234');
    expect(status.verifiedAt).toBeTruthy();
    expect(calls.balanceRetrieve).toEqual(['sk_test_abcdef1234']);
  });

  it('stores the secret key encrypted at rest, not as plaintext', async () => {
    await saveStripeSettings(tenant.id, { secretKey: 'sk_test_abcdef1234', webhookSecret: 'whsec_xyz' });
    const row = getDb(tenant.id).prepare('SELECT * FROM stripe_settings WHERE id = 1').get();
    expect(row.secret_key).not.toBe('sk_test_abcdef1234');
    expect(row.webhook_secret).not.toBe('whsec_xyz');
    expect(isEncrypted(row.secret_key)).toBe(true);
    expect(isEncrypted(row.webhook_secret)).toBe(true);
    expect(decrypt(row.secret_key)).toBe('sk_test_abcdef1234');
    expect(decrypt(row.webhook_secret)).toBe('whsec_xyz');
  });

  it('carries the existing encrypted secret key forward, still encrypted, when only the webhook secret is updated', async () => {
    await saveStripeSettings(tenant.id, { secretKey: 'sk_test_abcdef1234' });
    await saveStripeSettings(tenant.id, { webhookSecret: 'whsec_xyz' });
    const row = getDb(tenant.id).prepare('SELECT * FROM stripe_settings WHERE id = 1').get();
    expect(isEncrypted(row.secret_key)).toBe(true);
    expect(decrypt(row.secret_key)).toBe('sk_test_abcdef1234');
  });

  it('rejects a secret key Stripe itself rejects, without saving it', async () => {
    balanceShouldFail = true;
    await expect(saveStripeSettings(tenant.id, { secretKey: 'sk_test_bad' })).rejects.toThrow(/rejected/);
    expect(getPaymentSettingsStatus(tenant.id).configured).toBe(false);
  });

  it('saves a webhook secret independently of the secret key', async () => {
    await saveStripeSettings(tenant.id, { secretKey: 'sk_test_abcdef1234' });
    const status = await saveStripeSettings(tenant.id, { webhookSecret: 'whsec_xyz' });
    expect(status.configured).toBe(true);
    expect(status.webhookConfigured).toBe(true);
    // Saving only the webhook secret must not re-verify (or lose) the key.
    expect(calls.balanceRetrieve).toEqual(['sk_test_abcdef1234']);
  });

  it('getStripeClientForTenant throws BadRequestError when unconfigured', () => {
    expect(() => getStripeClientForTenant(tenant.id)).toThrow(/not configured/);
  });

  it('getStripeClientForTenant returns a client built from the tenant own key', async () => {
    await saveStripeSettings(tenant.id, { secretKey: 'sk_test_abcdef1234' });
    const client = getStripeClientForTenant(tenant.id);
    expect(client.secretKey).toBe('sk_test_abcdef1234');
  });

  it('verifyStripeSignatureForTenant throws NotFoundError when no webhook secret is saved', async () => {
    await saveStripeSettings(tenant.id, { secretKey: 'sk_test_abcdef1234' });
    expect(() => verifyStripeSignatureForTenant(tenant.id, Buffer.from('{}'), 'sig')).toThrow(
      /No webhook secret configured/,
    );
  });

  it('verifyStripeSignatureForTenant verifies against this tenant own webhook secret', async () => {
    await saveStripeSettings(tenant.id, { secretKey: 'sk_test_abcdef1234', webhookSecret: 'whsec_xyz' });
    const event = verifyStripeSignatureForTenant(tenant.id, Buffer.from(JSON.stringify({ id: 'evt_1' })), 'good-sig');
    expect(event.id).toBe('evt_1');
    expect(calls.constructEvent[0].secret).toBe('whsec_xyz');
    expect(() => verifyStripeSignatureForTenant(tenant.id, Buffer.from('{}'), 'bad-signature')).toThrow(
      /signature verification failed/,
    );
  });
});
