import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as migration from '../../server/migrations/012_create_companies_from_contacts.js';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_date TEXT,
    updated_date TEXT
  )`);
  return db;
}

function insertClient(db, id, data) {
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'Client',
    JSON.stringify(data),
    'now',
    'now',
  );
}

function companies(db) {
  return db
    .prepare("SELECT id, data FROM entities WHERE type = 'Company'")
    .all()
    .map((r) => ({ id: r.id, ...JSON.parse(r.data) }));
}
function client(db, id) {
  return JSON.parse(db.prepare('SELECT data FROM entities WHERE id = ?').get(id).data);
}

describe('012 create companies from contacts', () => {
  let db;
  beforeEach(() => {
    db = makeDb();
  });

  it('groups contacts by normalized company name and links them', () => {
    insertClient(db, 'a', { name: 'Jane', company: 'Acme Corp' });
    insertClient(db, 'b', { name: 'John', company: 'acme corp' });
    insertClient(db, 'c', { name: 'Mary', company: 'Globex' });
    insertClient(db, 'd', { name: 'Solo', company: '' });

    migration.up(db);

    const comps = companies(db);
    expect(comps).toHaveLength(2); // Acme + Globex, not the empty one

    const acme = comps.find((c) => c.name.toLowerCase() === 'acme corp');
    expect(client(db, 'a').company_id).toBe(acme.id);
    expect(client(db, 'b').company_id).toBe(acme.id);
    // Denormalized name normalized to canonical casing.
    expect(client(db, 'b').company).toBe(acme.name);
    // Contact with no company is left unlinked.
    expect(client(db, 'd').company_id).toBeUndefined();
  });

  it('seeds company address fields from its contacts', () => {
    insertClient(db, 'a', { name: 'Jane', company: 'Acme', city: 'London', country: 'UK', tax_id: 'VAT1' });
    migration.up(db);
    const acme = companies(db)[0];
    expect(acme.city).toBe('London');
    expect(acme.country).toBe('UK');
    expect(acme.tax_id).toBe('VAT1');
  });

  it('is safe to run twice (reuses companies, no duplicates)', () => {
    insertClient(db, 'a', { name: 'Jane', company: 'Acme' });
    insertClient(db, 'b', { name: 'John', company: 'Acme' });
    migration.up(db);
    migration.up(db);
    expect(companies(db)).toHaveLength(1);
  });

  it('down() unlinks contacts and removes migration-created companies', () => {
    insertClient(db, 'a', { name: 'Jane', company: 'Acme' });
    migration.up(db);
    expect(companies(db)).toHaveLength(1);

    migration.down(db);
    expect(companies(db)).toHaveLength(0);
    expect(client(db, 'a').company_id).toBeUndefined();
  });
});
