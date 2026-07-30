// Public itinerary sharing: lets a client-portal user (or staff with
// modify_trips) turn a Trip into a read-only, unauthenticated link that can be
// handed to passengers who have no account at all. The token doubles as the
// tenant locator — a share link is opened long before the visitor's browser
// has any session cookie or active_tenant cookie, so (like invite links, see
// locateInvite() in services/auth.js) the token itself must be searched for
// across every tenant DB rather than relying on Host-based tenant resolution.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb, getUploadDir } from '../db.js';
import { allTenantIds } from './tenants.js';
import { findEntityById, upsertFts } from './entities.js';
import { hasPermission } from '../permissions.js';
import { ForbiddenError } from '../middleware/errors.js';

function generateShareToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/** Whether `user` may enable/rotate/revoke sharing for this Trip (already read-access-checked by the caller). */
function canManageShare(user, trip) {
  const tier = user.user_tier || 'agent';
  if (tier === 'admin' || tier === 'manager') return true;
  if (user.client_id) return trip.client_id === user.client_id;
  const perms = Array.isArray(user.custom_permissions) ? user.custom_permissions : [];
  return hasPermission(tier, perms, 'modify_trips');
}

function writeShareFields(id, existing, fields) {
  const db = getDb();
  const now = new Date().toISOString();
  const newData = { ...existing, ...fields };
  delete newData.id;
  db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(newData), now, id);
  upsertFts(db, id, 'Trip', newData);
  return { id, ...newData, updated_date: now };
}

/**
 * Enable (or re-enable) the public link for a trip. Reuses the existing token
 * unless `rotate` is set or none exists yet — rotating invalidates any
 * previously shared URL.
 * @throws {NotFoundError|ForbiddenError}
 */
export function enableShare(tripId, user, { rotate = false } = {}) {
  const trip = findEntityById('Trip', tripId, user);
  if (!canManageShare(user, trip)) {
    throw new ForbiddenError('You do not have permission to manage sharing for this trip');
  }
  const share_token = rotate || !trip.share_token ? generateShareToken() : trip.share_token;
  return writeShareFields(tripId, trip, { share_token, share_enabled: true });
}

/** Disable the public link and discard its token, fully invalidating any URL already handed out. */
export function revokeShare(tripId, user) {
  const trip = findEntityById('Trip', tripId, user);
  if (!canManageShare(user, trip)) {
    throw new ForbiddenError('You do not have permission to manage sharing for this trip');
  }
  return writeShareFields(tripId, trip, { share_token: null, share_enabled: false });
}

const SERVICE_PUBLIC_FIELDS = [
  '_key',
  'name',
  'description',
  'category',
  'location',
  'start_date',
  'end_date',
  'unit',
  'pickup_time',
  'pickup_location',
  'dropoff_location',
  'transfer_flight_number',
  'return_leg',
  'supplier_id',
  'show_in_itinerary',
];

function pickFields(obj, fields) {
  const out = {};
  for (const f of fields) {
    if (obj[f] !== undefined) out[f] = obj[f];
  }
  return out;
}

// Mirrors src/lib/supplierCategories.js's hiddenSupplierIds — kept as a small
// standalone copy rather than importing frontend code into the server.
function hiddenSupplierIds(categories, subcategories) {
  const hiddenCategoryIds = new Set((categories || []).filter((c) => c.hide_supplier_info).map((c) => c.id));
  const set = new Set();
  for (const sc of subcategories || []) {
    if (hiddenCategoryIds.has(sc.category_id)) set.add(sc.supplier_id);
  }
  return set;
}

const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/**
 * Public share pages have no session, so they can't use the authenticated
 * /uploads route. Rather than opening a second public file-serving surface,
 * inline any locally-uploaded image as a data: URL — external (https://) URLs
 * are already fine as-is. Applies the same traversal defenses as
 * routes/uploads.js (basename + prefix + realpath check).
 */
function inlineIfLocalUpload(url, tenantId) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return url;
  try {
    const uploadDir = getUploadDir(tenantId);
    const filename = path.basename(url);
    const filePath = path.join(uploadDir, filename);
    if (!filePath.startsWith(uploadDir + path.sep)) return null;
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    if (fs.realpathSync(filePath) !== path.join(fs.realpathSync(uploadDir), filename)) return null;
    if (fs.statSync(filePath).size > MAX_INLINE_IMAGE_BYTES) return null;
    const mime = IMAGE_MIME_BY_EXT[path.extname(filename).toLowerCase()];
    if (!mime) return null;
    return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Resolve a public share token to a sanitized, read-only itinerary view.
 * Searches every tenant DB (see module docblock) and returns null if the
 * token doesn't exist, doesn't resolve to a Trip, or sharing has since been
 * turned off — callers should treat all three as an ordinary 404, never
 * revealing which case it was.
 */
export function getPublicItinerary(token) {
  if (!token || typeof token !== 'string') return null;

  for (const tenantId of allTenantIds()) {
    const db = getDb(tenantId);
    const row = db
      .prepare("SELECT * FROM entities WHERE type = 'Trip' AND json_extract(data, '$.share_token') = ?")
      .get(token);
    if (!row) continue;

    const trip = JSON.parse(row.data);
    if (!trip.share_enabled) return null;

    const settingsRow = db.prepare("SELECT data FROM entities WHERE type = 'AppSettings' LIMIT 1").get();
    const settings = settingsRow ? JSON.parse(settingsRow.data) : {};

    const categories = db
      .prepare("SELECT data FROM entities WHERE type = 'SupplierCategory'")
      .all()
      .map((r) => JSON.parse(r.data));
    const subcategories = db
      .prepare("SELECT data FROM entities WHERE type = 'SupplierSubcategory'")
      .all()
      .map((r) => JSON.parse(r.data));
    const hiddenIds = hiddenSupplierIds(categories, subcategories);

    const services = (trip.services || []).map((s) => pickFields(s, SERVICE_PUBLIC_FIELDS));
    const supplierIds = [...new Set(services.map((s) => s.supplier_id).filter((id) => id && !hiddenIds.has(id)))];
    const suppliers = supplierIds
      .map((id) => {
        const r = db.prepare("SELECT id, data FROM entities WHERE type = 'Supplier' AND id = ?").get(id);
        return r
          ? { id: r.id, ...pickFields(JSON.parse(r.data), ['name', 'address', 'city', 'area', 'website']) }
          : null;
      })
      .filter(Boolean);

    return {
      trip: {
        ...pickFields(trip, [
          'name',
          'destination',
          'start_date',
          'end_date',
          'notes',
          'terms_and_conditions',
          'created_by_name',
          'created_by_phone',
        ]),
        image_url: inlineIfLocalUpload(trip.image_url, tenantId),
        services,
      },
      suppliers,
      company: {
        name: settings.invoice_header?.company_name || settings.app_name || '',
        logo_url: inlineIfLocalUpload(settings.invoice_header?.logo_url || settings.logo_url || '', tenantId),
      },
    };
  }

  return null;
}
