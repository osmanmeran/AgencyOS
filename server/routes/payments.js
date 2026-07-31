import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, ForbiddenError } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { workspaceUrl } from '../middleware/tenant.js';
import { getTenantId } from '../db.js';
import { hasPermission } from '../permissions.js';
import { findEntityById } from '../services/entities.js';
import { getPaymentSettingsStatus, saveStripeSettings } from '../services/stripeSettings.js';
import { createInvoiceCheckoutSession } from '../services/payments.js';

const router = Router();

router.use(authMiddleware);

function requireManageAppSettings(req) {
  if (!hasPermission(req.user.user_tier, req.user.custom_permissions, 'manage_app_settings')) {
    throw new ForbiddenError('Missing required permission: manage_app_settings');
  }
}

// ── Bring-your-own-key Stripe settings (workspace admin) ────────────────

router.get(
  '/settings',
  catchAsync(async (req, res) => {
    requireManageAppSettings(req);
    const tenantId = getTenantId();
    res.json({
      ...getPaymentSettingsStatus(tenantId),
      webhookUrl: `${workspaceUrl(req)}/api/webhooks/stripe/${tenantId}`,
    });
  }),
);

router.post(
  '/settings',
  validate(schemas.saveStripeSettings),
  catchAsync(async (req, res) => {
    requireManageAppSettings(req);
    const status = await saveStripeSettings(getTenantId(), req.body);
    res.json(status);
  }),
);

// ── Invoice checkout (client portal "Pay Now" + staff payment link) ─────

router.post(
  '/checkout-session',
  validate(schemas.createInvoiceCheckoutSession),
  catchAsync(async (req, res) => {
    const invoice = findEntityById('Invoice', req.body.invoiceId, req.user);

    // A client-portal user paying their own invoice is already scoped by
    // findEntityById's read check above. A staff member generating a payment
    // link is taking an action beyond viewing, so it needs the same
    // permission that lets them create invoices in the first place.
    const isOwnInvoice = req.user.client_id && invoice.client_id === req.user.client_id;
    if (!isOwnInvoice) {
      if (!hasPermission(req.user.user_tier, req.user.custom_permissions, 'create_invoices')) {
        throw new ForbiddenError('Missing required permission: create_invoices');
      }
    }

    const base = workspaceUrl(req);
    const returnPage = req.user.client_id ? 'ClientInvoiceDetails' : 'InvoiceDetails';
    const { url } = await createInvoiceCheckoutSession(getTenantId(), invoice, {
      successUrl: `${base}/${returnPage}?id=${invoice.id}&payment=success`,
      cancelUrl: `${base}/${returnPage}?id=${invoice.id}&payment=cancelled`,
    });
    res.json({ url });
  }),
);

export default router;
