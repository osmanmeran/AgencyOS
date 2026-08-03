import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import { createTenant } from '../../server/services/tenants.js';

const calls = { checkoutSessionsCreate: [] };
let sessionResponse = { id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' };

vi.mock('stripe', () => {
  class Stripe {
    constructor() {
      this.checkout = {
        sessions: {
          create: async (params) => {
            calls.checkoutSessionsCreate.push({ params });
            return sessionResponse;
          },
        },
      };
    }
  }
  return { default: Stripe };
});

const { createInvoiceCheckoutSession, recordInvoicePayment } = await import('../../server/services/payments.js');

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

describe('payments service', () => {
  let tenant;
  let db;

  beforeEach(() => {
    calls.checkoutSessionsCreate.length = 0;
    sessionResponse = { id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' };
    tenant = createTenant({ slug: `pay-${Date.now()}`, name: 'Payments Test Agency' });
    db = getDb(tenant.id);
  });

  function configureStripeKey() {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO stripe_settings (id, secret_key, webhook_secret, verified_at, created_at, updated_at)
       VALUES (1, 'sk_test_tenant', 'whsec_test_tenant', ?, ?, ?)`,
    ).run(now, now, now);
  }

  describe('createInvoiceCheckoutSession', () => {
    it('rejects an invoice that is already paid', async () => {
      configureStripeKey();
      const invoice = { id: 'inv1', status: 'paid', amount_due: 0, total_amount: 100 };
      await expect(
        createInvoiceCheckoutSession(tenant.id, invoice, { successUrl: 's', cancelUrl: 'c' }),
      ).rejects.toThrow(/already settled/);
    });

    it('rejects an invoice with no remaining balance', async () => {
      configureStripeKey();
      const invoice = { id: 'inv1', status: 'sent', amount_due: 0, total_amount: 100, amount_paid: 100 };
      await expect(
        createInvoiceCheckoutSession(tenant.id, invoice, { successUrl: 's', cancelUrl: 'c' }),
      ).rejects.toThrow(/no remaining balance/);
    });

    it('rejects when the workspace has no Stripe secret key saved yet', async () => {
      const invoice = { id: 'inv1', status: 'sent', amount_due: 150, total_amount: 150 };
      await expect(
        createInvoiceCheckoutSession(tenant.id, invoice, { successUrl: 's', cancelUrl: 'c' }),
      ).rejects.toThrow(/not configured/);
    });

    it('creates a Checkout Session on the workspace own Stripe account for the remaining balance', async () => {
      configureStripeKey();
      const invoice = {
        id: 'inv1',
        invoice_number: 'INV-001',
        status: 'sent',
        amount_due: 125.5,
        total_amount: 125.5,
        currency: 'EUR',
      };
      const result = await createInvoiceCheckoutSession(tenant.id, invoice, {
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      });
      expect(result.url).toBe(sessionResponse.url);
      expect(calls.checkoutSessionsCreate).toHaveLength(1);
      const { params } = calls.checkoutSessionsCreate[0];
      expect(params.line_items[0].price_data.unit_amount).toBe(12550);
      expect(params.line_items[0].price_data.currency).toBe('eur');
      expect(params.metadata).toMatchObject({ tenant_id: String(tenant.id), invoice_id: 'inv1' });
      expect(params.success_url).toBe('https://app/success');
    });

    it('converts a zero-decimal currency amount without multiplying by 100', async () => {
      configureStripeKey();
      const invoice = {
        id: 'inv1',
        invoice_number: 'INV-JPY',
        status: 'sent',
        amount_due: 5000,
        total_amount: 5000,
        currency: 'JPY',
      };
      await createInvoiceCheckoutSession(tenant.id, invoice, { successUrl: 's', cancelUrl: 'c' });
      expect(calls.checkoutSessionsCreate[0].params.line_items[0].price_data.unit_amount).toBe(5000);
    });
  });

  describe('recordInvoicePayment', () => {
    it('throws NotFoundError for a missing invoice', () => {
      expect(() => recordInvoicePayment(tenant.id, { invoiceId: 'nope', amount: 10 })).toThrow(/not found/);
    });

    it('partially pays an invoice: bumps amount_paid/amount_due, keeps status, creates a ClientPayment, and updates the client', () => {
      const clientId = uid();
      const invoiceId = uid();
      insertEntity(db, 'Client', clientId, { name: 'Jane Doe', total_paid: 0, total_owed: 200 });
      insertEntity(db, 'Invoice', invoiceId, {
        invoice_number: 'INV-100',
        client_id: clientId,
        status: 'sent',
        total_amount: 200,
        amount_paid: 0,
        amount_due: 200,
      });

      const result = recordInvoicePayment(tenant.id, {
        invoiceId,
        amount: 80,
        currency: 'usd',
        transactionId: 'pi_123',
        paymentMethod: 'credit_card',
      });

      expect(result.invoice.amount_paid).toBe(80);
      expect(result.invoice.amount_due).toBe(120);
      expect(result.invoice.status).toBe('sent');

      const invoiceRow = JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(invoiceId).data);
      expect(invoiceRow.amount_paid).toBe(80);

      const paymentRow = db.prepare("SELECT * FROM entities WHERE type = 'ClientPayment'").get();
      const paymentData = JSON.parse(paymentRow.data);
      expect(paymentData).toMatchObject({
        client_id: clientId,
        invoice_id: invoiceId,
        amount: 80,
        transaction_id: 'pi_123',
        payment_method: 'credit_card',
        status: 'completed',
      });

      const clientData = JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(clientId).data);
      expect(clientData.total_paid).toBe(80);
      expect(clientData.total_owed).toBe(120);
    });

    it('marks the invoice paid once the full balance is covered', () => {
      const invoiceId = uid();
      insertEntity(db, 'Invoice', invoiceId, {
        invoice_number: 'INV-101',
        status: 'sent',
        total_amount: 50,
        amount_paid: 0,
        amount_due: 50,
      });

      const result = recordInvoicePayment(tenant.id, { invoiceId, amount: 50, transactionId: 'pi_999' });
      expect(result.invoice.status).toBe('paid');
      expect(result.invoice.amount_due).toBe(0);
    });
  });
});
