// Stripe webhook: verifies the signature against the *raw* request body (see
// the express.raw() mount in app.js, registered before the global
// express.json() parser consumes the stream) and routes each event to the
// tenant that owns the connected account it fired on.
//
// This route intentionally sits outside authMiddleware/tenantMiddleware/
// csrfMiddleware — Stripe's request carries none of the session cookies or
// Host-subdomain those depend on. Tenant resolution instead comes from
// `event.account` (the connected account id), looked up against the platform
// tenant registry (see services/tenants.js#getTenantByStripeAccountId).
import { Router } from 'express';
import { getDb, runWithTenant } from '../db.js';
import { getTenantByStripeAccountId } from '../services/tenants.js';
import { applyAccountUpdate, verifyStripeSignature } from '../services/stripeConnect.js';
import { recordInvoicePayment } from '../services/payments.js';
import { broadcast } from '../lib/ws.js';
import logger from '../lib/logger.js';

const router = Router();

function alreadyProcessed(db, eventId) {
  const row = db.prepare('SELECT 1 FROM stripe_webhook_events WHERE id = ?').get(eventId);
  if (row) return true;
  db.prepare('INSERT INTO stripe_webhook_events (id, processed_at) VALUES (?, ?)').run(
    eventId,
    new Date().toISOString(),
  );
  return false;
}

async function handleCheckoutCompleted(tenantId, session) {
  const invoiceId = session.metadata?.invoice_id || session.client_reference_id;
  if (!invoiceId) {
    logger.warn({ tenantId, sessionId: session.id }, 'Stripe checkout.session.completed with no invoice_id metadata');
    return;
  }
  // payment_status can be 'unpaid' for e.g. a deferred bank-debit method still
  // settling; only credit the invoice once Stripe confirms funds are in.
  if (session.payment_status !== 'paid') return;

  const amount = (session.amount_total ?? 0) / 100;
  const result = recordInvoicePayment(tenantId, {
    invoiceId,
    amount,
    currency: session.currency,
    transactionId: session.payment_intent,
    paymentMethod: 'credit_card',
  });

  broadcast(
    { type: 'entity_change', action: 'update', entityType: 'Invoice', entityId: invoiceId },
    { tenantId },
  );
  broadcast(
    { type: 'entity_change', action: 'create', entityType: 'ClientPayment', entityId: result.payment.id },
    { tenantId },
  );
}

router.post('/', async (req, res) => {
  let event;
  try {
    event = verifyStripeSignature(req.body, req.headers['stripe-signature']);
  } catch (err) {
    logger.warn({ err: err.message }, 'Stripe webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Only connected-account events are relevant — the platform account itself
  // never takes charges directly.
  const accountId = event.account;
  if (!accountId) {
    return res.json({ received: true, ignored: 'no connected account' });
  }

  const tenant = getTenantByStripeAccountId(accountId);
  if (!tenant) {
    logger.warn({ accountId, eventType: event.type }, 'Stripe webhook for an unrecognized connected account');
    return res.json({ received: true, ignored: 'unknown account' });
  }

  try {
    await runWithTenant(tenant.id, async () => {
      const db = getDb(tenant.id);
      if (alreadyProcessed(db, event.id)) return;

      if (event.type === 'checkout.session.completed') {
        await handleCheckoutCompleted(tenant.id, event.data.object);
      } else if (event.type === 'account.updated') {
        applyAccountUpdate(tenant.id, event.data.object);
      }
    });
  } catch (err) {
    logger.error({ err: err.message, eventType: event.type, tenantId: tenant.id }, 'Stripe webhook handling failed');
    // Signature was valid but processing failed — ask Stripe to retry rather
    // than silently dropping a payment.
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  res.json({ received: true });
});

export default router;
