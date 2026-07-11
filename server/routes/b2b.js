import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { getDb, uid } from '../db.js';
import { broadcast } from '../lib/ws.js';
import { hasPermission } from '../permissions.js';
import { sendEmail } from '../services/email.js';
import { getExchangeRate } from '../services/integrations.js';
import { createNotification } from '../services/notifications.js';
import logger from '../lib/logger.js';

const router = Router();

router.use(authMiddleware);

// Round a selling price UP to the nearest 0.10. Scale to tenths and strip
// floating-point noise with Math.round BEFORE the ceil, otherwise artifacts
// like 100 * 1.1 === 110.00000000000001 (or 111.1 * 10 === 1111.0000000000002)
// spuriously bump the result up 0.1. Mirrors applyMarkup in src/lib/pricing.js
// — keep the two in sync.
function roundSellPrice(value) {
  return Math.ceil(Math.round(value * 10 * 1e6) / 1e6) / 10;
}

// Sell price from a base/override pair: an explicit client override always
// wins (it's a manual staff price); otherwise apply the client's markup.
// Same rounding convention as ProposalBuilder's calcLineTotal.
function sellPrice(base, clientOverride, markupPct) {
  if (clientOverride !== undefined && clientOverride !== null && clientOverride !== '') {
    return Math.round(parseFloat(clientOverride) * 10) / 10;
  }
  return roundSellPrice((parseFloat(base) || 0) * (1 + (markupPct || 0) / 100));
}

// Finds the per-pax price band (`pax_tiers`) covering `pax` participants, or
// null to fall back to the row's flat base_price. An empty/omitted max_pax
// means "no upper limit". Mirrors resolvePaxTier in src/lib/pricing.js — keep
// the two in sync (tests/services/pricing.test.js checks parity).
export function resolvePaxTier(pricing, pax) {
  const tiers = Array.isArray(pricing?.pax_tiers) ? pricing.pax_tiers : [];
  const q = Math.round(Number(pax) || 0);
  return (
    tiers.find((t) => {
      if (t.min_pax == null || t.min_pax === '') return false;
      const min = Number(t.min_pax);
      if (!Number.isFinite(min)) return false;
      const max = t.max_pax != null && t.max_pax !== '' ? Number(t.max_pax) : Infinity;
      return q >= min && q <= max;
    }) || null
  );
}

// Client sell price for a pricing tier. When the row has per-pax bands and a
// participant count is known, the matching band's per-person price is used;
// otherwise the flat base_price/client_price.
export function computeUnitPrice(pricing, markupPct, pax) {
  const tier = pax != null ? resolvePaxTier(pricing, pax) : null;
  if (tier) return sellPrice(tier.price_per_person, tier.client_price_per_person, markupPct);
  return sellPrice(pricing.base_price, pricing.client_price, markupPct);
}

// Nights derived from a date range, used to scale per_night / per_day lines.
function nightsBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 86400000);
}

// Effective billable quantity: per_night/per_day multiply the quantity by the
// number of nights in the line's date range (falls back to raw quantity).
function effectiveQuantity(item) {
  const qty = Math.max(1, item.quantity || 1);
  if (item.unit === 'per_night' || item.unit === 'per_day') {
    const nights = nightsBetween(item.start_date, item.end_date);
    if (nights > 0) return qty * nights;
  }
  return qty;
}

function computeLineTotal(unitPrice, item) {
  if (item.unit === 'per_group' || item.unit === 'flat_rate') return unitPrice;
  return unitPrice * effectiveQuantity(item);
}

// Convert catalog items' prices from their supplier currency into the client's
// preferred display currency at the live rate. Rates are fetched once per
// distinct source currency. If a rate can't be resolved the item is left in
// its original currency rather than dropped. Returns { items, rates }.
async function convertItemsToCurrency(items, displayCurrency) {
  const sources = [...new Set(items.map((i) => i.currency || 'USD'))];
  const rates = {};
  for (const src of sources) {
    if (src === displayCurrency) {
      rates[src] = 1;
      continue;
    }
    try {
      rates[src] = (await getExchangeRate(src, displayCurrency)).rate;
    } catch (err) {
      logger.warn(
        { err: err.message, src, displayCurrency },
        'B2B currency conversion failed; leaving price in source currency',
      );
      rates[src] = null;
    }
  }
  const converted = items.map((item) => {
    const src = item.currency || 'USD';
    const rate = rates[src];
    if (rate == null || src === displayCurrency) return item;
    return {
      ...item,
      original_currency: src,
      original_unit_price: item.unit_price,
      currency: displayCurrency,
      exchange_rate: rate,
      unit_price: Math.round(item.unit_price * rate * 100) / 100,
      child_unit_price: item.child_unit_price != null ? Math.round(item.child_unit_price * rate * 100) / 100 : null,
      pax_tiers: Array.isArray(item.pax_tiers)
        ? item.pax_tiers.map((t) => ({ ...t, unit_price: Math.round(t.unit_price * rate * 100) / 100 }))
        : (item.pax_tiers ?? null),
    };
  });
  return { items: converted, rates };
}

function getEntityById(db, type, id) {
  const row = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
  return row ? { id: row.id, ...JSON.parse(row.data) } : null;
}

// Authoritative stop-sale check for the client portal — the catalog only
// exposes stop sales for UI hints, this is what actually blocks a booking.
function findBlockingStopSale(db, supplierId, startDate, endDate) {
  if (!supplierId || !startDate) return null;
  const end = endDate || startDate;
  const rows = db.prepare("SELECT * FROM entities WHERE type = 'SupplierStopSale'").all();
  for (const r of rows) {
    const s = JSON.parse(r.data);
    if (s.supplier_id === supplierId && startDate <= s.end_date && s.start_date <= end) return s;
  }
  return null;
}

function requireClientContext(user) {
  if (!user.client_id) {
    throw new ForbiddenError('This account is not linked to a client');
  }
  const db = getDb();
  const client = getEntityById(db, 'Client', user.client_id);
  if (!client) throw new NotFoundError('Linked client record not found');
  return client;
}

const STAFF_TIERS = ['admin', 'manager', 'agent', 'accounting'];

// Resolves the client context for READ routes. Real client-portal accounts
// use their own linked client_id. Staff (no client_id) may "view portal as" a
// specific client by passing ?clientId=... — this powers the staff "View
// portal as this client" feature and is deliberately limited to GET/read
// routes. Write routes keep calling requireClientContext, which rejects staff,
// so the staff view stays strictly read-only.
function resolveReadClientContext(req) {
  const user = req.user;
  if (user.client_id) return requireClientContext(user);

  const asClientId = req.query.clientId;
  if (asClientId && STAFF_TIERS.includes(user.user_tier)) {
    const db = getDb();
    const client = getEntityById(db, 'Client', asClientId);
    if (!client) throw new NotFoundError('Client not found');
    return client;
  }
  throw new ForbiddenError('This account is not linked to a client');
}

// Notify every active staff member who can act on quote requests that a new
// one came in. In-app + WebSocket via createNotification, plus email for those
// who opted in. Best-effort: a notification failure must never fail the submit.
function notifyStaffOfNewQuote(db, quoteId, quote) {
  try {
    const users = db.prepare('SELECT id, user_tier, custom_permissions FROM users WHERE is_active = 1').all();
    const title = `New quote request from ${quote.client_name || 'a client'}`;
    const count = quote.items?.length || 0;
    const message = `"${quote.title}" · ${count} service${count === 1 ? '' : 's'}`;
    for (const u of users) {
      let perms = [];
      try {
        perms = JSON.parse(u.custom_permissions || '[]');
      } catch {
        perms = [];
      }
      if (!Array.isArray(perms)) perms = [];
      if (!hasPermission(u.user_tier, perms, 'manage_quote_requests')) continue;
      createNotification({
        userId: u.id,
        type: 'quote_request',
        title,
        message,
        data: { entityId: quoteId, url: '/QuoteRequests' },
        email: { subject: title, body: `${message}\n\nReview it in the Quote Requests section of Marvelops.` },
      });
    }
  } catch (err) {
    logger.warn({ err: err.message, quoteId }, 'Failed to notify staff of new quote request');
  }
}

// Active, approved supplier pricing mapped into the client-facing shape used
// by both /catalog and /featured. base_price / client_price are
// intentionally never included in the response.
function getActiveCatalogItems(db, markupPct) {
  const supplierRows = db.prepare("SELECT * FROM entities WHERE type = 'Supplier'").all();
  const suppliers = new Map(supplierRows.map((r) => [r.id, JSON.parse(r.data)]));
  const categoryRows = db.prepare("SELECT * FROM entities WHERE type = 'SupplierCategory'").all();
  const categories = new Map(categoryRows.map((r) => [r.id, JSON.parse(r.data)]));
  // Category lives on the subcategory (service line) a price tier belongs
  // to, not on the supplier — a supplier can span several categories.
  const subcategoryRows = db.prepare("SELECT * FROM entities WHERE type = 'SupplierSubcategory'").all();
  const subcategories = new Map(subcategoryRows.map((r) => [r.id, JSON.parse(r.data)]));

  // Use SQL json_extract to filter active/approved on the server side,
  // avoiding loading all pricing rows into memory
  const pricingRows = db
    .prepare(
      `
    SELECT * FROM entities WHERE type = 'SupplierPricing'
      AND json_extract(data, '$.approval_status') = 'approved'
      AND (json_extract(data, '$.is_active') IS NULL OR json_extract(data, '$.is_active') = 1)
  `,
    )
    .all();

  return pricingRows.map((r) => {
    const p = JSON.parse(r.data);
    const supplier = suppliers.get(p.supplier_id);
    const subcategoryCategoryId = subcategories.get(p.subcategory_id)?.category_id || null;
    return {
      pricing_id: r.id,
      supplier_id: p.supplier_id,
      supplier_name: supplier?.name || '',
      city: supplier?.city || '',
      area: supplier?.area || '',
      address: supplier?.address || '',
      website: supplier?.website || '',
      rating: supplier?.rating ?? null,
      category_id: subcategoryCategoryId,
      category_name: categories.get(subcategoryCategoryId)?.name || '',
      name: p.name,
      description: p.description || '',
      image_url: p.image_url || '',
      is_featured: !!p.is_featured,
      unit: p.unit,
      currency: p.currency || 'USD',
      unit_price: computeUnitPrice(p, markupPct),
      // Flat per-child, per-night supplement (hotel rows only) — null when
      // the supplier hasn't priced one.
      child_unit_price:
        p.child_price != null && p.child_price !== ''
          ? sellPrice(p.child_price, p.child_client_price, markupPct)
          : null,
      // Sell-side per-pax bands so the client UI can price by participant
      // count; raw cost prices are never exposed.
      pax_tiers:
        Array.isArray(p.pax_tiers) && p.pax_tiers.length
          ? p.pax_tiers.map((tier) => ({
              min_pax: tier.min_pax ?? null,
              max_pax: tier.max_pax ?? null,
              unit_price: sellPrice(tier.price_per_person, tier.client_price_per_person, markupPct),
            }))
          : null,
      min_quantity: p.min_quantity || 1,
      max_quantity: p.max_quantity ?? null,
      occupancy: p.occupancy || null,
      meal_treatment: p.meal_treatment || null,
      season_type: p.season_type || 'all_year',
      season_start: p.season_start || null,
      season_end: p.season_end || null,
      car_category: p.car_category || null,
      daily_rate: p.daily_rate || null,
      drop_off_surcharge: p.drop_off_surcharge || null,
      insurance_surcharge: p.insurance_surcharge || null,
      available_locations: p.available_locations || null,
      car_rental_locations: supplier?.car_rental_locations || null,
      car_rental_terms: supplier?.car_rental_terms || null,
    };
  });
}

router.get(
  '/catalog',
  catchAsync(async (req, res) => {
    const client = resolveReadClientContext(req);
    const db = getDb();
    const markupPct = client.default_markup || 0;
    const displayCurrency = client.preferred_currency || null;

    let items = getActiveCatalogItems(db, markupPct);
    if (displayCurrency) ({ items } = await convertItemsToCurrency(items, displayCurrency));

    // Stop sales so the client UI can block/gray out dates and explain why —
    // enforcement itself happens server-side again on quote submission.
    const stopSales = db
      .prepare("SELECT * FROM entities WHERE type = 'SupplierStopSale'")
      .all()
      .map((r) => {
        const d = JSON.parse(r.data);
        return { supplier_id: d.supplier_id, start_date: d.start_date, end_date: d.end_date, reason: d.reason || '' };
      });

    res.json({ markup_percentage: markupPct, currency: displayCurrency, items, stop_sales: stopSales });
  }),
);

router.post(
  '/quote',
  validate(schemas.b2bSubmitQuote),
  catchAsync(async (req, res) => {
    const client = requireClientContext(req.user);
    const db = getDb();
    const markupPct = client.default_markup || 0;
    const displayCurrency = client.preferred_currency || null;

    // Batch-load all pricing and supplier entities to avoid N+1 queries
    const pricingIds = [...new Set(req.body.items.map((i) => i.pricing_id))];
    const pricingRows = db
      .prepare(
        `SELECT * FROM entities WHERE type = 'SupplierPricing' AND id IN (${pricingIds.map(() => '?').join(',')})`,
      )
      .all(...pricingIds);
    const pricings = Object.fromEntries(pricingRows.map((r) => [r.id, { id: r.id, ...JSON.parse(r.data) }]));
    const supplierIds = [...new Set(pricingRows.map((r) => JSON.parse(r.data).supplier_id))];
    const supplierRows = supplierIds.length
      ? db
          .prepare(`SELECT * FROM entities WHERE type = 'Supplier' AND id IN (${supplierIds.map(() => '?').join(',')})`)
          .all(...supplierIds)
      : [];
    const suppliers = Object.fromEntries(supplierRows.map((r) => [r.id, { id: r.id, ...JSON.parse(r.data) }]));

    // Build each line authoritatively from the DB in its supplier currency —
    // never trust a client-sent price. Trip-specific details (dates, transfer
    // logistics) are carried through as-is.
    const rawItems = req.body.items.map((reqItem) => {
      const pricing = pricings[reqItem.pricing_id];
      if (!pricing) throw new BadRequestError(`Unknown pricing_id: ${reqItem.pricing_id}`);
      if (pricing.is_active === false || pricing.approval_status !== 'approved') {
        throw new BadRequestError(`Pricing "${pricing.name}" is not currently available`);
      }
      const supplier = suppliers[pricing.supplier_id];
      const blockingStopSale = findBlockingStopSale(db, pricing.supplier_id, reqItem.start_date, reqItem.end_date);
      if (blockingStopSale) {
        throw new BadRequestError(
          `"${pricing.name}" is unavailable ${blockingStopSale.start_date} to ${blockingStopSale.end_date} — please choose different dates`,
        );
      }
      const quantity = Math.max(1, reqItem.quantity || 1);
      const nights = nightsBetween(reqItem.start_date, reqItem.end_date);
      const isCarRental =
        pricing.car_category ||
        reqItem.car_category ||
        (pricing.name || '').toLowerCase().includes('rent a car') ||
        (pricing.name || '').toLowerCase().includes('car rental') ||
        (pricing.name || '').toLowerCase().includes('rental');

      // For car rentals, calculate the drop-off surcharge if pickup ≠ dropoff
      let carDropOffSurchargeVal = 0;
      if (
        isCarRental &&
        reqItem.pickup_location &&
        reqItem.dropoff_location &&
        reqItem.pickup_location !== reqItem.dropoff_location
      ) {
        carDropOffSurchargeVal = pricing.drop_off_surcharge || 0;
      }

      return {
        pricing_id: pricing.id,
        supplier_id: pricing.supplier_id,
        supplier_name: supplier?.name || '',
        service_name: pricing.name,
        image_url: pricing.image_url || '',
        unit: pricing.unit,
        currency: pricing.currency || 'USD',
        // quantity is the participant count on per_person lines, which picks
        // the per-pax band when the pricing has one.
        unit_price: computeUnitPrice(pricing, markupPct, quantity),
        quantity,
        // Total children (across all rooms) on this line, priced via the
        // pricing row's flat per-child, per-night supplement.
        children_count: Math.max(0, Math.round(Number(reqItem.children_count) || 0)),
        child_unit_price: sellPrice(pricing.child_price, pricing.child_client_price, markupPct),
        start_date: reqItem.start_date || '',
        end_date: reqItem.end_date || '',
        nights: nights || null,
        room_type: reqItem.room_type || '',
        pickup_location: reqItem.pickup_location || '',
        dropoff_location: reqItem.dropoff_location || '',
        flight_number: reqItem.flight_number || '',
        service_time: reqItem.service_time || '',
        details: reqItem.details || '',
        car_category: pricing.car_category || reqItem.car_category || '',
        car_rental_days: isCarRental ? reqItem.car_rental_days || 1 : null,
        car_insurance: isCarRental ? !!reqItem.car_insurance : false,
        car_drop_off_surcharge: carDropOffSurchargeVal,
        insurance_surcharge: pricing.insurance_surcharge || 0,
      };
    });

    // Convert to the client's display currency (freezing the rate on each line),
    // then compute line totals — per_night/per_day lines scale by nights.
    let items = rawItems;
    if (displayCurrency) ({ items } = await convertItemsToCurrency(rawItems, displayCurrency));
    items = items.map((i) => {
      let lineTotal = computeLineTotal(i.unit_price, i);
      if (i.car_rental_days) {
        const days = i.car_rental_days;
        lineTotal = i.unit_price * days * (i.quantity || 1);
        const dailyInsurance = i.insurance_surcharge || 0;
        if (i.car_insurance && dailyInsurance > 0) {
          lineTotal += dailyInsurance * days;
        }
        if (i.car_drop_off_surcharge > 0) {
          lineTotal += i.car_drop_off_surcharge;
        }
      }
      if (i.children_count > 0 && i.child_unit_price && i.nights) {
        lineTotal += i.child_unit_price * i.children_count * i.nights;
      }
      return { ...i, line_total: lineTotal };
    });

    const subtotal = items.reduce((sum, i) => sum + i.line_total, 0);
    const now = new Date().toISOString();
    const id = uid();
    const data = {
      client_id: client.id,
      client_name: client.name,
      title: req.body.title,
      destination: req.body.destination || '',
      destinations: Array.isArray(req.body.destinations) ? req.body.destinations : [],
      start_date: req.body.start_date || '',
      end_date: req.body.end_date || '',
      passengers: Array.isArray(req.body.passengers) ? req.body.passengers : [],
      items,
      markup_percentage: markupPct,
      subtotal,
      total: subtotal,
      currency: displayCurrency || items[0]?.currency || 'USD',
      status: 'submitted',
      notes: req.body.notes || '',
      requested_by: req.user.id,
      created_by: req.user.id,
    };

    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
      id,
      'QuoteRequest',
      JSON.stringify(data),
      now,
      now,
    );

    broadcast(
      { type: 'entity_change', action: 'create', entityType: 'QuoteRequest', entityId: id },
      { excludeUserId: req.user.id },
    );
    notifyStaffOfNewQuote(db, id, data);

    res.status(201).json({ id, ...data, created_date: now, updated_date: now });
  }),
);

router.get(
  '/quotes',
  catchAsync(async (req, res) => {
    const client = resolveReadClientContext(req);
    const db = getDb();

    // Scope to the caller's own quotes in SQL rather than loading every client's
    // QuoteRequest rows into memory and filtering afterward.
    const rows = db
      .prepare(
        `
    SELECT * FROM entities
    WHERE type = 'QuoteRequest' AND json_extract(data, '$.client_id') = ?
    ORDER BY created_date DESC
  `,
      )
      .all(client.id);
    const quotes = rows.map((r) => ({
      id: r.id,
      ...JSON.parse(r.data),
      created_date: r.created_date,
      updated_date: r.updated_date,
    }));

    res.json(quotes);
  }),
);

router.get(
  '/quotes/:id',
  catchAsync(async (req, res) => {
    const client = resolveReadClientContext(req);
    const db = getDb();

    const row = db.prepare("SELECT * FROM entities WHERE type = 'QuoteRequest' AND id = ?").get(req.params.id);
    if (!row) throw new NotFoundError('Quote not found');
    const quote = {
      id: row.id,
      ...JSON.parse(row.data),
      created_date: row.created_date,
      updated_date: row.updated_date,
    };
    if (quote.client_id !== client.id) throw new ForbiddenError('Access denied');

    res.json(quote);
  }),
);

// Staff-only: review a submitted quote request. Every cart must go through
// this — clients can never move their own request past "submitted".
router.put(
  '/quotes/:id/respond',
  validate(schemas.b2bRespondToQuote),
  catchAsync(async (req, res) => {
    if (!hasPermission(req.user.user_tier, req.user.custom_permissions || [], 'manage_quote_requests')) {
      throw new ForbiddenError('Missing required permission: manage_quote_requests');
    }

    const db = getDb();
    const row = db.prepare("SELECT * FROM entities WHERE type = 'QuoteRequest' AND id = ?").get(req.params.id);
    if (!row) throw new NotFoundError('Quote not found');
    const existing = JSON.parse(row.data);

    const now = new Date().toISOString();
    const data = {
      ...existing,
      status: req.body.status,
      response_notes: req.body.response_notes ?? existing.response_notes ?? '',
      responded_by: req.user.id,
      responded_at: now,
    };

    db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(
      JSON.stringify(data),
      now,
      req.params.id,
    );

    broadcast(
      { type: 'entity_change', action: 'update', entityType: 'QuoteRequest', entityId: req.params.id },
      { excludeUserId: req.user.id },
    );

    const client = getEntityById(db, 'Client', existing.client_id);
    if (client?.email) {
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      sendEmail({
        to: client.email,
        subject: `Your quote request "${existing.title}" has been updated`,
        template: 'quote_response',
        templateData: {
          clientName: client.name,
          quoteTitle: existing.title,
          status: data.status,
          responseNotes: data.response_notes,
          quoteUrl: `${appUrl}/ClientQuoteDetails?id=${req.params.id}`,
        },
      }).catch((err) =>
        logger.warn({ err: err.message, quoteId: req.params.id }, 'Failed to send quote response email'),
      );
    }

    res.json({ id: row.id, ...data, created_date: row.created_date, updated_date: now });
  }),
);

export default router;
