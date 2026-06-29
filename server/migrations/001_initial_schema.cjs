function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      user_tier TEXT NOT NULL DEFAULT 'agent',
      role TEXT NOT NULL DEFAULT 'agent',
      language TEXT DEFAULT 'en',
      custom_permissions TEXT DEFAULT '[]',
      client_id TEXT,
      linked_supplier_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_date TEXT,
      updated_date TEXT
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_date TEXT,
      updated_date TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      to_email TEXT,
      subject TEXT,
      body TEXT,
      status TEXT DEFAULT 'sent',
      sent_date TEXT
    );

    CREATE TABLE IF NOT EXISTS app_logs (
      id TEXT PRIMARY KEY,
      page_name TEXT,
      user_id TEXT,
      created_date TEXT
    );
  `);
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS app_logs;
    DROP TABLE IF EXISTS email_logs;
    DROP INDEX IF EXISTS idx_entities_type;
    DROP TABLE IF EXISTS entities;
    DROP TABLE IF EXISTS users;
  `);
}

module.exports = { up, down };
