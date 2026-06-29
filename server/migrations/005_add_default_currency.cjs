function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN default_currency TEXT DEFAULT 'USD';
  `);
}

function down(db) {
  db.exec(`
    ALTER TABLE users DROP COLUMN default_currency;
  `);
}

module.exports = { up, down };
