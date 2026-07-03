import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync, BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { getDb, uid } from '../db.js';
import { broadcast } from '../lib/ws.js';

const router = Router();

router.use(authMiddleware);

// Client sell price for a pricing tier: an explicit client_price always wins
// (it's a manual staff override); otherwise apply the client's markup to base_price.
// Same rounding convention as ProposalBuilder's calcLineTotal.
function computeUnitPrice(pricing, markupPct) {
  if (pricing.client_price !== undefined && pricing.client_price !== null && pricing.client_price !== '') {
    return Math.round(parseFloat(pricing.client_price) * 10) / 10;
  }
  const base = parseFloat(pricing.base_price) || 0;
  return Math.ceil(base * (1 + (markupPct || 0) / 100) * 10) / 10;
}

function computeLineTotal(unitPrice, quantity, unit) {
  if (unit === 'per_group' || unit === 'flat_rate') return unitPrice;
  return unitPrice * quantity;
}

function getEntityById(db, type, id) {
  const row = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
  return row ? { id: row.id, ...JSON.parse(row.data) } : null;
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

// Active, approved supplier pricing with the client's markup applied.
// base_price / client_price are intentionally never included in the response.
router.get('/catalog', catchAsync(async (req, res) => {
  const client = requireClientContext(req.user);
  const db = getDb();
  const markupPct = client.default_markup || 0;

  const suppliers = new Map(
    db.prepare("SELECT * FROM entities WHERE type = 'Supplier'").all()
      .map(r => [r.id, JSON.parse(r.data)])
  );

  const items = db.prepare("SELECT * FROM entities WHERE type = 'SupplierPricing'").all()
    .map(r => ({ id: r.id, ...JSON.parse(r.data) }))
    .filter(p => p.is_active !== false && p.approval_status === 'approved')
    .map(p => ({
      pricing_id: p.id,
      supplier_id: p.supplier_id,
      supplier_name: suppliers.get(p.supplier_id)?.name || '',
      name: p.name,
      description: p.description || '',
      unit: p.unit,
      currency: p.currency || 'USD',
      unit_price: computeUnitPrice(p, markupPct),
      min_quantity: p.min_quantity || 1,
      max_quantity: p.max_quantity ?? null,
      occupancy: p.occupancy || null,
      season_type: p.season_type || 'all_year',
    }));

  res.json({ markup_percentage: markupPct, items });
}));

router.post('/quote', validate(schemas.b2bSubmitQuote), catchAsync(async (req, res) => {
  const client = requireClientContext(req.user);
  const db = getDb();
  const markupPct = client.default_markup || 0;

  const items = req.body.items.map(reqItem => {
    const pricing = getEntityById(db, 'SupplierPricing', reqItem.pricing_id);
    if (!pricing) throw new BadRequestError(`Unknown pricing_id: ${reqItem.pricing_id}`);
    if (pricing.is_active === false || pricing.approval_status !== 'approved') {
      throw new BadRequestError(`Pricing "${pricing.name}" is not currently available`);
    }
    const supplier = getEntityById(db, 'Supplier', pricing.supplier_id);
    const quantity = Math.max(1, reqItem.quantity || 1);
    const unit_price = computeUnitPrice(pricing, markupPct);

    return {
      pricing_id: pricing.id,
      supplier_id: pricing.supplier_id,
      supplier_name: supplier?.name || '',
      service_name: pricing.name,
      unit: pricing.unit,
      currency: pricing.currency || 'USD',
      unit_price,
      quantity,
      line_total: computeLineTotal(unit_price, quantity, pricing.unit),
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.line_total, 0);
  const now = new Date().toISOString();
  const id = uid();
  const data = {
    client_id: client.id,
    client_name: client.name,
    title: req.body.title,
    items,
    markup_percentage: markupPct,
    subtotal,
    total: subtotal,
    currency: items[0]?.currency || 'USD',
    status: 'submitted',
    notes: req.body.notes || '',
    requested_by: req.user.id,
    created_by: req.user.id,
  };

  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)')
    .run(id, 'QuoteRequest', JSON.stringify(data), now, now);

  broadcast({ type: 'entity_change', action: 'create', entityType: 'QuoteRequest', entityId: id }, { excludeUserId: req.user.id });

  res.status(201).json({ id, ...data, created_date: now, updated_date: now });
}));

router.get('/quotes', catchAsync(async (req, res) => {
  const client = requireClientContext(req.user);
  const db = getDb();

  const quotes = db.prepare("SELECT * FROM entities WHERE type = 'QuoteRequest'").all()
    .map(r => ({ id: r.id, ...JSON.parse(r.data), created_date: r.created_date, updated_date: r.updated_date }))
    .filter(q => q.client_id === client.id)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  res.json(quotes);
}));

router.get('/quotes/:id', catchAsync(async (req, res) => {
  const client = requireClientContext(req.user);
  const db = getDb();

  const row = db.prepare("SELECT * FROM entities WHERE type = 'QuoteRequest' AND id = ?").get(req.params.id);
  if (!row) throw new NotFoundError('Quote not found');
  const quote = { id: row.id, ...JSON.parse(row.data), created_date: row.created_date, updated_date: row.updated_date };
  if (quote.client_id !== client.id) throw new ForbiddenError('Access denied');

  res.json(quote);
}));

export default router;
