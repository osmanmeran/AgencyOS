import crypto from 'crypto';
import { sendError } from './errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Session-establishing endpoints: no csrf_token cookie exists yet at the
// point these run, so there's nothing to double-submit against.
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/microsoft',
  '/api/auth/accept-invite',
  // Session-establishing endpoint for self-serve signup (Phase 3): no CSRF
  // cookie exists yet at the point this runs, so there's nothing to
  // double-submit against.
  '/api/tenants/signup',
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
