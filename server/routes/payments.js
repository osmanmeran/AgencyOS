import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, ForbiddenError } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { workspaceUrl } from '../middleware/tenant.js';
import { getTenantId } from '../db.js';
import { hasPermission } from '../permissions.js';
import { findEntityById } from '../services/entities.js';
import {
  isStripeConfigured,
  getConnectStatus,
  createOnboardingLink,
  syncConnectStatus,
} from '../services/stripeConnect.js';
import { createInvoiceCheckoutSession } from '../services/payments.js';

const router = Router();

router.use(authMiddleware);

function requireManageAppSettings(req) {
  if (!hasPermission(req.user.user_tier, req.user.custom_permissions, 'manage_app_settings')) {
    throw new ForbiddenError('Missing required permission: manage_app_settings');
  }
}

// ── Stripe Connect onboarding (workspace admin) ─────────────────────────

router.get(
  '/connect/status',
  catchAsync(async (req, res) => {
    requireManageAppSettings(req);
    res.json({ stripeConfigured: isStripeConfigured(), ...getConnectStatus(getTenantId()) });
  }),
);

router.post(
  '/connect/onboard',
  catchAsync(async (req, res) => {
    requireManageAppSettings(req);
    const base = workspaceUrl(req);
    const result = await createOnboardingLink(getTenantId(), {
      returnUrl: `${base}/AppSettings?stripeOnboarding=return`,
      refreshUrl: `${base}/AppSettings?stripeOnboarding=refresh`,
    });
    res.json(result);
  }),
);

router.post(
  '/connect/sync',
  catchAsync(async (req, res) => {
    requireManageAppSettings(req);
    const status = await syncConnectStatus(getTenantId());
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
