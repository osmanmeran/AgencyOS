export function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '';
  `);
}

export function down(db) {
  db.exec(`
    ALTER TABLE users DROP COLUMN phone;
  `);
}
