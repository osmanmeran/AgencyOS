// Stripe-backed invoice payments: a Checkout Session redirect for the Client
// Portal's "Pay Now", and the same session's URL handed back as a copyable
// link for staff to send outside the portal. Both surfaces create a Checkout
// Session as a *direct charge* on the tenant's connected Express account
// (`{ stripeAccount: accountId }`), so funds settle straight into the travel
// agency's own Stripe account rather than the platform's.
import { getDb, uid } from '../db.js';
import { BadRequestError, NotFoundError } from '../middleware/errors.js';
import { getStripeClient, getConnectStatus } from './stripeConnect.js';
import { upsertFts } from './entities.js';
import logger from '../lib/logger.js';

// Stripe amounts for these currencies are already in the currency's smallest
// unit (there is no sub-unit), unlike USD/EUR cents. Per Stripe's docs:
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

function toStripeAmount(amountMajorUnits, currency) {
  const rounded = Math.round(amountMajorUnits * 100) / 100;
  if (ZERO_DECIMAL_CURRENCIES.has(String(currency).toLowerCase())) return Math.round(rounded);
  return Math.round(rounded * 100);
}

/**
 * Creates a Stripe Checkout Session for the remaining balance of an invoice,
 * on the tenant's connected Stripe account. The caller (route layer) is
 * responsible for verifying the requester may act on this invoice — this
 * function only re-validates that there's actually something to charge and
 * that the workspace can accept payments right now.
 * @throws {BadRequestError} If the invoice is already settled, has no
 *   remaining balance, or the workspace's Stripe account can't take charges yet.
 */
export async function createInvoiceCheckoutSession(tenantId, invoice, { successUrl, cancelUrl }) {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    throw new BadRequestError('This invoice is already settled', 'INVOICE_NOT_PAYABLE');
  }
  const amountDue = Number(invoice.amount_due ?? invoice.total_amount - (invoice.amount_paid || 0));
  if (!(amountDue > 0)) {
    throw new BadRequestError('This invoice has no remaining balance', 'INVOICE_NOT_PAYABLE');
  }

  const connect = getConnectStatus(tenantId);
  if (!connect.connected || !connect.chargesEnabled) {
    throw new BadRequestError(
      'Online payments are not enabled for this workspace yet. Finish connecting Stripe in Settings.',
      'STRIPE_NOT_READY',
    );
  }

  const currency = (invoice.currency || 'USD').toLowerCase();
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Invoice ${invoice.invoice_number || invoice.id}` },
            unit_amount: toStripeAmount(amountDue, currency),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: invoice.id,
      metadata: { tenant_id: String(tenantId), invoice_id: invoice.id, invoice_number: invoice.invoice_number || '' },
      payment_intent_data: {
        metadata: { tenant_id: String(tenantId), invoice_id: invoice.id },
      },
    },
    { stripeAccount: connect.accountId },
  );

  return { url: session.url, sessionId: session.id };
}

/**
 * Records a completed Stripe payment against an invoice: bumps its
 * amount_paid/amount_due/status, inserts a ClientPayment row, and updates the
 * client's running totals — all in one transaction. This is the server-side,
 * atomic replacement for the three separate client-side calls
 * InvoiceDetails.jsx's "Record Payment" dialog makes for a manual entry; the
 * webhook handler is the only caller today (there is no user/request context
 * to authorize against here, since Stripe calls this directly).
 * @throws {NotFoundError} If the invoice no longer exists.
 */
export function recordInvoicePayment(tenantId, { invoiceId, amount, currency, transactionId, paymentMethod }) {
  const db = getDb(tenantId);
  const now = new Date().toISOString();

  const run = db.transaction(() => {
    const invoiceRow = db.prepare("SELECT * FROM entities WHERE type = 'Invoice' AND id = ?").get(invoiceId);
    if (!invoiceRow) throw new NotFoundError(`Invoice ${invoiceId} not found`);
    const invoiceData = JSON.parse(invoiceRow.data);

    const newAmountPaid = (invoiceData.amount_paid || 0) + amount;
    const newAmountDue = Math.max(0, (invoiceData.total_amount || 0) - newAmountPaid);
    const newStatus = newAmountDue <= 0 ? 'paid' : invoiceData.status;
    const updatedInvoice = {
      ...invoiceData,
      amount_paid: newAmountPaid,
      amount_due: newAmountDue,
      status: newStatus,
    };
    db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(
      JSON.stringify(updatedInvoice),
      now,
      invoiceId,
    );
    upsertFts(db, invoiceId, 'Invoice', updatedInvoice);

    const paymentId = uid();
    const paymentData = {
      client_id: invoiceData.client_id,
      invoice_id: invoiceId,
      trip_id: invoiceData.trip_id,
      proposal_id: invoiceData.proposal_id,
      amount,
      currency: currency || invoiceData.currency || 'USD',
      payment_date: now.split('T')[0],
      payment_method: paymentMethod || 'credit_card',
      transaction_id: transactionId,
      status: 'completed',
      notes: `Online payment for invoice ${invoiceData.invoice_number || invoiceId}`,
      created_by: 'stripe_webhook',
    };
    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
      paymentId,
      'ClientPayment',
      JSON.stringify(paymentData),
      now,
      now,
    );
    upsertFts(db, paymentId, 'ClientPayment', paymentData);

    if (invoiceData.client_id) {
      const clientRow = db.prepare("SELECT * FROM entities WHERE type = 'Client' AND id = ?").get(
        invoiceData.client_id,
      );
      if (clientRow) {
        const clientData = JSON.parse(clientRow.data);
        const updatedClient = {
          ...clientData,
          total_paid: (clientData.total_paid || 0) + amount,
          total_owed: Math.max((clientData.total_owed || 0) - amount, 0),
        };
        db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(
          JSON.stringify(updatedClient),
          now,
          invoiceData.client_id,
        );
        upsertFts(db, invoiceData.client_id, 'Client', updatedClient);
      }
    }

    return { invoice: { id: invoiceId, ...updatedInvoice }, payment: { id: paymentId, ...paymentData } };
  });

  const result = run();
  logger.info(
    { tenantId, invoiceId, amount, transactionId },
    'Invoice payment recorded from Stripe',
  );
  return result;
}
