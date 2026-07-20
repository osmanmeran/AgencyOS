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
