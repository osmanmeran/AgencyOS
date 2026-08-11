import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import logger from '../lib/logger.js';
import { UnauthorizedError } from '../middleware/errors.js';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';

export { MICROSOFT_CLIENT_ID };

/**
 * Verify a Microsoft Entra ID id token whose tenant is not yet known — used by
 * self-serve SSO signup, where the new workspace's Azure tenant is derived from
 * the token itself (rather than a pre-configured `azure_tenant_id`).
 *
 * The `tid` is read from the (still-unverified) payload only to locate the
 * correct JWKS endpoint; the token is then cryptographically verified for
 * signature, audience, issuer, and expiry. Whatever the verification returns is
 * therefore trustworthy.
 * @returns {{microsoftId: string, email: string, name: string, tid: string}}
 */
export async function verifyMicrosoftIdToken(idToken) {
  if (!MICROSOFT_CLIENT_ID) {
    throw new UnauthorizedError('Microsoft SSO is not configured for this workspace.');
  }

  const unverified = jwt.decode(idToken);
  const tid = unverified?.tid;
  if (!tid) {
    throw new UnauthorizedError('Microsoft token is missing the tenant id.');
  }

  const JWKS = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tid}/discovery/v2.0/keys`));

  let payload;
  try {
    const result = await jwtVerify(idToken, JWKS, {
      audience: MICROSOFT_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${tid}/v2.0`,
    });
    payload = result.payload;
  } catch (err) {
    logger.error({ err: err.message }, 'Microsoft token verification failed');
    throw new UnauthorizedError('Microsoft token is invalid or expired.');
  }

  const microsoftId = payload.oid || payload.sub;
  const rawEmail = payload.preferred_username || payload.email || payload.unique_name;
  if (!rawEmail) {
    throw new UnauthorizedError('Could not retrieve the email from the Microsoft account.');
  }

  const email = String(rawEmail).trim().toLowerCase();
  const name = payload.name || email.split('@')[0];
  return { microsoftId, email, name, tid };
}

const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || '';

/**
 * Exchange an authorization code for a Microsoft id token.
 *
 * The web client does this leg itself, in the browser. The mobile app cannot:
 * the app registration's redirect URI is of platform type "Single-page
 * application", and Azure will only redeem a code issued to a SPA client for a
 * request that carries an `Origin` header (AADSTS9002327) — which a native HTTP
 * client does not send. Doing it here keeps the app working against the
 * existing registration, with no new Azure platform to register (see the ops
 * notes in CLAUDE.md: we do not have tenant-admin rights to add one).
 *
 * No client secret is involved. The registration is a public client, so PKCE
 * (`codeVerifier`) is what makes an intercepted code unusable.
 *
 * The authority must match the one the caller used at the authorize step. Both
 * sides read it from their own tenant setting, so those must name the same
 * tenant — a GUID here and the verified domain there is fine, Azure accepts
 * either form, but two different tenants is not.
 * @returns {Promise<string>} The raw id token.
 */
export async function exchangeMicrosoftCode({ code, codeVerifier, redirectUri }) {
  if (!MICROSOFT_CLIENT_ID) {
    throw new UnauthorizedError('Microsoft SSO is not configured.');
  }

  const authority = MICROSOFT_TENANT_ID || 'common';
  let origin;
  try {
    origin = new URL(redirectUri).origin;
  } catch {
    throw new UnauthorizedError('Invalid redirect URI.');
  }

  let res;
  try {
    res = await fetch(`https://login.microsoftonline.com/${authority}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Required for a SPA-type redirect URI; see the note above. The value
        // is the origin of the redirect the code was issued for, which is what
        // a browser completing the same flow would have sent.
        Origin: origin,
      },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Microsoft token exchange request failed');
    throw new UnauthorizedError('Could not reach Microsoft to complete sign-in.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id_token) {
    // AADSTS codes name the exact misconfiguration and can echo the redirect
    // URI back; log them for the operator, keep them out of the response.
    logger.error(
      { status: res.status, error: data.error, description: data.error_description },
      'Microsoft token exchange rejected',
    );
    throw new UnauthorizedError('Microsoft sign-in could not be completed.');
  }

  return data.id_token;
}
