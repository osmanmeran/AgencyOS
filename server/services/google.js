import { createRemoteJWKSet, jwtVerify } from 'jose';
import logger from '../lib/logger.js';
import { UnauthorizedError } from '../middleware/errors.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Google publishes a stable JWKS, so unlike Microsoft (whose keys live under a
// per-tenant path) this can be built once at module load.
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export { GOOGLE_CLIENT_ID };

/** @returns {boolean} True when both halves of the Google OAuth config are present. */
export function isGoogleSsoConfigured() {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/**
 * Exchange an authorization code for Google's id token.
 *
 * Runs server-side because Google requires the client secret at its token
 * endpoint for web clients, and that secret must never reach the browser. PKCE
 * (`codeVerifier`) still protects the code in transit, so an intercepted code
 * is useless without the verifier the browser generated.
 * @returns {Promise<string>} The raw id token.
 */
export async function exchangeGoogleCode({ code, codeVerifier, redirectUri }) {
  if (!isGoogleSsoConfigured()) {
    throw new UnauthorizedError('Google SSO is not configured.');
  }

  let res;
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Google token exchange request failed');
    throw new UnauthorizedError('Could not reach Google to complete sign-in.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id_token) {
    // Google's error_description can quote the redirect_uri back; keep it out
    // of the client response and log it for the operator instead.
    logger.error({ status: res.status, error: data.error }, 'Google token exchange rejected');
    throw new UnauthorizedError('Google sign-in could not be completed.');
  }
  return data.id_token;
}

/**
 * Verify a Google id token's signature, audience, issuer, and expiry.
 *
 * `email_verified` is enforced here and is not optional: accounts are matched
 * to app users by email address, so an unverified email would let anyone who
 * claims an address sign in as that user. Microsoft's flow is spared this
 * because its `tid` check already proves the account belongs to the workspace's
 * directory; Google has no equivalent.
 * @returns {{googleId: string, email: string, name: string}}
 */
export async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) {
    throw new UnauthorizedError('Google SSO is not configured.');
  }

  let payload;
  try {
    const result = await jwtVerify(idToken, JWKS, {
      audience: GOOGLE_CLIENT_ID,
      issuer: GOOGLE_ISSUERS,
    });
    payload = result.payload;
  } catch (err) {
    logger.error({ err: err.message }, 'Google token verification failed');
    throw new UnauthorizedError('Google token is invalid or expired.');
  }

  // Google sends this as a real boolean, but has historically sent the string
  // "true" on some endpoints — accept both, reject everything else.
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (!emailVerified) {
    logger.warn({ sub: payload.sub }, 'Google sign-in rejected: email not verified');
    throw new UnauthorizedError('Your Google account email is not verified.');
  }

  const googleId = payload.sub;
  const rawEmail = payload.email;
  if (!googleId || !rawEmail) {
    throw new UnauthorizedError('Could not retrieve the email from the Google account.');
  }

  const email = String(rawEmail).trim().toLowerCase();
  return { googleId, email, name: payload.name || email.split('@')[0] };
}
