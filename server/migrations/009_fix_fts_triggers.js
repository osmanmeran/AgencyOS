// Migration 003 defined entities_fts_delete/entities_fts_update using the
// FTS5 "special command" syntax (INSERT INTO entities_fts(entities_fts, id, ...)
// VALUES ('delete'|'delete-all', ...)). That syntax is only valid for
// external-content or contentless FTS5 tables; entities_fts stores its own
// data, so every invocation throws "SQL logic error" — meaning every
// UPDATE/DELETE against the entities table has been failing since the
// initial commit. Replace both triggers with plain DELETE/INSERT statements,
// matching the (correct) upsertFts/deleteFts helpers in services/entities.js.
export function up(db) {
  db.exec(`
    DROP TRIGGER IF EXISTS entities_fts_delete;
    DROP TRIGGER IF EXISTS entities_fts_update;

    CREATE TRIGGER entities_fts_delete AFTER DELETE ON entities BEGIN
      DELETE FROM entities_fts WHERE id = old.id;
    END;

    CREATE TRIGGER entities_fts_update AFTER UPDATE ON entities BEGIN
      DELETE FROM entities_fts WHERE id = old.id;
      INSERT INTO entities_fts(id, type, label, content)
      VALUES (new.id, new.type, new.type, new.data);
    END;
  `);
}

export function down(db) {
  db.exec(`
    DROP TRIGGER IF EXISTS entities_fts_delete;
    DROP TRIGGER IF EXISTS entities_fts_update;

    CREATE TRIGGER entities_fts_delete AFTER DELETE ON entities BEGIN
      INSERT INTO entities_fts(entities_fts, id, type, label, content)
      VALUES ('delete', old.id, old.type, old.type, old.data);
    END;

    CREATE TRIGGER entities_fts_update AFTER UPDATE ON entities BEGIN
      INSERT INTO entities_fts(entities_fts, id, type, label, content)
      VALUES ('delete', old.id, old.type, old.type, old.data);
      INSERT INTO entities_fts(id, type, label, content)
      VALUES (new.id, new.type, new.type, new.data);
    END;
  `);
}
