import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDb, getPlatformDb, getDbPath } from '../../server/db.js';
import { createTenant } from '../../server/services/tenants.js';
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
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
    server.on('error', reject);
  });
});

afterAll(async () => {
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

function post(tenantId, body, sig = 'good-sig') {
  return fetch(`${baseUrl}/api/webhooks/stripe/${tenantId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
    body: JSON.stringify(body),
  });
}

describe('POST /api/webhooks/stripe/:tenantId', () => {
  let tenant;
  let db;
  let invoiceId;

  function configureStripeKey({ withWebhookSecret = true } = {}) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO stripe_settings (id, secret_key, webhook_secret, verified_at, created_at, updated_at)
       VALUES (1, 'sk_test_tenant', ?, ?, ?, ?)`,
    ).run(withWebhookSecret ? 'whsec_test_tenant' : null, now, now, now);
  }

  beforeEach(() => {
    tenant = createTenant({
      slug: `webhook-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: 'Webhook Test Agency',
    });
    createdTenantIds.push(tenant.id);
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

  it('404s for an unknown tenant id', async () => {
    const res = await post('no-such-tenant', { id: 'evt_x', type: 'checkout.session.completed' });
    expect(res.status).toBe(404);
  });

  it('rejects when the workspace has no webhook secret saved yet', async () => {
    configureStripeKey({ withWebhookSecret: false });
    const res = await post(tenant.id, { id: 'evt_x', type: 'checkout.session.completed' });
    expect(res.status).toBe(400);
  });

  it('rejects a request with an invalid signature', async () => {
    configureStripeKey();
    const res = await post(tenant.id, { id: 'evt_bad', type: 'checkout.session.completed' }, 'bad-signature');
    expect(res.status).toBe(400);
  });

  it("verifies against this tenant's own webhook secret and does not leak across tenants", async () => {
    configureStripeKey();
    const other = createTenant({
      slug: `webhook-other-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: 'Other Agency',
    });
    createdTenantIds.push(other.id);
    // Other tenant has no webhook secret configured at all — posting to
    // *its* URL must fail regardless of the first tenant's config.
    const res = await post(other.id, { id: 'evt_x', type: 'checkout.session.completed' });
    expect(res.status).toBe(400);
  });

  it('records a completed checkout session against the right tenant and invoice', async () => {
    configureStripeKey();
    const res = await post(tenant.id, {
      id: 'evt_checkout_1',
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

  it('records the full amount for a zero-decimal currency (JPY) instead of dividing by 100', async () => {
    configureStripeKey();
    const res = await post(tenant.id, {
      id: 'evt_checkout_jpy',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_jpy',
          payment_status: 'paid',
          // Stripe reports zero-decimal currencies in whole units already —
          // 5000 here means ¥5000, not ¥50.
          amount_total: 5000,
          currency: 'jpy',
          payment_intent: 'pi_jpy',
          client_reference_id: invoiceId,
          metadata: { tenant_id: tenant.id, invoice_id: invoiceId },
        },
      },
    });
    expect(res.status).toBe(200);

    const invoiceRow = JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(invoiceId).data);
    expect(invoiceRow.amount_paid).toBe(5000);
  });

  it('does not double-credit a duplicate/retried event id', async () => {
    configureStripeKey();
    const event = {
      id: 'evt_checkout_dup',
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
    await post(tenant.id, event);
    await post(tenant.id, event);

    const invoiceRow = JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(invoiceId).data);
    // Two identical events must only be applied once: 40 credited, not 80.
    expect(invoiceRow.amount_paid).toBe(40);
    const paymentCount = db.prepare("SELECT COUNT(*) AS c FROM entities WHERE type = 'ClientPayment'").get().c;
    expect(paymentCount).toBe(1);
  });

  it('ignores a checkout session that has not actually been paid yet', async () => {
    configureStripeKey();
    await post(tenant.id, {
      id: 'evt_unpaid',
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
});
