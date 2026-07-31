import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '../../server/db.js';
import { createTenant, getTenantById } from '../../server/services/tenants.js';

// The Stripe SDK is mocked: these tests pin our own account-linking/status
// logic, not Stripe's HTTP client. Each fake method records its calls and
// returns a minimal shape shaped like the real API.
const calls = { accountsCreate: [], accountsRetrieve: [], accountLinksCreate: [], constructEvent: [] };
// A real Stripe account id is unique per connected account; a hardcoded id
// reused across tests would collide with the tenants.stripe_account_id
// unique index once more than one tenant "connects" it, so each test gets
// its own.
let nextAccount;
let retrieveResponse = null;

vi.mock('stripe', () => {
  class Stripe {
    constructor() {
      this.accounts = {
        create: async (opts) => {
          calls.accountsCreate.push(opts);
          return nextAccount;
        },
        retrieve: async (id) => {
          calls.accountsRetrieve.push(id);
          return retrieveResponse || { id, charges_enabled: true, payouts_enabled: true, details_submitted: true };
        },
      };
      this.accountLinks = {
        create: async (opts) => {
          calls.accountLinksCreate.push(opts);
          return { url: `https://connect.stripe.com/setup/${opts.account}` };
        },
      };
      this.webhooks = {
        constructEvent: (rawBody, sig) => {
          calls.constructEvent.push(sig);
          if (sig === 'bad-signature') throw new Error('signature mismatch');
          return JSON.parse(rawBody.toString());
        },
      };
    }
  }
  return { default: Stripe };
});

const {
  isStripeConfigured,
  getStripeClient,
  getConnectStatus,
  createOnboardingLink,
  syncConnectStatus,
  applyAccountUpdate,
  verifyStripeSignature,
} = await import('../../server/services/stripeConnect.js');

describe('Stripe Connect service', () => {
  let tenant;

  beforeEach(() => {
    calls.accountsCreate.length = 0;
    calls.accountsRetrieve.length = 0;
    calls.accountLinksCreate.length = 0;
    calls.constructEvent.length = 0;
    retrieveResponse = null;
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    tenant = createTenant({ slug: `stripe-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: 'Stripe Test Agency' });
    nextAccount = { id: `acct_${tenant.id}`, charges_enabled: false, payouts_enabled: false, details_submitted: false };
    getDb(tenant.id).exec('DELETE FROM stripe_connect_account');
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('reports configured/unconfigured based on STRIPE_SECRET_KEY', () => {
    expect(isStripeConfigured()).toBe(true);
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeConfigured()).toBe(false);
  });

  it('getStripeClient throws BadRequestError without a key', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => getStripeClient()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('reports not connected for a tenant with no local account row', () => {
    expect(getConnectStatus(tenant.id)).toEqual({ connected: false });
  });

  it('creates a Stripe Express account, stores it locally, and mirrors the id onto the tenant registry', async () => {
    const result = await createOnboardingLink(tenant.id, {
      returnUrl: 'https://app.test/return',
      refreshUrl: 'https://app.test/refresh',
    });
    expect(result.accountId).toBe(nextAccount.id);
    expect(result.url).toContain(nextAccount.id);
    expect(calls.accountsCreate).toHaveLength(1);
    expect(calls.accountsCreate[0].metadata.tenant_id).toBe(String(tenant.id));
    expect(calls.accountLinksCreate[0]).toMatchObject({
      account: nextAccount.id,
      return_url: 'https://app.test/return',
      refresh_url: 'https://app.test/refresh',
    });

    expect(getConnectStatus(tenant.id)).toMatchObject({
      connected: true,
      accountId: nextAccount.id,
      chargesEnabled: false,
    });
    expect(getTenantById(tenant.id).stripe_account_id).toBe(nextAccount.id);
  });

  it('reuses the existing account on a second onboarding call instead of creating another', async () => {
    await createOnboardingLink(tenant.id, { returnUrl: 'r', refreshUrl: 'r' });
    await createOnboardingLink(tenant.id, { returnUrl: 'r2', refreshUrl: 'r2' });
    expect(calls.accountsCreate).toHaveLength(1);
    expect(calls.accountLinksCreate).toHaveLength(2);
  });

  it('syncConnectStatus re-fetches from Stripe and updates the local flags', async () => {
    await createOnboardingLink(tenant.id, { returnUrl: 'r', refreshUrl: 'r' });
    retrieveResponse = { id: nextAccount.id, charges_enabled: true, payouts_enabled: true, details_submitted: true };
    const status = await syncConnectStatus(tenant.id);
    expect(status).toMatchObject({ connected: true, chargesEnabled: true, payoutsEnabled: true });
  });

  it('syncConnectStatus throws NotFoundError when no account exists yet', async () => {
    await expect(syncConnectStatus(tenant.id)).rejects.toThrow(/No Stripe Connect account/);
  });

  it('applyAccountUpdate updates the local row for a matching account id', async () => {
    await createOnboardingLink(tenant.id, { returnUrl: 'r', refreshUrl: 'r' });
    applyAccountUpdate(tenant.id, {
      id: nextAccount.id,
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    });
    expect(getConnectStatus(tenant.id)).toMatchObject({ chargesEnabled: true });
  });

  it('applyAccountUpdate ignores an update for an account id that does not match the stored one', async () => {
    await createOnboardingLink(tenant.id, { returnUrl: 'r', refreshUrl: 'r' });
    applyAccountUpdate(tenant.id, { id: 'acct_other', charges_enabled: true, payouts_enabled: true, details_submitted: true });
    expect(getConnectStatus(tenant.id)).toMatchObject({ chargesEnabled: false });
  });

  it('verifyStripeSignature parses a valid event and rejects a bad one', () => {
    const event = verifyStripeSignature(Buffer.from(JSON.stringify({ id: 'evt_1', type: 'account.updated' })), 'good-sig');
    expect(event.id).toBe('evt_1');
    expect(() => verifyStripeSignature(Buffer.from('{}'), 'bad-signature')).toThrow();
  });

  it('verifyStripeSignature throws BadRequestError without STRIPE_WEBHOOK_SECRET', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(() => verifyStripeSignature(Buffer.from('{}'), 'sig')).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });
});
