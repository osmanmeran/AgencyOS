import crypto from 'crypto';
import { sendError } from './errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Session-establishing endpoints: no csrf_token cookie exists yet at the
// point these run, so there's nothing to double-submit against.
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/microsoft',
  // Same reasoning as /microsoft. The request additionally carries a PKCE
  // code_verifier that only the browser which started the flow holds, and the
  // callback has already checked `state`, so a forged cross-site POST cannot
  // produce one that Google will honour.
  '/api/auth/google',
  '/api/auth/accept-invite',
  // Refresh-token rotation is triggered transparently on 401 and can fire
  // before any csrf_token cookie exists (no established session yet). The
  // refresh_token cookie is httpOnly + SameSite=Strict, which already
  // provides CSRF protection.
  '/api/auth/refresh',
  // Session-establishing endpoint for self-serve signup (Phase 3): no CSRF
  // cookie exists yet at the point this runs, so there's nothing to
  // double-submit against.
  '/api/tenants/signup',
  // Password reset: both run before any session/CSRF cookie exists (the
  // requester isn't logged in yet, that's the whole point).
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

/**
 * Double-submit CSRF check for cookie-authenticated requests. The frontend
 * reads the non-httpOnly `csrf_token` cookie (set alongside the JWT in
 * {@link import('../services/auth.js').setTokenCookie}) and echoes it back
 * as the `X-CSRF-Token` header; this middleware verifies the two match.
 *
 * Requests authenticated via an explicit `Authorization: Bearer` header are
 * exempt — that header isn't auto-attached by browsers on cross-site
 * requests the way cookies are, so it isn't subject to CSRF.
 */
export function csrfMiddleware(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PATHS.has(req.path)) return next();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return next();

  const cookieToken = req.cookies && req.cookies.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length === 0 ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return sendError(res, 403, 'CSRF_FAILED', 'Missing or invalid CSRF token');
  }

  next();
}
