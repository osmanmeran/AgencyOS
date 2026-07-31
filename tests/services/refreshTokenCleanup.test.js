import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import {
  pruneRefreshTokens,
  pruneRefreshTokensAllTenants,
  startRefreshTokenCleanupScheduler,
  stopRefreshTokenCleanupScheduler,
} from '../../server/services/refreshTokenCleanup.js';

const db = getDb();

function insertToken({ revoked = 0, expiresInMs = DAY_MS }) {
  const id = uid();
  db.prepare(
    'INSERT INTO refresh_tokens (id, token_hash, user_id, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, uid(), 'user-1', new Date(Date.now() + expiresInMs).toISOString(), revoked, new Date().toISOString());
  return id;
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('refreshTokenCleanup', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM refresh_tokens').run();
  });

  it('deletes revoked tokens', () => {
    const revoked = insertToken({ revoked: 1, expiresInMs: DAY_MS });
    const active = insertToken({ revoked: 0, expiresInMs: DAY_MS });

    const deleted = pruneRefreshTokens(db);

    expect(deleted).toBe(1);
    expect(db.prepare('SELECT id FROM refresh_tokens WHERE id = ?').get(revoked)).toBeUndefined();
    expect(db.prepare('SELECT id FROM refresh_tokens WHERE id = ?').get(active)).toBeDefined();
  });

  it('deletes expired tokens even if not revoked', () => {
    const expired = insertToken({ revoked: 0, expiresInMs: -DAY_MS });
    const active = insertToken({ revoked: 0, expiresInMs: DAY_MS });

    const deleted = pruneRefreshTokens(db);

    expect(deleted).toBe(1);
    expect(db.prepare('SELECT id FROM refresh_tokens WHERE id = ?').get(expired)).toBeUndefined();
    expect(db.prepare('SELECT id FROM refresh_tokens WHERE id = ?').get(active)).toBeDefined();
  });

  it('leaves active, unexpired tokens alone', () => {
    const active = insertToken({ revoked: 0, expiresInMs: DAY_MS });

    expect(pruneRefreshTokens(db)).toBe(0);
    expect(db.prepare('SELECT id FROM refresh_tokens WHERE id = ?').get(active)).toBeDefined();
  });

  it('prunes across every tenant via pruneRefreshTokensAllTenants', async () => {
    insertToken({ revoked: 1, expiresInMs: DAY_MS });

    const total = await pruneRefreshTokensAllTenants();

    expect(total).toBeGreaterThanOrEqual(1);
  });

  it('startRefreshTokenCleanupScheduler runs an immediate pass and can be stopped', () => {
    insertToken({ revoked: 1, expiresInMs: DAY_MS });

    startRefreshTokenCleanupScheduler();
    stopRefreshTokenCleanupScheduler();
  });
});
