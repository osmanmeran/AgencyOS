import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as migration from '../../server/migrations/013_add_entity_query_indexes.js';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_date TEXT,
    updated_date TEXT
  );
  CREATE INDEX idx_entities_type ON entities(type);`);
  const ins = db.prepare('INSERT INTO entities (id,type,data,created_date) VALUES (?,?,?,?)');
  for (let i = 0; i < 2000; i++) {
    ins.run(
      'id' + i,
      ['Invoice', 'Trip', 'ClientPayment', 'QuoteRequest'][i % 4],
      JSON.stringify({
        status: i % 2 ? 'sent' : 'completed',
        proposal_status: i % 2 ? 'confirmed' : 'draft',
        due_date: '2026-0' + ((i % 9) + 1) + '-01',
        client_id: 'c' + (i % 50),
        approval_status: 'approved',
      }),
      '2026-01-01',
    );
  }
  return db;
}

function plan(db, sql) {
  return db
    .prepare('EXPLAIN QUERY PLAN ' + sql)
    .all()
    .map((r) => r.detail)
    .join('\n');
}

describe('013 add entity query indexes', () => {
  let db;
  beforeEach(() => {
    db = makeDb();
  });

  it('is idempotent (safe to run twice)', () => {
    migration.up(db);
    expect(() => migration.up(db)).not.toThrow();
  });

  it('down removes the indexes and is safe without them', () => {
    migration.up(db);
    migration.down(db);
    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_entities_type_%'")
      .all();
    expect(idx).toHaveLength(0);
    expect(() => migration.down(db)).not.toThrow();
  });

  it('lets the planner seek status-equality queries by index', () => {
    const q = "SELECT * FROM entities WHERE type='ClientPayment' AND json_extract(data,'$.status')='completed'";
    expect(plan(db, q)).not.toContain('idx_entities_type_status');
    migration.up(db);
    expect(plan(db, q)).toContain('idx_entities_type_status');
  });

  it('lets the dues query use the due_date index and skip the sort', () => {
    const q =
      "SELECT * FROM entities WHERE type='Invoice' AND json_extract(data,'$.due_date') <= '2026-05-01' ORDER BY json_extract(data,'$.due_date') ASC";
    expect(plan(db, q)).toContain('TEMP B-TREE');
    migration.up(db);
    const after = plan(db, q);
    expect(after).toContain('idx_entities_type_due_date');
    expect(after).not.toContain('TEMP B-TREE');
  });

  it('lets the b2b client-scope query use the client_id index', () => {
    migration.up(db);
    const q = "SELECT * FROM entities WHERE type='QuoteRequest' AND json_extract(data,'$.client_id')='c5'";
    expect(plan(db, q)).toContain('idx_entities_type_client_id');
  });

  it('skips index creation (without throwing) if any row has malformed JSON', () => {
    db.prepare('INSERT INTO entities (id,type,data,created_date) VALUES (?,?,?,?)').run(
      'bad',
      'Client',
      '{not json',
      'now',
    );
    expect(() => migration.up(db)).not.toThrow();
    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_entities_type_%'")
      .all();
    expect(idx).toHaveLength(0);
  });
});
