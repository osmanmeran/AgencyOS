function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '';
  `);
}

function down(db) {
  db.exec(`
    ALTER TABLE users DROP COLUMN phone;
  `);
}

module.exports = { up, down };
