import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncrypted } from '../../server/lib/encryption.js';

describe('encryption', () => {
  it('round-trips a value through encrypt/decrypt', () => {
    const ciphertext = encrypt('sk_test_abcdef1234');
    expect(ciphertext).not.toBe('sk_test_abcdef1234');
    expect(decrypt(ciphertext)).toBe('sk_test_abcdef1234');
  });

  it('produces a self-describing prefix and different ciphertext each call', () => {
    const a = encrypt('same-plaintext');
    const b = encrypt('same-plaintext');
    expect(isEncrypted(a)).toBe(true);
    expect(isEncrypted(b)).toBe(true);
    expect(a).not.toBe(b); // random IV per call
    expect(decrypt(a)).toBe('same-plaintext');
    expect(decrypt(b)).toBe('same-plaintext');
  });

  it('passes null/undefined through unchanged', () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeUndefined();
    expect(decrypt(null)).toBeNull();
    expect(decrypt(undefined)).toBeUndefined();
  });

  it('returns a non-prefixed value unchanged (pre-migration plaintext)', () => {
    expect(decrypt('sk_test_plaintext')).toBe('sk_test_plaintext');
    expect(isEncrypted('sk_test_plaintext')).toBe(false);
  });

  it('rejects tampered ciphertext instead of silently returning garbage', () => {
    const ciphertext = encrypt('secret-value');
    const tampered = ciphertext.slice(0, -2) + (ciphertext.endsWith('0') ? '1' : '0');
    expect(() => decrypt(tampered)).toThrow();
  });
});
