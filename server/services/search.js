import { getDb, hasFts } from '../db.js';
import { userCanAccessEntity } from './entities.js';

const SEARCH_CONFIG = [
  {
    type: 'Client',
    label: 'Clients',
    fields: ['name', 'email', 'phone', 'company'],
    url: (id) => `/ClientDetails?id=${id}`,
    icon: 'UserCircle',
  },
  {
    type: 'Supplier',
    label: 'Suppliers',
    fields: ['name', 'email', 'phone', 'contact_person', 'city', 'country'],
    url: (id) => `/SupplierDetails?id=${id}`,
    icon: 'Users',
  },
  {
    type: 'Trip',
    label: 'Trips',
    fields: ['name', 'destination', 'client_name', 'reference', 'status'],
    url: (id) => `/TripDetails?id=${id}`,
    icon: 'Plane',
  },
  {
    type: 'Proposal',
    label: 'Proposals',
    fields: ['name', 'client_name', 'destination', 'reference', 'status'],
    url: (id) => `/ProposalDetails?id=${id}`,
    icon: 'FileText',
  },
  {
    type: 'Invoice',
    label: 'Invoices',
    fields: ['invoice_number', 'client_name', 'reference', 'status'],
    url: (id) => `/InvoiceDetails?id=${id}`,
    icon: 'FileText',
  },
  {
    type: 'SupplierBooking',
    label: 'Supplier Bookings',
    fields: ['reference', 'client_name', 'supplier_name', 'status'],
    url: (id) => `/SupplierBookingDetails?id=${id}`,
    icon: 'CalendarCheck',
  },
];

function searchWithFts(db, pattern, entityTypes) {
  // FTS5 search: escape special FTS characters and use prefix matching
  const sanitized = pattern.replace(/[^\w\s]/g, '').trim();
  if (!sanitized) return [];
  const ftsQuery = sanitized
    .split(/\s+/)
    .map((w) => `"${w}"*`)
    .join(' AND ');
  const placeholders = entityTypes.map(() => '?').join(',');
  return db
    .prepare(
      `
    SELECT e.id, e.type, e.data FROM entities e
    INNER JOIN entities_fts fts ON e.id = fts.id
    WHERE entities_fts MATCH ? AND e.type IN (${placeholders})
    ORDER BY rank
    LIMIT 50
  `,
    )
    .all(ftsQuery, ...entityTypes);
}

function searchWithLike(db, pattern, entityTypes) {
  const placeholders = entityTypes.map(() => '?').join(',');
  return db
    .prepare(`SELECT id, type, data FROM entities WHERE type IN (${placeholders}) AND data LIKE ? LIMIT 50`)
    .all(...entityTypes, `%${pattern}%`);
}

/**
 * Global search across users and the configured entity types in {@link SEARCH_CONFIG},
 * using FTS5 when available and falling back to a LIKE scan otherwise.
 * Every entity hit passes through {@link userCanAccessEntity}, so results are
 * scoped exactly like the generic entity API.
 * @param {object} user - The authenticated user (req.user).
 * @returns {object[]} Unified result list with label/subtitle/url/icon for the UI.
 */
export function searchAll(query, user) {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();
  const db = getDb();
  const results = [];

  // Search users table (always uses LIKE for simplicity). The staff directory
  // is not exposed to client/supplier portal accounts.
  const isPortalUser = user.user_tier === 'client' || user.client_id || user.linked_supplier_id;
  if (!isPortalUser) {
    const userPattern = `%${q}%`;
    const users = db
      .prepare(
        'SELECT id, name, email, user_tier FROM users WHERE is_active = 1 AND (name LIKE ? OR email LIKE ?) LIMIT 10',
      )
      .all(userPattern, userPattern);

    for (const u of users) {
      results.push({
        id: u.id,
        type: 'User',
        label: u.name || u.email,
        subtitle: u.email,
        badge: u.user_tier,
        url: `/UserManagement?id=${u.id}`,
        icon: 'Shield',
      });
    }
  }

  // Search entity types using FTS or LIKE fallback
  const entityTypes = SEARCH_CONFIG.map((c) => c.type);
  const rows = hasFts(db) ? searchWithFts(db, q, entityTypes) : searchWithLike(db, q, entityTypes);

  const typeConfig = Object.fromEntries(SEARCH_CONFIG.map((c) => [c.type, c]));

  for (const row of rows) {
    const config = typeConfig[row.type];
    if (!config) continue;

    try {
      const data = JSON.parse(row.data);
      if (!userCanAccessEntity(user, row.type, { ...data, id: row.id })) continue;
      const label = config.fields.reduce((acc, f) => acc || data[f], null) || row.type;
      const subtitle = config.fields.slice(1).reduce((acc, f) => acc || data[f], null) || '';
      results.push({
        id: row.id,
        type: row.type,
        label: String(label),
        subtitle: String(subtitle).slice(0, 100),
        badge: data.status || null,
        url: config.url(row.id),
        icon: config.icon,
      });
    } catch {
      // Skip unparseable rows
    }
  }

  return results;
}
