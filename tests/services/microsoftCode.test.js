import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// exchangeMicrosoftCode's own logic, with Azure's token endpoint stubbed.
// The `Origin` header is the whole reason this function exists — see the
// comment on it — so it is asserted rather than assumed: without it Azure
// rejects the redemption (AADSTS9002327) and mobile sign-in breaks in a way
// that looks like a bad code.
process.env.MICROSOFT_CLIENT_ID = 'test-ms-client-id';
process.env.MICROSOFT_TENANT_ID = '11111111-2222-3333-4444-555555555555';

const { exchangeMicrosoftCode } = await import('../../server/services/microsoft.js');

const args = (over = {}) => ({
  code: 'auth-code',
  codeVerifier: 'verifier',
  redirectUri: 'https://marvelops-production.up.railway.app/auth/microsoft/callback',
  ...over,
});

describe('exchangeMicrosoftCode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redeems the code and returns the id token', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id_token: 'the-id-token' }) });

    await expect(exchangeMicrosoftCode(args())).resolves.toBe('the-id-token');
  });

  it('sends the redirect URI origin as Origin, which SPA-type clients require', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id_token: 't' }) });

    await exchangeMicrosoftCode(args());

    const [url, init] = fetch.mock.calls.at(-1);
    expect(url).toBe('https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555/oauth2/v2.0/token');
    expect(init.headers.Origin).toBe('https://marvelops-production.up.railway.app');
  });

  it('posts PKCE parameters and no client secret', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id_token: 't' }) });

    await exchangeMicrosoftCode(args());

    const body = fetch.mock.calls.at(-1)[1].body;
    expect(body.get('code_verifier')).toBe('verifier');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_id')).toBe('test-ms-client-id');
    // A public client has none, and shipping one to a mobile app would be worse
    // than useless — assert it never creeps in.
    expect(body.get('client_secret')).toBeNull();
  });

  it('does not leak Azure error detail to the caller', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'AADSTS9002327: redirect_uri https://internal.example/secret',
      }),
    });

    await expect(exchangeMicrosoftCode(args())).rejects.toThrow('Microsoft sign-in could not be completed.');
  });

  it('rejects a malformed redirect URI before calling Azure', async () => {
    await expect(exchangeMicrosoftCode(args({ redirectUri: 'not-a-url' }))).rejects.toThrow('Invalid redirect URI.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces a transport failure as a sign-in failure, not a crash', async () => {
    fetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(exchangeMicrosoftCode(args())).rejects.toThrow('Could not reach Microsoft to complete sign-in.');
  });
});
