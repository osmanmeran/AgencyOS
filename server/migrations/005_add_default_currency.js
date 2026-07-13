export function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN default_currency TEXT DEFAULT 'USD';
  `);
}

export function down(db) {
  db.exec(`
    ALTER TABLE users DROP COLUMN default_currency;
  `);
}
