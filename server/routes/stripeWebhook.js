// Stripe webhook: verifies the signature against the *raw* request body (see
// the express.raw() mount in app.js, registered before the global
// express.json() parser consumes the stream) and routes each event to the
// tenant it's for. Bring-your-own-key means every tenant has its own,
// completely independent Stripe account, so — unlike Stripe Connect — there
// is no shared platform webhook endpoint or connected-account id to key off.
// Instead each tenant registers their own webhook endpoint in their own
// Stripe Dashboard, pointed at THIS route with their tenant id in the path
// (see the URL shown in Settings -> Integrations -> Payments), and the
// signature is verified against that tenant's own webhook secret.
//
// This route intentionally sits outside authMiddleware/tenantMiddleware/
// csrfMiddleware — Stripe's request carries none of the session cookies or
// Host-subdomain those depend on.
import { Router } from 'express';
import { getDb, runWithTenant, DEFAULT_TENANT_ID } from '../db.js';
import { getTenantById } from '../services/tenants.js';
import { verifyStripeSignatureForTenant } from '../services/stripeSettings.js';
import { recordInvoicePayment, fromStripeAmount } from '../services/payments.js';
import { broadcast } from '../lib/ws.js';
import logger from '../lib/logger.js';

const router = Router();

// The legacy/default tenant has no platform registry row by design (see
// db.js's DEFAULT_TENANT_ID comment) — it's still a valid webhook target,
// it just isn't looked up through the tenant registry.
function resolveTenant(tenantIdParam) {
  if (tenantIdParam === DEFAULT_TENANT_ID) return { id: DEFAULT_TENANT_ID };
  return getTenantById(tenantIdParam) || null;
}

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

  const amount = fromStripeAmount(session.amount_total ?? 0, session.currency);
  const result = recordInvoicePayment(tenantId, {
    invoiceId,
    amount,
    currency: session.currency,
    transactionId: session.payment_intent,
    paymentMethod: 'credit_card',
  });

  broadcast({ type: 'entity_change', action: 'update', entityType: 'Invoice', entityId: invoiceId }, { tenantId });
  broadcast(
    { type: 'entity_change', action: 'create', entityType: 'ClientPayment', entityId: result.payment.id },
    { tenantId },
  );
}

router.post('/:tenantId', async (req, res) => {
  const tenant = resolveTenant(req.params.tenantId);
  if (!tenant) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown workspace' } });
  }

  let event;
  try {
    event = verifyStripeSignatureForTenant(tenant.id, req.body, req.headers['stripe-signature']);
  } catch (err) {
    logger.warn({ err: err.message, tenantId: tenant.id }, 'Stripe webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await runWithTenant(tenant.id, async () => {
      const db = getDb(tenant.id);
      if (alreadyProcessed(db, event.id)) return;

      if (event.type === 'checkout.session.completed') {
        await handleCheckoutCompleted(tenant.id, event.data.object);
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
