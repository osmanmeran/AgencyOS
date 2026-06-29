function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT,
      data TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_date TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      entity_type TEXT,
      entity_id TEXT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_by TEXT,
      created_date TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      changes TEXT,
      ip TEXT,
      created_date TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_date);
  `);
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS audit_logs;
  `);
}

module.exports = { up, down };
