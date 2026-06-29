function up(db) {
  // Create FTS5 virtual table for full-text search on entities
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
      id UNINDEXED,
      type UNINDEXED,
      label,
      content,
      tokenize='porter unicode61'
    );
  `);

  // Create triggers to keep FTS index in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities BEGIN
      INSERT INTO entities_fts(id, type, label, content)
      VALUES (new.id, new.type, new.type, new.data);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS entities_fts_delete AFTER DELETE ON entities BEGIN
      INSERT INTO entities_fts(entities_fts, id, type, label, content)
      VALUES ('delete', old.id, old.type, old.type, old.data);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS entities_fts_update AFTER UPDATE ON entities BEGIN
      INSERT INTO entities_fts(entities_fts, id, type, label, content)
      VALUES ('delete', old.id, old.type, old.type, old.data);
      INSERT INTO entities_fts(id, type, label, content)
      VALUES (new.id, new.type, new.type, new.data);
    END;
  `);

  // Populate FTS with existing data
  const count = db.prepare('SELECT COUNT(*) as c FROM entities').get().c;
  if (count > 0) {
    const rows = db.prepare('SELECT id, type, data FROM entities').all();
    const insert = db.prepare('INSERT INTO entities_fts(id, type, label, content) VALUES (?, ?, ?, ?)');
    const batch = db.transaction((items) => {
      for (const row of items) {
        insert.run(row.id, row.type, row.type, row.data);
      }
    });
    batch(rows);
  }
}

function down(db) {
  db.exec(`
    DROP TRIGGER IF EXISTS entities_fts_insert;
    DROP TRIGGER IF EXISTS entities_fts_delete;
    DROP TRIGGER IF EXISTS entities_fts_update;
    DROP TABLE IF EXISTS entities_fts;
  `);
}

module.exports = { up, down };
