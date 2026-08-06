import { getDb, uid, getEntities, hasFts } from '../db.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errors.js';
import { hasPermission } from '../permissions.js';

export const USER_SCOPED_TYPES = ['Message', 'EmailLog'];
export const CLIENT_SCOPED_TYPES = ['Trip', 'Proposal', 'Invoice', 'ClientPayment', 'QuoteRequest'];

const ENTITY_PERMISSION_MAP = {
  Trip: { create: 'create_trips', read: 'view_all_trips', update: 'modify_trips', delete: 'delete_trips' },
  SupplierBooking: { create: 'create_trips', read: 'view_all_trips', update: 'modify_trips', delete: 'delete_trips' },
  Invoice: { create: 'create_invoices', read: 'view_invoices', update: 'modify_invoices', delete: 'delete_invoices' },
  ClientPayment: {
    create: 'create_invoices',
    read: 'view_invoices',
    update: 'modify_invoices',
    delete: 'delete_invoices',
  },
  Proposal: {
    create: 'create_proposals',
    read: 'view_all_data',
    update: 'modify_proposals',
    delete: 'delete_proposals',
  },
  Supplier: {
    create: 'create_suppliers',
    read: 'view_all_data',
    update: 'modify_suppliers',
    delete: 'delete_suppliers',
  },
  SupplierInvoice: {
    create: 'create_invoices',
    read: 'view_invoices',
    update: 'modify_invoices',
    delete: 'delete_invoices',
  },
  SupplierStopSale: {
    create: 'modify_suppliers',
    read: 'view_all_data',
    update: 'modify_suppliers',
    delete: 'modify_suppliers',
  },
  Client: { create: 'create_clients', read: 'view_all_data', update: 'modify_clients', delete: 'delete_clients' },
  Company: { create: 'create_clients', read: 'view_all_data', update: 'modify_clients', delete: 'delete_clients' },
  BookingTemplate: {
    create: 'manage_booking_templates',
    read: 'view_all_data',
    update: 'manage_booking_templates',
    delete: 'manage_booking_templates',
  },
  TourContract: {
    create: 'manage_tour_contracts',
    read: 'view_all_data',
    update: 'manage_tour_contracts',
    delete: 'manage_tour_contracts',
  },
  GuidedTour: {
    create: 'manage_guided_tours',
    read: 'view_guided_tours',
    update: 'manage_guided_tours',
    delete: 'manage_guided_tours',
  },
  TourBooking: {
    create: 'manage_guided_tours',
    read: 'view_guided_tours',
    update: 'manage_guided_tours',
    delete: 'manage_guided_tours',
  },
  // Global config singleton. Readable by everyone (client-facing documents
  // need the agency branding — see userCanAccessEntity), but only admins may
  // write it: it holds tier_permissions, so an open update path would let any
  // user rewrite the permission matrix.
  AppSettings: {
    create: 'manage_app_settings',
    update: 'manage_app_settings',
    delete: 'manage_app_settings',
  },
  // Client-portal users submit quote requests through the dedicated /api/b2b routes
  // (which write directly to the DB), not this generic entity API — so the create/update/delete
  // permissions here only need to cover staff review workflows.
  QuoteRequest: {
    create: 'manage_quote_requests',
    read: 'view_quote_requests',
    update: 'manage_quote_requests',
    delete: 'manage_quote_requests',
  },
  SupplierCategory: {
    create: 'manage_categories',
    read: 'view_all_data',
    update: 'manage_categories',
    delete: 'manage_categories',
  },
  SupplierSubcategory: {
    create: 'manage_categories',
    read: 'view_all_data',
    update: 'manage_categories',
    delete: 'manage_categories',
  },
  SupplierPricing: {
    create: 'manage_pricing',
    read: 'view_all_data',
    update: 'manage_pricing',
    delete: 'manage_pricing',
  },
  SupplierService: {
    create: 'modify_suppliers_basic',
    read: 'view_all_data',
    update: 'modify_suppliers_basic',
    delete: 'modify_suppliers_basic',
  },
  SupplierReview: {
    create: 'modify_suppliers_basic',
    read: 'view_all_data',
    update: 'modify_suppliers_basic',
    delete: 'modify_suppliers_basic',
  },
  ItineraryEvent: { create: 'create_trips', read: 'view_all_trips', update: 'create_trips', delete: 'create_trips' },
  PackingItem: { create: 'create_trips', read: 'view_all_trips', update: 'create_trips', delete: 'create_trips' },
  ProposalTemplate: {
    create: 'create_proposals',
    read: 'view_all_data',
    update: 'modify_proposals',
    delete: 'modify_proposals',
  },
  BookingRequest: { create: 'create_trips', read: 'view_all_trips', update: 'create_trips', delete: 'create_trips' },
  // Per-department/month sequence used to mint reservation reference numbers
  // (see src/lib/referenceNumber.js) — gated the same as trip creation, the
  // only workflow that touches it.
  ReferenceCounter: {
    create: 'create_trips',
    read: 'view_all_trips',
    update: 'create_trips',
    delete: 'create_trips',
  },
  ReportSchedule: { create: 'view_reports', read: 'view_reports', update: 'view_reports', delete: 'view_reports' },
  // Operational, booking-linked to-do. Gated on the trip workflow: anyone who
  // can build/manage trips owns the tasks that the trip auto-generates.
  Task: { create: 'create_trips', read: 'view_all_trips', update: 'modify_trips', delete: 'delete_trips' },
};

// Additional permissions that grant agent/accounting staff read access to a
// type beyond ENTITY_PERMISSION_MAP's read/update/delete keys. These encode
// "reads implied by the workflows the permission enables": an agent allowed
// to edit supplier pricing must see suppliers; an agent allowed to create
// trips/proposals needs the client list, templates, and contracts to do it.
const STAFF_READ_EXTRA = {
  Supplier: ['modify_suppliers_basic', 'manage_pricing'],
  SupplierStopSale: ['manage_pricing'],
  SupplierCategory: ['create_trips', 'create_proposals', 'modify_suppliers_basic', 'manage_pricing'],
  SupplierSubcategory: ['create_trips', 'create_proposals', 'modify_suppliers_basic', 'manage_pricing'],
  SupplierPricing: ['modify_suppliers_basic', 'manage_pricing', 'create_trips', 'create_proposals'],
  SupplierService: ['modify_suppliers_basic', 'manage_pricing'],
  SupplierReview: ['modify_suppliers_basic', 'manage_pricing'],
  ItineraryEvent: ['create_trips'],
  PackingItem: ['create_trips'],
  ProposalTemplate: ['create_proposals', 'modify_proposals'],
  BookingRequest: ['create_trips'],
  ReferenceCounter: ['create_trips'],
  Client: ['create_trips', 'create_proposals'],
  Company: ['create_trips', 'create_proposals', 'create_invoices'],
  BookingTemplate: ['create_trips'],
  TourContract: ['create_trips'],
};

/**
 * Whether a non-admin staff user (agent/accounting) may read records of this
 * type wholesale. A type is readable if the user holds its mapped `read`
 * permission, any permission that lets them modify the type (being allowed to
 * update/delete any record implies seeing them), or a workflow permission
 * from {@link STAFF_READ_EXTRA}. Types without a mapping stay staff-readable,
 * matching the write-side behavior of {@link requireEntityPermission}.
 * Users who fail this check still get their own records — see the
 * created_by/user_id fallback in {@link userCanAccessEntity}.
 */
function staffCanReadType(user, entityType) {
  const mapping = ENTITY_PERMISSION_MAP[entityType];
  if (!mapping) return true;
  const grantKeys = [mapping.read, mapping.update, mapping.delete, ...(STAFF_READ_EXTRA[entityType] || [])].filter(
    Boolean,
  );
  if (grantKeys.length === 0) return true;
  const perms = Array.isArray(user.custom_permissions) ? user.custom_permissions : [];
  return grantKeys.some((key) => hasPermission(user.user_tier || 'agent', perms, key));
}

// Supplier-portal accounts (linked_supplier_id) write exactly these two
// types through the generic entity API — there's no dedicated
// /api/supplier-portal route module the way the client portal has /api/b2b.
// They hold no staff permissions (tier 'supplier' grants none by design), so
// the normal ENTITY_PERMISSION_MAP gate below would always reject them.
// Bypassed here instead, scoped to their own supplier_id: for 'create' that's
// checked directly against the submitted body (no existing row yet); for
// 'update' the row itself is scoped by userCanAccessEntity right after this
// check runs, but that only validates the *existing* row — without also
// checking here, a supplier could pass a different supplier_id in the update
// body and reassign someone else's record to themselves (or vice versa), so
// an update body that touches supplier_id must still match their own.
const SUPPLIER_PORTAL_WRITE_TYPES = ['BookingRequest', 'SupplierService'];

// updateEntity/deleteEntity call this *before* fetching the row (permission
// is checked before existence is confirmed, so an unauthorized caller can't
// distinguish "forbidden" from "doesn't exist" for a record it can't touch
// anyway). Task's ownership bypass below needs the row regardless, so it
// does its own narrow lookup by `id` rather than changing that order for
// every entity type.
function requireEntityPermission(user, entityType, action, id, body) {
  if (user?.linked_supplier_id && SUPPLIER_PORTAL_WRITE_TYPES.includes(entityType)) {
    if (action === 'create' && body?.supplier_id !== user.linked_supplier_id) {
      throw new ForbiddenError('supplier_id must match your linked supplier');
    }
    if (action === 'update' && body?.supplier_id !== undefined && body.supplier_id !== user.linked_supplier_id) {
      throw new ForbiddenError('supplier_id must match your linked supplier');
    }
    return;
  }

  // Task: the assignee or creator may update/delete their own task (mark it
  // complete, edit it, cancel it) without needing modify_trips/delete_trips —
  // those permissions gate managing *other* people's tasks (reassigning,
  // bulk cleanup), not working your own to-do list. Without this, an agent
  // (who has create_trips but not modify_trips by default) could create a
  // task-generating trip yet be unable to ever complete the tasks it
  // auto-assigned to them.
  if (entityType === 'Task' && (action === 'update' || action === 'delete') && id && user?.id) {
    const db = getDb();
    const row = db.prepare("SELECT data FROM entities WHERE type = 'Task' AND id = ?").get(id);
    if (row) {
      const data = JSON.parse(row.data);
      if (data.assigned_to_user_id === user.id || data.created_by === user.id) return;
    }
  }

  const mapping = ENTITY_PERMISSION_MAP[entityType];
  if (!mapping) return;
  const requiredPermission = mapping[action];
  if (!requiredPermission) return;
  const userTier = user?.user_tier || 'agent';
  const customPermissions = user?.custom_permissions || [];
  const perms = Array.isArray(customPermissions) ? customPermissions : [];
  if (!hasPermission(userTier, perms, requiredPermission)) {
    throw new ForbiddenError(`Missing required permission: ${requiredPermission}`);
  }
}

export function upsertFts(db, id, type, data) {
  if (!hasFts(db)) return;
  try {
    db.prepare('DELETE FROM entities_fts WHERE id = ?').run(id);
    db.prepare('INSERT INTO entities_fts(id, type, label, content) VALUES (?, ?, ?, ?)').run(
      id,
      type,
      type,
      JSON.stringify(data),
    );
  } catch {}
}

function deleteFts(db, id) {
  if (!hasFts(db)) return;
  try {
    db.prepare('DELETE FROM entities_fts WHERE id = ?').run(id);
  } catch {}
}

/**
 * Row-level access check applied to every generic-entity read/write: admins
 * and managers see everything, client/supplier portal users are scoped to
 * their own records, and other staff (agent/accounting) see a type wholesale
 * only when a permission grants it ({@link staffCanReadType}) — otherwise
 * just their own records. Writes are additionally gated by the separate
 * `ENTITY_PERMISSION_MAP` permission-key check in `requireEntityPermission`.
 * @returns {boolean} Whether `user` may access this entity record.
 */
export function userCanAccessEntity(user, entityType, entityData) {
  const tier = user.user_tier || 'agent';
  if (tier === 'admin' || tier === 'manager') return true;

  // Global branding/config singleton (app name, logo, invoice header) with no
  // owner or client scoping — every authenticated user, including client-
  // portal accounts, needs to read it so client-facing documents (proposals,
  // invoices, itineraries) show consistent agency branding.
  if (entityType === 'AppSettings') return true;

  // Guided tours are a public catalog (descriptions + cover photos shown in
  // the client portal). Client-portal accounts may read them so the portal can
  // render the catalog. Writes remain gated by ENTITY_PERMISSION_MAP, which
  // grants the 'client' tier no manage_guided_tours permission. Staff without
  // the read permission still only see their own records via the fallback
  // below.
  if (entityType === 'GuidedTour' && (user.user_tier === 'client' || user.client_id)) return true;

  if (USER_SCOPED_TYPES.includes(entityType)) {
    return entityData.user_id === user.id || entityData.created_by === user.id;
  }

  // Client portal users (linked to a client) can only see their own client's data
  if (user.client_id) {
    if (CLIENT_SCOPED_TYPES.includes(entityType)) {
      return entityData.client_id === user.client_id;
    }
    // They may also always read (not write — that's separately gated by
    // ENTITY_PERMISSION_MAP, which grants the 'client' tier no modify_clients
    // permission) their own CRM Client record, since the portal needs it to
    // resolve "who am I" (see ClientPortal.jsx and friends).
    if (entityType === 'Client') {
      return entityData.id === user.client_id;
    }
    // ...and the Company their own Client record belongs to, since a
    // contact billed to a company (see Client.company_id) needs to see that
    // company's billing details (tax ID, invoice address) on their invoices.
    if (entityType === 'Company') {
      const db = getDb();
      const row = db.prepare("SELECT data FROM entities WHERE type = 'Client' AND id = ?").get(user.client_id);
      if (!row) return false;
      const myClient = JSON.parse(row.data);
      return myClient.company_id === entityData.id;
    }
  }

  // Supplier portal users can only see their own supplier's data
  if (user.linked_supplier_id) {
    // Their own Supplier record, since the portal needs it to resolve "who
    // am I" (see SupplierPortal.jsx) — not writable (ENTITY_PERMISSION_MAP
    // grants the 'supplier' tier no modify_suppliers* permission).
    if (entityType === 'Supplier') {
      return entityData.id === user.linked_supplier_id;
    }
    if (
      entityType === 'SupplierBooking' ||
      entityType === 'SupplierInvoice' ||
      entityType === 'BookingRequest' ||
      entityType === 'SupplierService' ||
      entityType === 'SupplierReview'
    ) {
      return entityData.supplier_id === user.linked_supplier_id;
    }
  }

  // Staff agents/accounting: full read access to a type only when a
  // permission grants it (see staffCanReadType); otherwise they fall through
  // to the own-records check below.
  if ((tier === 'agent' || tier === 'accounting') && staffCanReadType(user, entityType)) return true;

  return entityData.created_by === user.id || entityData.user_id === user.id;
}

/**
 * Strip prototype-pollution-prone keys (`__proto__`, `constructor`,
 * `prototype`) and Mongo-style operator/dotted keys before storing user input
 * as JSON.
 * @returns {*} The sanitized copy (non-objects/arrays are returned as-is).
 */
export function sanitizeEntityData(data) {
  if (data === null || data === undefined || Array.isArray(data)) return data;
  const safe = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (key.startsWith('$') || key.includes('.')) continue;
    safe[key] = value;
  }
  return safe;
}

/**
 * Fields a type computes on read and must never accept back on write.
 *
 * `listTasks`/`enrichTask` (services/tasks.js) attach live SLA flags to every
 * Task it returns, so a client that echoes a whole task object back into
 * `PUT /api/entities/Task/:id` (which the Task Board's drag-and-drop used to
 * do) would freeze a derived value into storage. `is_escalated` is the
 * damaging one: `enrichTask` treats a stored `true` as authoritative, so a
 * task persisted that way stays escalated forever regardless of its due date.
 * The engine's own writers (`patchTask`, `insertTask`) bypass this layer with
 * direct SQL, so stripping here doesn't affect them.
 */
const DERIVED_ENTITY_FIELDS = {
  Task: ['is_overdue', 'is_due_soon', 'is_escalated'],
};

/** Drop {@link DERIVED_ENTITY_FIELDS} for `type` from a write payload. */
function stripDerivedFields(type, data) {
  const derived = DERIVED_ENTITY_FIELDS[type];
  if (!derived || !data || typeof data !== 'object' || Array.isArray(data)) return data;
  const clean = { ...data };
  for (const key of derived) delete clean[key];
  return clean;
}

/** @throws {BadRequestError} If `type` isn't a registered entity type. */
export function assertValidEntityType(type) {
  const entities = getEntities();
  if (!entities.includes(type)) {
    throw new BadRequestError(`Unknown entity type: ${type}`, 'UNKNOWN_ENTITY_TYPE');
  }
}

/** @returns {object|null} Parsed JSON filter, or null if missing/invalid JSON. */
export function parseFilter(filterStr) {
  if (!filterStr) return null;
  try {
    return JSON.parse(filterStr);
  } catch {
    return null;
  }
}

/**
 * Reject filters using dotted/`$`-prefixed keys (except the allowed `$in`,
 * `$gte`, `$lte` operators), to keep query filters from reaching into nested
 * JSON structure or unsupported operators.
 * @returns {boolean} True if the filter is safe to apply.
 */
export function isFilterSafe(filter) {
  if (!filter || typeof filter !== 'object') return true;
  for (const [k, v] of Object.entries(filter)) {
    if (k.startsWith('$') || k.includes('.')) return false;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const validOps = ['$in', '$gte', '$lte'];
      for (const op of Object.keys(v)) {
        if (!validOps.includes(op)) return false;
      }
    }
  }
  return true;
}

/**
 * Whether `user` has unconditional read access to every row of `type` — i.e.
 * {@link userCanAccessEntity} would return `true` for any row of this type
 * without needing to inspect its data. Mirrors the row-independent branches
 * of `userCanAccessEntity` (admin/manager, the `AppSettings` singleton, and
 * staff with a read grant via {@link staffCanReadType}). Portal users
 * (client/supplier) and the row-scoped fallback always return `false` here.
 *
 * This is what lets {@link findEntities} push filtering/sorting/pagination
 * into SQL: when true, no per-row access check is needed, so the query can
 * go straight to the database instead of loading the whole table into JS.
 * Row-scoped cases stay on the existing JS path — those views are already
 * naturally bounded (one client's/supplier's/user's records), so they don't
 * have the large-table scaling problem this optimizes for.
 */
function hasUnconditionalReadAccess(user, type) {
  const tier = user.user_tier || 'agent';
  if (tier === 'admin' || tier === 'manager') return true;
  if (type === 'AppSettings') return true;
  if (user.client_id || user.linked_supplier_id) return false;
  if (USER_SCOPED_TYPES.includes(type)) return false;
  if ((tier === 'agent' || tier === 'accounting') && staffCanReadType(user, type)) return true;
  return false;
}

/**
 * SQL expression for reading a flattened-record field back out of an
 * `entities` row. `id`/`created_date`/`updated_date` are real columns;
 * every other field lives inside the JSON `data` blob. The field name is
 * never concatenated into the SQL text — the JSON path is always passed as
 * a bound parameter, so an arbitrary/attacker-controlled field name can only
 * ever be interpreted as a JSON path string, never as SQL syntax.
 * @returns {{expr: string, pathParam: string|null}}
 */
function fieldColumnSql(field) {
  if (field === 'id' || field === 'created_date' || field === 'updated_date') {
    return { expr: field, pathParam: null };
  }
  return { expr: 'json_extract(data, ?)', pathParam: `$.${field}` };
}

/** better-sqlite3 can't bind JS booleans directly; everything else passes through. */
function toSqlParam(v) {
  return typeof v === 'boolean' ? (v ? 1 : 0) : v;
}

/**
 * Translates a parsed entity filter (equality, or `$in`/`$gte`/`$lte`) into a
 * SQL WHERE fragment plus its bound parameters, matching {@link applyFilter}'s
 * semantics: plain values compare case-insensitively as strings (mirroring
 * `String(val).toLowerCase()`), except booleans, which compare against
 * SQLite's integer 0/1 representation of JSON true/false directly (casting
 * to text would compare against '1'/'0' instead of the JS `String(true)`
 * form, so booleans need their own branch). `$in`/`$gte`/`$lte` compare the
 * raw extracted value, same as the JS path.
 * @returns {{sql: string|null, params: any[]}}
 */
function buildFilterSql(filter) {
  const clauses = [];
  const params = [];
  for (const [field, v] of Object.entries(filter)) {
    const { expr, pathParam } = fieldColumnSql(field);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      if ('$in' in v) {
        const arr = Array.isArray(v.$in) ? v.$in : [];
        if (arr.length === 0) {
          clauses.push('0');
          continue;
        }
        if (pathParam) params.push(pathParam);
        clauses.push(`${expr} IN (${arr.map(() => '?').join(', ')})`);
        params.push(...arr.map(toSqlParam));
      } else {
        // $gte and $lte may be combined into a single range (e.g. { $gte: 100,
        // $lte: 200 }); apply both rather than silently dropping one.
        const rangeClauses = [];
        if ('$gte' in v) {
          if (pathParam) params.push(pathParam);
          rangeClauses.push(`${expr} >= ?`);
          params.push(toSqlParam(v.$gte));
        }
        if ('$lte' in v) {
          if (pathParam) params.push(pathParam);
          rangeClauses.push(`${expr} <= ?`);
          params.push(toSqlParam(v.$lte));
        }
        if (rangeClauses.length) clauses.push(rangeClauses.join(' AND '));
      }
    } else if (typeof v === 'boolean') {
      if (pathParam) params.push(pathParam);
      clauses.push(`${expr} = ?`);
      params.push(v ? 1 : 0);
    } else {
      if (pathParam) params.push(pathParam);
      clauses.push(`LOWER(COALESCE(CAST(${expr} AS TEXT), '')) = LOWER(?)`);
      params.push(String(v));
    }
  }
  return { sql: clauses.length ? clauses.join(' AND ') : null, params };
}

/**
 * SQL `ORDER BY` fragment for {@link applySort}'s `sort` string (leading `-`
 * means descending). Note: SQLite's default BINARY collation sorts text
 * byte-by-byte, while `applySort` uses `localeCompare` — these agree for
 * plain ASCII (dates, statuses, ids) but can differ on accented characters.
 * @returns {{sql: string, params: any[]}}
 */
function buildSortSql(sort) {
  if (!sort) return { sql: '', params: [] };
  const dir = sort.startsWith('-') ? 'DESC' : 'ASC';
  const field = sort.replace(/^-/, '');
  const { expr, pathParam } = fieldColumnSql(field);
  return { sql: ` ORDER BY ${expr} ${dir}`, params: pathParam ? [pathParam] : [] };
}

/**
 * SQL-pushed-down counterpart of the plain JS path in {@link findEntities},
 * used when {@link hasUnconditionalReadAccess} holds (so no per-row access
 * check is needed) and there's no `search` term (full-text substring search
 * across every field isn't practical to express via `json_extract` without
 * knowing the field names up front — that's what `entities_fts` is for).
 * @returns {object[]|{data: object[], total: number}}
 */
function findEntitiesSql(db, type, { sort, filter, limit, offset }) {
  const where = ['type = ?'];
  const params = [type];

  if (filter) {
    const parsed = parseFilter(filter);
    if (!parsed || !isFilterSafe(parsed)) {
      throw new BadRequestError('Invalid filter', 'INVALID_FILTER');
    }
    const built = buildFilterSql(parsed);
    if (built.sql) {
      where.push(`(${built.sql})`);
      params.push(...built.params);
    }
  }

  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM entities WHERE ${whereSql}`).get(...params).c;

  const order = buildSortSql(sort);
  const queryParams = [...params, ...order.params];

  if (limit !== undefined || offset !== undefined) {
    const start = offset !== undefined ? Number(offset) : 0;
    const size = limit !== undefined ? Number(limit) : undefined;
    if (!Number.isInteger(start) || start < 0 || (size !== undefined && (!Number.isInteger(size) || size < 0))) {
      throw new BadRequestError('Invalid limit/offset', 'INVALID_PAGINATION');
    }
    queryParams.push(size !== undefined ? size : -1, start);
    const rows = db
      .prepare(`SELECT * FROM entities WHERE ${whereSql}${order.sql} LIMIT ? OFFSET ?`)
      .all(...queryParams);
    return { data: rows.map(mapRecord), total };
  }

  const rows = db.prepare(`SELECT * FROM entities WHERE ${whereSql}${order.sql}`).all(...queryParams);
  return rows.map(mapRecord);
}

/**
 * Filter raw entity rows by both access control ({@link userCanAccessEntity})
 * and field-match filter conditions (equality, or `$in`/`$gte`/`$lte`).
 * @returns {object[]} Rows (still raw, with `data` as a JSON string) that pass both checks.
 */
export function applyFilter(records, filter, user, type) {
  return records.filter((r) => {
    const data = JSON.parse(r.data);
    // id lives in the row, not the JSON body — userCanAccessEntity needs it
    // (e.g. to match a Client record's own id against user.client_id).
    if (!userCanAccessEntity(user, type, { ...data, id: r.id })) return false;
    return Object.entries(filter).every(([k, v]) => {
      const val = data[k];
      if (v !== null && typeof v === 'object') {
        if ('$in' in v) return Array.isArray(v.$in) && v.$in.includes(val);
        // $gte and $lte may be combined into a single range; apply both.
        const hasGte = '$gte' in v;
        const hasLte = '$lte' in v;
        if (hasGte || hasLte) {
          let ok = true;
          if (hasGte) ok = ok && val >= v.$gte;
          if (hasLte) ok = ok && val <= v.$lte;
          return ok;
        }
      }
      return String(val ?? '').toLowerCase() === String(v).toLowerCase();
    });
  });
}

/**
 * @param {string} [sort] - Field name; a leading `-` means descending.
 * @returns {object[]} A new sorted array (input is not mutated).
 */
export function applySort(records, sort) {
  if (!sort) return records;
  const dir = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^-/, '');
  return [...records].sort((a, b) => {
    const av = a[field] ?? '',
      bv = b[field] ?? '';
    return dir * (typeof av === 'string' ? av.localeCompare(bv) : av - bv);
  });
}

/** @returns {object} A raw `entities` row flattened into `{ id, ...data, created_date, updated_date }`. */
export function mapRecord(r) {
  return { id: r.id, ...JSON.parse(r.data), created_date: r.created_date, updated_date: r.updated_date };
}

function matchesSearch(record, search) {
  const needle = search.toLowerCase();
  return Object.values(record).some((v) => typeof v === 'string' && v.toLowerCase().includes(needle));
}

/**
 * Core generic-entity list query: access-controlled, optionally filtered,
 * text-searched, sorted, and paginated.
 * @returns {object[]|{data: object[], total: number}} Plain array if no
 *   limit/offset given (back-compat for existing call sites), otherwise a
 *   paginated `{ data, total }` envelope.
 */
export function findEntities(type, { sort, filter, search, limit, offset, user } = {}) {
  assertValidEntityType(type);
  const db = getDb();

  if (!(search && search.trim()) && hasUnconditionalReadAccess(user, type)) {
    return findEntitiesSql(db, type, { sort, filter, limit, offset });
  }

  let records;
  if (filter) {
    const parsed = parseFilter(filter);
    if (!parsed || !isFilterSafe(parsed)) {
      throw new BadRequestError('Invalid filter', 'INVALID_FILTER');
    }
    const raw = db.prepare('SELECT * FROM entities WHERE type = ?').all(type);
    records = applyFilter(raw, parsed, user, type).map(mapRecord);
  } else {
    records = db.prepare('SELECT * FROM entities WHERE type = ?').all(type).map(mapRecord);
    records = records.filter((r) => userCanAccessEntity(user, type, r));
  }

  if (search && search.trim()) {
    records = records.filter((r) => matchesSearch(r, search.trim()));
  }

  records = applySort(records, sort);

  // Pagination is opt-in: callers that don't pass limit/offset keep getting
  // the plain array they always have, so the ~90 existing call sites that
  // just want "everything" aren't affected.
  if (limit !== undefined || offset !== undefined) {
    const start = offset !== undefined ? Number(offset) : 0;
    const size = limit !== undefined ? Number(limit) : undefined;
    if (!Number.isInteger(start) || start < 0 || (size !== undefined && (!Number.isInteger(size) || size < 0))) {
      throw new BadRequestError('Invalid limit/offset', 'INVALID_PAGINATION');
    }
    const end = size !== undefined ? start + size : undefined;
    return { data: records.slice(start, end), total: records.length };
  }
  return records;
}

/**
 * @returns {object} The entity, mapped via {@link mapRecord}.
 * @throws {NotFoundError|ForbiddenError}
 */
export function findEntityById(type, id, user) {
  assertValidEntityType(type);
  const db = getDb();
  const record = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
  if (!record) throw new NotFoundError('Record not found');

  const data = mapRecord(record);
  if (!userCanAccessEntity(user, type, data)) {
    throw new ForbiddenError('Access denied');
  }
  return data;
}

/**
 * Insert a new entity row, stamping `created_by` and keeping the FTS index in sync.
 * @returns {object} The created entity.
 * @throws {ForbiddenError} If the user lacks the type's create permission.
 */
export function createEntity(type, body, user) {
  assertValidEntityType(type);
  requireEntityPermission(user, type, 'create', undefined, body);
  const now = new Date().toISOString();
  const id = uid();
  const data = sanitizeEntityData({ ...stripDerivedFields(type, body) });
  data.created_by = user.id;
  delete data.id;

  const db = getDb();
  const insert = db.transaction(() => {
    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
      id,
      type,
      JSON.stringify(data),
      now,
      now,
    );
    upsertFts(db, id, type, data);
  });
  insert();

  return { id, ...data, created_date: now, updated_date: now };
}

/**
 * Merge `body` into an existing entity's JSON data and keep the FTS index in sync.
 * @returns {object} The updated entity.
 * @throws {NotFoundError|ForbiddenError}
 */
export function updateEntity(type, id, body, user) {
  assertValidEntityType(type);
  requireEntityPermission(user, type, 'update', id, body);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
  if (!existing) throw new NotFoundError('Record not found');

  const existingData = JSON.parse(existing.data);
  if (!userCanAccessEntity(user, type, existingData)) {
    throw new ForbiddenError('Access denied');
  }

  const now = new Date().toISOString();
  const newData = sanitizeEntityData({ ...existingData, ...stripDerivedFields(type, body) });
  delete newData.id;

  const update = db.transaction(() => {
    db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(newData), now, id);
    upsertFts(db, id, type, newData);
  });
  update();

  return { id, ...newData, created_date: existing.created_date, updated_date: now };
}

/**
 * Delete an entity row and remove it from the FTS index.
 * @returns {object} The deleted entity, as it was before removal.
 * @throws {NotFoundError|ForbiddenError}
 */
export function deleteEntity(type, id, user) {
  assertValidEntityType(type);
  requireEntityPermission(user, type, 'delete', id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
  if (!existing) throw new NotFoundError('Record not found');

  const existingData = JSON.parse(existing.data);
  if (!userCanAccessEntity(user, type, existingData)) {
    throw new ForbiddenError('Access denied');
  }

  const del = db.transaction(() => {
    db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    deleteFts(db, id);
  });
  del();

  return { id, ...existingData, created_date: existing.created_date, updated_date: existing.updated_date };
}

const MAX_BULK_SIZE = 500;

/**
 * Create up to {@link MAX_BULK_SIZE} entities in a single transaction.
 * @returns {object[]} The created entities.
 * @throws {BadRequestError} If `records` is empty or exceeds the bulk size limit.
 */
export function bulkCreateEntities(type, records, user) {
  assertValidEntityType(type);
  requireEntityPermission(user, type, 'create');
  if (!Array.isArray(records) || records.length === 0) {
    throw new BadRequestError('records must be a non-empty array');
  }
  if (records.length > MAX_BULK_SIZE) {
    throw new BadRequestError(`Cannot create more than ${MAX_BULK_SIZE} records at once`);
  }

  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.transaction((items) =>
    items.map((body) => {
      const id = uid();
      const data = sanitizeEntityData({ ...body });
      data.created_by = user.id;
      delete data.id;
      db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
        id,
        type,
        JSON.stringify(data),
        now,
        now,
      );
      upsertFts(db, id, type, data);
      return { id, ...data, created_date: now, updated_date: now };
    }),
  );

  return insert(records);
}

/**
 * Apply the same field patch to multiple entities in one transaction.
 * Inaccessible or missing records are skipped rather than failing the whole
 * batch — the caller gets back exactly which ids succeeded.
 * @returns {{updated: object[], skipped: {id: string, reason: string}[]}}
 * @throws {BadRequestError} If `ids` is empty or exceeds the bulk size limit.
 */
export function bulkUpdateEntities(type, ids, body, user) {
  assertValidEntityType(type);
  requireEntityPermission(user, type, 'update');
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new BadRequestError('ids must be a non-empty array');
  }
  if (ids.length > MAX_BULK_SIZE) {
    throw new BadRequestError(`Cannot update more than ${MAX_BULK_SIZE} records at once`);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const newFields = sanitizeEntityData({ ...body });
  delete newFields.id;

  const run = db.transaction((idList) => {
    const updated = [];
    const skipped = [];
    for (const id of idList) {
      const existing = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
      if (!existing) {
        skipped.push({ id, reason: 'not_found' });
        continue;
      }

      const existingData = JSON.parse(existing.data);
      if (!userCanAccessEntity(user, type, existingData)) {
        skipped.push({ id, reason: 'forbidden' });
        continue;
      }

      const newData = { ...existingData, ...newFields };
      db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(newData), now, id);
      upsertFts(db, id, type, newData);
      updated.push({ id, ...newData, created_date: existing.created_date, updated_date: now });
    }
    return { updated, skipped };
  });

  return run(ids);
}

/**
 * Delete multiple entities in one transaction; inaccessible or missing
 * records are skipped rather than failing the whole batch.
 * @returns {{deleted: string[], skipped: {id: string, reason: string}[]}}
 * @throws {BadRequestError} If `ids` is empty or exceeds the bulk size limit.
 */
export function bulkDeleteEntities(type, ids, user) {
  assertValidEntityType(type);
  requireEntityPermission(user, type, 'delete');
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new BadRequestError('ids must be a non-empty array');
  }
  if (ids.length > MAX_BULK_SIZE) {
    throw new BadRequestError(`Cannot delete more than ${MAX_BULK_SIZE} records at once`);
  }

  const db = getDb();

  const run = db.transaction((idList) => {
    const deleted = [];
    const skipped = [];
    for (const id of idList) {
      const existing = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
      if (!existing) {
        skipped.push({ id, reason: 'not_found' });
        continue;
      }

      const existingData = JSON.parse(existing.data);
      if (!userCanAccessEntity(user, type, existingData)) {
        skipped.push({ id, reason: 'forbidden' });
        continue;
      }

      db.prepare('DELETE FROM entities WHERE id = ?').run(id);
      deleteFts(db, id);
      deleted.push(id);
    }
    return { deleted, skipped };
  });

  return run(ids);
}
