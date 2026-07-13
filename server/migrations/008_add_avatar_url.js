export function up(db) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
}
export function down(db) {
  // SQLite doesn't support DROP COLUMN easily, leave it
}
