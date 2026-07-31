import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDb, getPlatformDb, getDbPath } from '../../server/db.js';
import { createTenant, setTenantStripeAccountId } from '../../server/services/tenants.js';
import fs from 'fs';
import path from 'path';

// constructEvent just parses the raw body back to JSON (unless the caller
// passes the 'bad-signature' sentinel) — these tests pin the webhook route's
// own tenant-routing/idempotency/recording logic, not Stripe's HMAC check.
vi.mock('stripe', () => {
  class Stripe {
    constructor() {
      this.webhooks = {
        constructEvent: (rawBody, sig) => {
          if (sig === 'bad-signature') throw new Error('signature mismatch');
          return JSON.parse(rawBody.toString());
        },
      };
    }
  }
  return { default: Stripe };
});

const appModule = await import('../../server/app.js');
const app = appModule.default;

let server;
let baseUrl;
const createdTenantIds = [];

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
    server.on('error', reject);
  });
});

afterAll(async () => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const platform = getPlatformDb();
  for (const id of createdTenantIds) {
    try {
      platform.prepare('DELETE FROM tenants WHERE id = ?').run(id);
    } catch {
      /* ignore */
    }
    const p = getDbPath(id);
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(path.dirname(p), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
  if (server) await new Promise((r) => server.close(r));
});

function insertEntity(db, type, id, data) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    type,
    JSON.stringify(data),
    now,
    now,
  );
}

function post(body, sig = 'good-sig') {
  return fetch(`${baseUrl}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
    body: JSON.stringify(body),
  });
}

describe('POST /api/webhooks/stripe', () => {
  let tenant;
  let db;
  let invoiceId;
  let accountId;

  beforeEach(() => {
    tenant = createTenant({ slug: `webhook-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: 'Webhook Test Agency' });
    createdTenantIds.push(tenant.id);
    accountId = `acct_webhook_${tenant.id}`;
    setTenantStripeAccountId(tenant.id, accountId);
    db = getDb(tenant.id);
    invoiceId = 'inv_' + Math.random().toString(36).slice(2);
    insertEntity(db, 'Invoice', invoiceId, {
      invoice_number: 'INV-WH-1',
      status: 'sent',
      total_amount: 100,
      amount_paid: 0,
      amount_due: 100,
    });
  });

  it('rejects a request with an invalid signature', async () => {
    const res = await post({ id: 'evt_bad', type: 'checkout.session.completed' }, 'bad-signature');
    expect(res.status).toBe(400);
  });

  it('ignores an event with no connected account', async () => {
    const res = await post({ id: 'evt_no_account', type: 'checkout.session.completed', data: { object: {} } });
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe('no connected account');
  });

  it('ignores an event for an unrecognized connected account', async () => {
    const res = await post({
      id: 'evt_unknown_acct',
      account: 'acct_does_not_exist',
      type: 'checkout.session.completed',
      data: { object: {} },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe('unknown account');
  });

  it('records a completed checkout session against the right tenant and invoice', async () => {
    const res = await post({
      id: 'evt_checkout_1',
      account: accountId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          payment_status: 'paid',
          amount_total: 10000,
          currency: 'usd',
          payment_intent: 'pi_1',
          client_reference_id: invoiceId,
          metadata: { tenant_id: tenant.id, invoice_id: invoiceId },
        },
      },
    });
    expect(res.status).toBe(200);

    const invoiceRow = JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(invoiceId).data);
    expect(invoiceRow.status).toBe('paid');
    expect(invoiceRow.amount_paid).toBe(100);

    const payment = db.prepare("SELECT * FROM entities WHERE type = 'ClientPayment'").get();
    expect(JSON.parse(payment.data).transaction_id).toBe('pi_1');
  });

  it('does not double-credit a duplicate/retried event id', async () => {
    const event = {
      id: 'evt_checkout_dup',
      account: accountId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_2',
          payment_status: 'paid',
          amount_total: 4000,
          currency: 'usd',
          payment_intent: 'pi_2',
          metadata: { tenant_id: tenant.id, invoice_id: invoiceId },
        },
      },
    };
    await post(event);
    await post(event);

    const invoiceRow = JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(invoiceId).data);
    // Two identical events must only be applied once: 40 credited, not 80.
    expect(invoiceRow.amount_paid).toBe(40);
    const paymentCount = db.prepare("SELECT COUNT(*) AS c FROM entities WHERE type = 'ClientPayment'").get().c;
    expect(paymentCount).toBe(1);
  });

  it('ignores a checkout session that has not actually been paid yet', async () => {
    await post({
      id: 'evt_unpaid',
      account: accountId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_3',
          payment_status: 'unpaid',
          amount_total: 4000,
          currency: 'usd',
          metadata: { tenant_id: tenant.id, invoice_id: invoiceId },
        },
      },
    });
    const invoiceRow = JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(invoiceId).data);
    expect(invoiceRow.amount_paid).toBe(0);
  });

  it('applies an account.updated event to the tenant local Stripe status', async () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO stripe_connect_account (id, account_id, charges_enabled, payouts_enabled, details_submitted, created_at, updated_at)
       VALUES (1, ?, 0, 0, 0, ?, ?)`,
    ).run(accountId, now, now);

    await post({
      id: 'evt_account_updated',
      account: accountId,
      type: 'account.updated',
      data: { object: { id: accountId, charges_enabled: true, payouts_enabled: true, details_submitted: true } },
    });

    const row = db.prepare('SELECT * FROM stripe_connect_account WHERE id = 1').get();
    expect(row.charges_enabled).toBe(1);
  });
});
