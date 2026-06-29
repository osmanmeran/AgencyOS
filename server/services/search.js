import { getDb } from '../db.js';

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

function hasFts(db) {
  try {
    db.prepare("SELECT count(*) FROM entities_fts").get();
    return true;
  } catch {
    return false;
  }
}

function searchWithFts(db, pattern, entityTypes) {
  // FTS5 search: escape special FTS characters and use prefix matching
  const sanitized = pattern.replace(/[^\w\s]/g, '').trim();
  if (!sanitized) return [];
  const ftsQuery = sanitized.split(/\s+/).map(w => `"${w}"*`).join(' AND ');
  const placeholders = entityTypes.map(() => '?').join(',');
  return db.prepare(`
    SELECT e.id, e.type, e.data FROM entities e
    INNER JOIN entities_fts fts ON e.id = fts.id
    WHERE entities_fts MATCH ? AND e.type IN (${placeholders})
    ORDER BY rank
    LIMIT 50
  `).all(ftsQuery, ...entityTypes);
}

function searchWithLike(db, pattern, entityTypes) {
  const placeholders = entityTypes.map(() => '?').join(',');
  return db.prepare(
    `SELECT id, type, data FROM entities WHERE type IN (${placeholders}) AND data LIKE ? LIMIT 50`
  ).all(...entityTypes, `%${pattern}%`);
}

export function searchAll(query, userId) {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();
  const db = getDb();
  const results = [];

  // Search users table (always uses LIKE for simplicity)
  const userPattern = `%${q}%`;
  const users = db.prepare(
    'SELECT id, name, email, user_tier FROM users WHERE is_active = 1 AND (name LIKE ? OR email LIKE ?) LIMIT 10'
  ).all(userPattern, userPattern);

  for (const user of users) {
    results.push({
      id: user.id,
      type: 'User',
      label: user.name || user.email,
      subtitle: user.email,
      badge: user.user_tier,
      url: `/UserManagement?id=${user.id}`,
      icon: 'Shield',
    });
  }

  // Search entity types using FTS or LIKE fallback
  const entityTypes = SEARCH_CONFIG.map(c => c.type);
  const rows = hasFts(db)
    ? searchWithFts(db, q, entityTypes)
    : searchWithLike(db, q, entityTypes);

  const typeConfig = Object.fromEntries(SEARCH_CONFIG.map(c => [c.type, c]));

  for (const row of rows) {
    const config = typeConfig[row.type];
    if (!config) continue;

    try {
      const data = JSON.parse(row.data);
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
