import { describe, it, expect, vi } from 'vitest';

// verifyGoogleIdToken's own logic, with the signature check stubbed out.
// `email_verified` is the piece that matters most: users are matched to Google
// identities by email address, so accepting an unverified email would let
// anyone who registers a Google account asserting someone's address sign in as
// them. Microsoft's flow is protected instead by its `tid` check.
//
// No mockReset between tests, deliberately: every test sets its own
// jwtVerify behaviour, and resetting alongside the rejected-promise case below
// made Vitest report that rejection as an unhandled error. The cost is that
// `mock.calls` accumulates, so assertions on it must read the last call.
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}));

process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

const { jwtVerify } = await import('jose');
const { verifyGoogleIdToken } = await import('../../server/services/google.js');

const payload = (over = {}) => ({
  sub: 'google-sub-123',
  email: 'User@Example.com',
  email_verified: true,
  name: 'Test User',
  ...over,
});

describe('verifyGoogleIdToken', () => {
  it('accepts a verified token and normalizes the email', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: payload() });
    await expect(verifyGoogleIdToken('tok')).resolves.toEqual({
      googleId: 'google-sub-123',
      email: 'user@example.com',
      name: 'Test User',
    });
  });

  it('rejects an unverified email', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: payload({ email_verified: false }) });
    await expect(verifyGoogleIdToken('tok')).rejects.toThrow(/not verified/i);
  });

  it('rejects a missing email_verified claim rather than assuming true', async () => {
    const p = payload();
    delete p.email_verified;
    vi.mocked(jwtVerify).mockResolvedValue({ payload: p });
    await expect(verifyGoogleIdToken('tok')).rejects.toThrow(/not verified/i);
  });

  it('accepts the string "true", which Google has historically sent', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: payload({ email_verified: 'true' }) });
    await expect(verifyGoogleIdToken('tok')).resolves.toMatchObject({ email: 'user@example.com' });
  });

  it('rejects other truthy values for email_verified', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: payload({ email_verified: 'yes' }) });
    await expect(verifyGoogleIdToken('tok')).rejects.toThrow(/not verified/i);
  });

  it('rejects a token whose signature or audience fails', async () => {
    // The rejection is pre-created and marked handled: a mock that throws (or
    // mockRejectedValue, which builds the promise eagerly) leaves a rejection
    // Vitest reports as an unhandled error, failing the test despite the
    // assertion passing. Awaiting this still rejects in the code under test.
    const rejected = Promise.reject(new Error('signature verification failed'));
    rejected.catch(() => {});
    vi.mocked(jwtVerify).mockReturnValue(rejected);

    let caught;
    try {
      await verifyGoogleIdToken('tok');
    } catch (err) {
      caught = err;
    }
    // The underlying reason must not leak to the caller.
    expect(caught?.message).toMatch(/invalid or expired/i);
    expect(caught?.message).not.toMatch(/signature/i);
  });

  it('rejects a verified token carrying no email', async () => {
    const p = payload();
    delete p.email;
    vi.mocked(jwtVerify).mockResolvedValue({ payload: p });
    await expect(verifyGoogleIdToken('tok')).rejects.toThrow(/Could not retrieve the email/i);
  });

  it('pins audience and issuer when verifying', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: payload() });
    await verifyGoogleIdToken('tok');
    // Last call, not calls[0]: there is no mockReset between tests (see the
    // note by the mock), so calls accumulate across the file.
    const opts = vi.mocked(jwtVerify).mock.calls.at(-1)[2];
    expect(opts.audience).toBe('test-google-client-id');
    expect(opts.issuer).toContain('https://accounts.google.com');
  });
});
