// Refresh-token storage for rotating refresh tokens (see server/services/auth.js).
//
// The auth model moved from a single 24h JWT to short-lived access tokens
// (cookie `token`, ~15m) plus a long-lived rotating refresh token (cookie
// `refresh_token`, ~30d). Each refresh issues a brand-new refresh token and
// revokes the previous one, so a leaked refresh token can't be replayed. We
// only ever store a SHA-256 hash of the raw token (the raw value is shown to
// the client exactly once, at issuance), so a DB compromise doesn't yield
// usable tokens. `user_id` is indexed for fast revocation of every token a
// user holds (logout-everywhere / deactivation).
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      user_agent TEXT,
      ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
  `);
}

export function down(db) {
  db.exec(`DROP TABLE IF EXISTS refresh_tokens;`);
}
