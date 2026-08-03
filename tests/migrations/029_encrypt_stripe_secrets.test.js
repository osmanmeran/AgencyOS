import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import * as migration from '../../server/migrations/029_encrypt_stripe_secrets.js';
import { encrypt, decrypt, isEncrypted } from '../../server/lib/encryption.js';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE stripe_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    secret_key TEXT,
    webhook_secret TEXT,
    verified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  return db;
}

describe('029 encrypt stripe secrets', () => {
  it('is a no-op when no row exists yet', () => {
    const db = makeDb();
    expect(() => migration.up(db)).not.toThrow();
  });

  it('encrypts a plaintext secret_key and webhook_secret left over from before encryption', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO stripe_settings (id, secret_key, webhook_secret, created_at, updated_at)
       VALUES (1, 'sk_test_plaintext', 'whsec_plaintext', 'now', 'now')`,
    ).run();

    migration.up(db);

    const row = db.prepare('SELECT * FROM stripe_settings WHERE id = 1').get();
    expect(isEncrypted(row.secret_key)).toBe(true);
    expect(isEncrypted(row.webhook_secret)).toBe(true);
    expect(decrypt(row.secret_key)).toBe('sk_test_plaintext');
    expect(decrypt(row.webhook_secret)).toBe('whsec_plaintext');
  });

  it('leaves an already-encrypted row untouched (idempotent)', () => {
    const db = makeDb();
    const encryptedSecret = encrypt('sk_test_already');
    db.prepare(
      `INSERT INTO stripe_settings (id, secret_key, webhook_secret, created_at, updated_at)
       VALUES (1, ?, NULL, 'now', 'now')`,
    ).run(encryptedSecret);

    migration.up(db);

    const row = db.prepare('SELECT * FROM stripe_settings WHERE id = 1').get();
    expect(row.secret_key).toBe(encryptedSecret);
    expect(row.webhook_secret).toBeNull();
  });

  it('is safe to run twice in a row', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO stripe_settings (id, secret_key, webhook_secret, created_at, updated_at)
       VALUES (1, 'sk_test_plaintext', NULL, 'now', 'now')`,
    ).run();

    migration.up(db);
    const first = db.prepare('SELECT secret_key FROM stripe_settings WHERE id = 1').get().secret_key;
    migration.up(db);
    const second = db.prepare('SELECT secret_key FROM stripe_settings WHERE id = 1').get().secret_key;

    expect(second).toBe(first);
    expect(decrypt(second)).toBe('sk_test_plaintext');
  });

  it('handles a null webhook_secret alongside a plaintext secret_key', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO stripe_settings (id, secret_key, webhook_secret, created_at, updated_at)
       VALUES (1, 'sk_test_plaintext', NULL, 'now', 'now')`,
    ).run();

    expect(() => migration.up(db)).not.toThrow();
    const row = db.prepare('SELECT * FROM stripe_settings WHERE id = 1').get();
    expect(row.webhook_secret).toBeNull();
    expect(decrypt(row.secret_key)).toBe('sk_test_plaintext');
  });
});
