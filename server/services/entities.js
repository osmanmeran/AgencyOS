import { getDb, uid, getEntities } from '../db.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errors.js';

const USER_SCOPED_TYPES = ['Message', 'ClientTask', 'EmailLog'];
const CLIENT_SCOPED_TYPES = ['Trip', 'Proposal', 'Invoice', 'ClientPayment'];

function hasFts(db) {
  try { db.prepare("SELECT 1 FROM entities_fts LIMIT 0").get(); return true; } catch { return false; }
}

function upsertFts(db, id, type, data) {
  if (!hasFts(db)) return;
  try {
    db.prepare("DELETE FROM entities_fts WHERE id = ?").run(id);
    db.prepare("INSERT INTO entities_fts(id, type, label, content) VALUES (?, ?, ?, ?)").run(id, type, type, JSON.stringify(data));
  } catch {}
}

function deleteFts(db, id) {
  if (!hasFts(db)) return;
  try { db.prepare("DELETE FROM entities_fts WHERE id = ?").run(id); } catch {}
}

export function userCanAccessEntity(user, entityType, entityData) {
  const tier = user.user_tier || 'agent';
  if (tier === 'admin' || tier === 'manager') return true;

  if (USER_SCOPED_TYPES.includes(entityType)) {
    return entityData.user_id === user.id || entityData.created_by === user.id;
  }

  // Client portal users (linked to a client) can only see their own client's data
  if (user.client_id) {
    if (CLIENT_SCOPED_TYPES.includes(entityType)) {
      return entityData.client_id === user.client_id;
    }
  }

  // Supplier portal users can only see their own supplier's data
  if (user.linked_supplier_id) {
    if (entityType === 'SupplierBooking' || entityType === 'SupplierInvoice') {
      return entityData.supplier_id === user.linked_supplier_id;
    }
  }

  // Staff agents/accounting: can see all records (view_all_trips is a client-side permission check)
  if (tier === 'agent' || tier === 'accounting') return true;

  return entityData.created_by === user.id || entityData.user_id === user.id;
}

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

export function assertValidEntityType(type) {
  const entities = getEntities();
  if (!entities.includes(type)) {
    throw new BadRequestError(`Unknown entity type: ${type}`, 'UNKNOWN_ENTITY_TYPE');
  }
}

export function parseFilter(filterStr) {
  if (!filterStr) return null;
  try {
    return JSON.parse(filterStr);
  } catch {
    return null;
  }
}

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

export function applyFilter(records, filter, user, type) {
  return records.filter(r => {
    const data = JSON.parse(r.data);
    if (!userCanAccessEntity(user, type, data)) return false;
    return Object.entries(filter).every(([k, v]) => {
      const val = data[k];
      if (v !== null && typeof v === 'object') {
        if ('$in' in v) return Array.isArray(v.$in) && v.$in.includes(val);
        if ('$gte' in v) return val >= v.$gte;
        if ('$lte' in v) return val <= v.$lte;
      }
      return String(val ?? '').toLowerCase() === String(v).toLowerCase();
    });
  });
}

export function applySort(records, sort) {
  if (!sort) return records;
  const dir = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^-/, '');
  return [...records].sort((a, b) => {
    const av = a[field] ?? '', bv = b[field] ?? '';
    return dir * (typeof av === 'string' ? av.localeCompare(bv) : av - bv);
  });
}

export function mapRecord(r) {
  return { id: r.id, ...JSON.parse(r.data), created_date: r.created_date, updated_date: r.updated_date };
}

function matchesSearch(record, search) {
  const needle = search.toLowerCase();
  return Object.values(record).some(v => typeof v === 'string' && v.toLowerCase().includes(needle));
}

export function findEntities(type, { sort, filter, search, limit, offset, user } = {}) {
  assertValidEntityType(type);
  const db = getDb();

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
    records = records.filter(r => userCanAccessEntity(user, type, r));
  }

  if (search && search.trim()) {
    records = records.filter(r => matchesSearch(r, search.trim()));
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

export function createEntity(type, body, userId) {
  assertValidEntityType(type);
  const now = new Date().toISOString();
  const id = uid();
  const data = sanitizeEntityData({ ...body });
  data.created_by = userId;
  delete data.id;

  const db = getDb();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)')
    .run(id, type, JSON.stringify(data), now, now);

  upsertFts(db, id, type, data);

  return { id, ...data, created_date: now, updated_date: now };
}

export function updateEntity(type, id, body, user) {
  assertValidEntityType(type);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
  if (!existing) throw new NotFoundError('Record not found');

  const existingData = JSON.parse(existing.data);
  if (!userCanAccessEntity(user, type, existingData)) {
    throw new ForbiddenError('Access denied');
  }

  const now = new Date().toISOString();
  const newData = sanitizeEntityData({ ...existingData, ...body });
  delete newData.id;

  db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?')
    .run(JSON.stringify(newData), now, id);

  upsertFts(db, id, type, newData);

  return { id, ...newData, created_date: existing.created_date, updated_date: now };
}

export function deleteEntity(type, id, user) {
  assertValidEntityType(type);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM entities WHERE type = ? AND id = ?').get(type, id);
  if (!existing) throw new NotFoundError('Record not found');

  const existingData = JSON.parse(existing.data);
  if (!userCanAccessEntity(user, type, existingData)) {
    throw new ForbiddenError('Access denied');
  }

  db.prepare('DELETE FROM entities WHERE id = ?').run(id);
  deleteFts(db, id);

  return { id, ...existingData, created_date: existing.created_date, updated_date: existing.updated_date };
}

const MAX_BULK_SIZE = 500;

export function bulkCreateEntities(type, records, userId) {
  assertValidEntityType(type);
  if (!Array.isArray(records) || records.length === 0) {
    throw new BadRequestError('records must be a non-empty array');
  }
  if (records.length > MAX_BULK_SIZE) {
    throw new BadRequestError(`Cannot create more than ${MAX_BULK_SIZE} records at once`);
  }

  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.transaction((items) => items.map(body => {
    const id = uid();
    const data = sanitizeEntityData({ ...body });
    data.created_by = userId;
    delete data.id;
    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)')
      .run(id, type, JSON.stringify(data), now, now);
    upsertFts(db, id, type, data);
    return { id, ...data, created_date: now, updated_date: now };
  }));

  return insert(records);
}

// For update/delete, inaccessible or missing records are skipped rather than
// failing the whole batch — the caller gets back exactly which ids succeeded.
export function bulkUpdateEntities(type, ids, body, user) {
  assertValidEntityType(type);
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
      if (!existing) { skipped.push({ id, reason: 'not_found' }); continue; }

      const existingData = JSON.parse(existing.data);
      if (!userCanAccessEntity(user, type, existingData)) { skipped.push({ id, reason: 'forbidden' }); continue; }

      const newData = { ...existingData, ...newFields };
      db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(newData), now, id);
      upsertFts(db, id, type, newData);
      updated.push({ id, ...newData, created_date: existing.created_date, updated_date: now });
    }
    return { updated, skipped };
  });

  return run(ids);
}

export function bulkDeleteEntities(type, ids, user) {
  assertValidEntityType(type);
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
      if (!existing) { skipped.push({ id, reason: 'not_found' }); continue; }

      const existingData = JSON.parse(existing.data);
      if (!userCanAccessEntity(user, type, existingData)) { skipped.push({ id, reason: 'forbidden' }); continue; }

      db.prepare('DELETE FROM entities WHERE id = ?').run(id);
      deleteFts(db, id);
      deleted.push(id);
    }
    return { deleted, skipped };
  });

  return run(ids);
}
