import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import { searchAll } from '../../server/services/search.js';

// Staff user object as it appears on req.user after auth middleware.
const staffUser = { id: 'user1', user_tier: 'admin', custom_permissions: [] };

const db = getDb();

function insertEntity(type, data) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    type,
    JSON.stringify(data),
    now,
    now,
  );
  return id;
}

function insertUser({ name, email, tier = 'agent', active = 1 }) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, email, 'hashed', name, tier, tier, active, now, now);
  return id;
}

describe('Search Service', () => {
  let clientId;
  let tripId;

  beforeAll(() => {
    db.prepare(`DELETE FROM entities WHERE type IN ('Client', 'Trip')`).run();
    db.prepare(`DELETE FROM users WHERE email LIKE 'search-test-%'`).run();

    clientId = insertEntity('Client', {
      name: 'Zanzibar Import Co',
      email: 'zanzibar@example.com',
      phone: '123',
      company: 'Zanzibar Ltd',
    });
    tripId = insertEntity('Trip', {
      name: 'Kilimanjaro Trek',
      destination: 'Zanzibar',
      client_name: 'Zanzibar Import Co',
      reference: 'TRP-001',
      status: 'confirmed',
    });
    insertUser({ name: 'Zanzibar Agent', email: 'search-test-zanzibar@example.com' });
  });

  it('returns [] for empty query', () => {
    expect(searchAll('', staffUser)).toEqual([]);
  });

  it('returns [] for single-character query', () => {
    expect(searchAll('z', staffUser)).toEqual([]);
  });

  it('finds matching clients and trips by prefix', () => {
    const results = searchAll('Zanzibar', staffUser);
    const types = results.map((r) => r.type);
    expect(types).toContain('Client');
    expect(types).toContain('Trip');

    const client = results.find((r) => r.id === clientId);
    expect(client.label).toBe('Zanzibar Import Co');
    expect(client.url).toBe(`/ClientDetails?id=${clientId}`);
  });

  it('finds matching active users', () => {
    const results = searchAll('Zanzibar', staffUser);
    const user = results.find((r) => r.type === 'User');
    expect(user).toBeTruthy();
    expect(user.label).toBe('Zanzibar Agent');
  });

  it('does not match unrelated queries', () => {
    const results = searchAll('nonexistent-xyz-query', staffUser);
    expect(results).toEqual([]);
  });

  it('scopes results for client-portal users to their own records and hides the staff directory', () => {
    const clientUser = { id: 'portal1', user_tier: 'client', client_id: 'some-other-client', custom_permissions: [] };
    const results = searchAll('Zanzibar', clientUser);
    // Trip belongs to a different client; Client record is not theirs; no User hits
    expect(results.find((r) => r.id === tripId)).toBeUndefined();
    expect(results.find((r) => r.id === clientId)).toBeUndefined();
    expect(results.find((r) => r.type === 'User')).toBeUndefined();

    const ownerUser = { id: 'portal2', user_tier: 'client', client_id: clientId, custom_permissions: [] };
    const ownResults = searchAll('Zanzibar', ownerUser);
    expect(ownResults.find((r) => r.id === clientId)).toBeTruthy();
  });

  it('skips rows with unparseable JSON without throwing', () => {
    const badId = uid();
    const now = new Date().toISOString();
    // The 013 functional indexes reject malformed JSON on insert — but a DB that
    // actually contains malformed rows is exactly the case where migration 013
    // skips creating them (see its json_valid guard). Drop them here to model
    // that state so we can insert a bad row and verify search stays resilient.
    // (020's Task indexes and 022's share_token index are dropped for the same reason.)
    db.exec(`
      DROP INDEX IF EXISTS idx_entities_type_status;
      DROP INDEX IF EXISTS idx_entities_type_due_date;
      DROP INDEX IF EXISTS idx_entities_type_proposal_status;
      DROP INDEX IF EXISTS idx_entities_type_client_id;
      DROP INDEX IF EXISTS idx_entities_type_approval_status;
      DROP INDEX IF EXISTS idx_entities_type_task_booking_id;
      DROP INDEX IF EXISTS idx_entities_type_task_customer_id;
      DROP INDEX IF EXISTS idx_entities_type_task_supplier_id;
      DROP INDEX IF EXISTS idx_entities_type_task_assigned_user;
      DROP INDEX IF EXISTS idx_entities_type_task_status;
      DROP INDEX IF EXISTS idx_entities_type_task_priority;
      DROP INDEX IF EXISTS idx_entities_type_task_due_date;
      DROP INDEX IF EXISTS idx_entities_type_task_escalated;
      DROP INDEX IF EXISTS idx_entities_type_share_token;
    `);
    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
      badId,
      'Client',
      '{not valid json Zanzibar',
      now,
      now,
    );

    expect(() => searchAll('Zanzibar', staffUser)).not.toThrow();
    const results = searchAll('Zanzibar', staffUser);
    expect(results.find((r) => r.id === badId)).toBeUndefined();
  });
});
