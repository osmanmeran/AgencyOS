'use strict';
exports.up = function(db) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
};
exports.down = function(db) {
  // SQLite doesn't support DROP COLUMN easily, leave it
};
