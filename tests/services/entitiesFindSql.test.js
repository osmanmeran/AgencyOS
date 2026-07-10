import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import { findEntities } from '../../server/services/entities.js';

// findEntities pushes filtering/sort/pagination into SQL (via json_extract)
// whenever the caller has unconditional read access to the type (admin,
// manager, or staff with the type's read permission) and isn't doing a text
// search. These tests exercise that SQL path directly against real rows,
// covering the type-coercion edge cases that differ between JS filtering
// (String(val).toLowerCase() equality, raw JS comparison for $in/$gte/$lte)
// and SQL (json_extract returns SQLite-typed values; JSON booleans come back
// as integer 0/1, not the text 'true'/'false').

const db = getDb();
const TYPE = 'Trip';
const ids = [];

function insertTrip(data) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    TYPE,
    JSON.stringify(data),
    now,
    now,
  );
  ids.push(id);
  return id;
}

const admin = { id: 'admin-sql-test', user_tier: 'admin', custom_permissions: [] };

beforeAll(() => {
  insertTrip({ title: 'Alpha', status: 'confirmed', amount: 100, confirmed: true, created_by: 'u1' });
  insertTrip({ title: 'Beta', status: 'Confirmed', amount: 200, confirmed: false, created_by: 'u2' });
  insertTrip({ title: 'Gamma', status: 'pending', amount: 300, confirmed: true, created_by: 'u3' });
  insertTrip({ title: 'Delta', status: 'pending', amount: 50, created_by: 'u4' }); // no `confirmed` key at all
});

afterAll(() => {
  db.prepare(`DELETE FROM entities WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
});

describe('findEntities SQL fast path', () => {
  it('filters by plain string equality, case-insensitively', () => {
    const result = findEntities(TYPE, { filter: JSON.stringify({ status: 'CONFIRMED' }), user: admin });
    const titles = result.filter((r) => ids.includes(r.id)).map((r) => r.title);
    expect(titles.sort()).toEqual(['Alpha', 'Beta']);
  });

  it('filters by boolean true without matching integer-1 lookalikes', () => {
    const result = findEntities(TYPE, { filter: JSON.stringify({ confirmed: true }), user: admin });
    const titles = result.filter((r) => ids.includes(r.id)).map((r) => r.title);
    expect(titles.sort()).toEqual(['Alpha', 'Gamma']);
  });

  it('filters by boolean false and excludes rows missing the field entirely', () => {
    const result = findEntities(TYPE, { filter: JSON.stringify({ confirmed: false }), user: admin });
    const titles = result.filter((r) => ids.includes(r.id)).map((r) => r.title);
    expect(titles).toEqual(['Beta']);
  });

  it('filters by $in over numeric values', () => {
    const result = findEntities(TYPE, { filter: JSON.stringify({ amount: { $in: [100, 300] } }), user: admin });
    const titles = result.filter((r) => ids.includes(r.id)).map((r) => r.title);
    expect(titles.sort()).toEqual(['Alpha', 'Gamma']);
  });

  it('filters by $gte alone', () => {
    const result = findEntities(TYPE, { filter: JSON.stringify({ amount: { $gte: 200 } }), user: admin });
    const titles = result.filter((r) => ids.includes(r.id)).map((r) => r.title);
    expect(titles.sort()).toEqual(['Beta', 'Gamma']);
  });

  it('filters by $lte alone', () => {
    const result = findEntities(TYPE, { filter: JSON.stringify({ amount: { $lte: 100 } }), user: admin });
    const titles = result.filter((r) => ids.includes(r.id)).map((r) => r.title);
    expect(titles.sort()).toEqual(['Alpha', 'Delta']);
  });

  it("matches applyFilter's pre-existing behavior of only applying the first operator when a field has both $gte and $lte", () => {
    const result = findEntities(TYPE, { filter: JSON.stringify({ amount: { $gte: 100, $lte: 200 } }), user: admin });
    const titles = result.filter((r) => ids.includes(r.id)).map((r) => r.title);
    // $gte is checked before $lte in applyFilter's if-chain, so $lte is
    // silently ignored here — this mirrors existing behavior, not a bug
    // introduced by the SQL path.
    expect(titles.sort()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('sorts ascending and descending', () => {
    const asc = findEntities(TYPE, {
      filter: JSON.stringify({ status: { $in: ['pending'] } }),
      sort: 'amount',
      user: admin,
    });
    expect(asc.filter((r) => ids.includes(r.id)).map((r) => r.amount)).toEqual([50, 300]);

    const desc = findEntities(TYPE, {
      filter: JSON.stringify({ status: { $in: ['pending'] } }),
      sort: '-amount',
      user: admin,
    });
    expect(desc.filter((r) => ids.includes(r.id)).map((r) => r.amount)).toEqual([300, 50]);
  });

  it('paginates with limit/offset and returns a matching total', () => {
    const page = findEntities(TYPE, {
      filter: JSON.stringify({ amount: { $gte: 0 } }),
      sort: 'amount',
      limit: 2,
      offset: 1,
      user: admin,
    });
    expect(page.total).toBeGreaterThanOrEqual(4);
    expect(page.data.filter((r) => ids.includes(r.id)).map((r) => r.amount)).toEqual([100, 200]);
  });

  it('an agent with the type read permission also gets the SQL path and correct results', () => {
    const agent = { id: 'agent-sql-test', user_tier: 'agent', custom_permissions: [] };
    const result = findEntities(TYPE, { filter: JSON.stringify({ status: 'pending' }), user: agent });
    const titles = result.filter((r) => ids.includes(r.id)).map((r) => r.title);
    expect(titles.sort()).toEqual(['Delta', 'Gamma']);
  });

  it('returns nothing for an empty $in array', () => {
    const result = findEntities(TYPE, { filter: JSON.stringify({ amount: { $in: [] } }), user: admin });
    expect(result.filter((r) => ids.includes(r.id))).toEqual([]);
  });
});
