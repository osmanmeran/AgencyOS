import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDb } from '../../server/db.js';
import { createUser, updateUser, locateUserByGoogle } from '../../server/services/auth.js';

// The security-relevant properties of Google sign-in, which differs from the
// Microsoft flow in two deliberate ways: it never provisions an account, and it
// enforces `email_verified` because accounts are matched by email address.
vi.mock('../../server/services/google.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, exchangeGoogleCode: vi.fn(), verifyGoogleIdToken: vi.fn() };
});

const { exchangeGoogleCode, verifyGoogleIdToken } = await import('../../server/services/google.js');
const { authenticateGoogle } = await import('../../server/services/auth.js');

const CREDS = { code: 'auth-code', codeVerifier: 'verifier', redirectUri: 'https://app.test/auth/google/callback' };

describe('Google SSO', () => {
  beforeAll(() => {
    getDb();
    exchangeGoogleCode.mockResolvedValue('fake-id-token');
  });

  it('signs in an existing user and links the google_id on first use', async () => {
    const email = `google-existing-${Date.now()}@example.com`;
    const created = createUser({ email, password: 'InitialPw123', name: 'Existing', user_tier: 'agent' });
    expect(created.google_id).toBeFalsy();

    verifyGoogleIdToken.mockResolvedValue({ googleId: 'google-sub-1', email, name: 'Existing' });
    const result = await authenticateGoogle(CREDS);

    expect(result.user.email).toBe(email);
    const after = getDb().prepare('SELECT google_id, password FROM users WHERE id = ?').get(created.id);
    expect(after.google_id).toBe('google-sub-1');
    // Linking Google adds a sign-in method; it must not clear the password.
    expect(after.password).toBeTruthy();
  });

  it('rejects a Google account with no matching user instead of provisioning one', async () => {
    const email = `google-stranger-${Date.now()}@example.com`;
    verifyGoogleIdToken.mockResolvedValue({ googleId: 'google-sub-stranger', email, name: 'Stranger' });

    await expect(authenticateGoogle(CREDS)).rejects.toThrow(/No account here/i);
    const row = getDb().prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
    expect(row).toBeUndefined();
  });

  it('rejects an inactive account', async () => {
    const email = `google-inactive-${Date.now()}@example.com`;
    const created = createUser({ email, password: 'InitialPw123', name: 'Inactive', user_tier: 'agent' });
    updateUser(created.id, { is_active: false });

    verifyGoogleIdToken.mockResolvedValue({ googleId: 'google-sub-inactive', email, name: 'Inactive' });
    await expect(authenticateGoogle(CREDS)).rejects.toThrow(/pending approval/i);
  });

  it('refuses to hand an account to a different Google identity', async () => {
    const email = `google-bound-${Date.now()}@example.com`;
    const created = createUser({ email, password: 'InitialPw123', name: 'Bound', user_tier: 'agent' });
    getDb().prepare('UPDATE users SET google_id = ? WHERE id = ?').run('google-sub-owner', created.id);

    verifyGoogleIdToken.mockResolvedValue({ googleId: 'google-sub-attacker', email, name: 'Attacker' });
    await expect(authenticateGoogle(CREDS)).rejects.toThrow(/different Google identity/i);
  });

  it('lets one account carry both a Microsoft and a Google identity', async () => {
    const email = `google-both-${Date.now()}@example.com`;
    const created = createUser({ email, password: 'InitialPw123', name: 'Both', user_tier: 'agent' });
    getDb().prepare('UPDATE users SET microsoft_id = ? WHERE id = ?').run('ms-oid-both', created.id);

    verifyGoogleIdToken.mockResolvedValue({ googleId: 'google-sub-both', email, name: 'Both' });
    await authenticateGoogle(CREDS);

    const after = getDb().prepare('SELECT microsoft_id, google_id FROM users WHERE id = ?').get(created.id);
    expect(after.microsoft_id).toBe('ms-oid-both');
    expect(after.google_id).toBe('google-sub-both');
  });

  it('locateUserByGoogle finds by google_id and falls back to email', async () => {
    const email = `google-locate-${Date.now()}@example.com`;
    const created = createUser({ email, password: 'InitialPw123', name: 'Locate', user_tier: 'agent' });

    expect(locateUserByGoogle('no-such-sub', email)?.user.id).toBe(created.id);
    getDb().prepare('UPDATE users SET google_id = ? WHERE id = ?').run('google-sub-locate', created.id);
    expect(locateUserByGoogle('google-sub-locate', 'unrelated@example.com')?.user.id).toBe(created.id);
    expect(locateUserByGoogle('nope', 'nobody@example.com')).toBeNull();
  });
});
