import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../../server/db.js';
import { createTenant } from '../../server/services/tenants.js';
import { pruneRefreshTokens, pruneRefreshTokensAllTenants } from '../../server/services/refreshTokenPruning.js';

function seedToken(db, { id, revoked = 0, expiresAt }) {
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (id, token_hash, user_id, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `hash-${id}`, 'user-1', expiresAt, revoked, now);
}

describe('refresh token pruning', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM refresh_tokens');
  });

  it('deletes revoked and expired rows, keeps valid ones', () => {
    const db = getDb();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    seedToken(db, { id: 'revoked-1', revoked: 1, expiresAt: future });
    seedToken(db, { id: 'expired-1', revoked: 0, expiresAt: past });
    seedToken(db, { id: 'valid-1', revoked: 0, expiresAt: future });

    const deleted = pruneRefreshTokens();
    expect(deleted).toBe(2);

    const remaining = db.prepare('SELECT id FROM refresh_tokens').all().map((r) => r.id);
    expect(remaining).toEqual(['valid-1']);
  });

  it('is a no-op when nothing needs pruning', () => {
    const db = getDb();
    seedToken(db, { id: 'valid-2', revoked: 0, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    expect(pruneRefreshTokens()).toBe(0);
  });

  it('prunes across every tenant in one pass', async () => {
    const tenant = createTenant({ slug: `prune-${Date.now()}`, name: 'Prune Test Agency' });
    const tenantDb = getDb(tenant.id);
    tenantDb.exec('DELETE FROM refresh_tokens');
    seedToken(tenantDb, { id: 'other-tenant-revoked', revoked: 1, expiresAt: new Date().toISOString() });
    seedToken(getDb(), { id: 'default-tenant-revoked', revoked: 1, expiresAt: new Date().toISOString() });

    const total = await pruneRefreshTokensAllTenants();
    expect(total).toBeGreaterThanOrEqual(2);
    expect(tenantDb.prepare('SELECT COUNT(*) AS c FROM refresh_tokens').get().c).toBe(0);
  });
});
