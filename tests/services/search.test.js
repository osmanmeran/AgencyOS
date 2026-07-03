import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import { searchAll } from '../../server/services/search.js';

const db = getDb();

function insertEntity(type, data) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)')
    .run(id, type, JSON.stringify(data), now, now);
  return id;
}

function insertUser({ name, email, tier = 'agent', active = 1 }) {
  const id = uid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, email, 'hashed', name, tier, tier, active, now, now);
  return id;
}

describe('Search Service', () => {
  let clientId;
  let tripId;

  beforeAll(() => {
    db.prepare(`DELETE FROM entities WHERE type IN ('Client', 'Trip')`).run();
    db.prepare(`DELETE FROM users WHERE email LIKE 'search-test-%'`).run();

    clientId = insertEntity('Client', { name: 'Zanzibar Import Co', email: 'zanzibar@example.com', phone: '123', company: 'Zanzibar Ltd' });
    tripId = insertEntity('Trip', { name: 'Kilimanjaro Trek', destination: 'Zanzibar', client_name: 'Zanzibar Import Co', reference: 'TRP-001', status: 'confirmed' });
    insertUser({ name: 'Zanzibar Agent', email: 'search-test-zanzibar@example.com' });
  });

  it('returns [] for empty query', () => {
    expect(searchAll('', 'user1')).toEqual([]);
  });

  it('returns [] for single-character query', () => {
    expect(searchAll('z', 'user1')).toEqual([]);
  });

  it('finds matching clients and trips by prefix', () => {
    const results = searchAll('Zanzibar', 'user1');
    const types = results.map(r => r.type);
    expect(types).toContain('Client');
    expect(types).toContain('Trip');

    const client = results.find(r => r.id === clientId);
    expect(client.label).toBe('Zanzibar Import Co');
    expect(client.url).toBe(`/ClientDetails?id=${clientId}`);
  });

  it('finds matching active users', () => {
    const results = searchAll('Zanzibar', 'user1');
    const user = results.find(r => r.type === 'User');
    expect(user).toBeTruthy();
    expect(user.label).toBe('Zanzibar Agent');
  });

  it('does not match unrelated queries', () => {
    const results = searchAll('nonexistent-xyz-query', 'user1');
    expect(results).toEqual([]);
  });

  it('skips rows with unparseable JSON without throwing', () => {
    const badId = uid();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)')
      .run(badId, 'Client', '{not valid json Zanzibar', now, now);

    expect(() => searchAll('Zanzibar', 'user1')).not.toThrow();
    const results = searchAll('Zanzibar', 'user1');
    expect(results.find(r => r.id === badId)).toBeUndefined();
  });
});
