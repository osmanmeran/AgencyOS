import { tenantAccessState } from '../services/tenants.js';
import { sendError } from './errors.js';

// API paths that stay reachable for a suspended or expired workspace. Without
// these the app couldn't even load far enough to explain why it's blocked, and
// there'd be no way back in:
//   - /health          liveness probes must never depend on tenant state
//   - /auth/*          sign in / out and read the current session
//   - /tenants/*       read the workspace (status + trial end), sign up a new one
//   - /platform/*      the operator's own console — how a workspace gets reactivated
//   - /public/*        share links (e.g. a passenger's itinerary) resolve their own
//                       tenant from the token (see services/itineraryShare.js) and
//                       shouldn't go dark just because the agency's billing lapsed
const ALLOWED_PREFIXES = ['/health', '/auth', '/tenants', '/platform', '/public'];

function isAllowlisted(pathname) {
  return ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Refuse API traffic for a workspace that is suspended or whose trial has
 * lapsed. Mounted under `/api` after tenantMiddleware has resolved `req.tenant`
 * (see server/app.js). Requests with no resolved tenant — the legacy/default
 * workspace, or the apex domain — are always allowed through.
 *
 * Read-only file access (`/uploads`) is deliberately not gated here: it is not
 * under /api, and the blocked-workspace screen may still need the workspace logo.
 */
export function tenantStatusMiddleware(req, res, next) {
  if (isAllowlisted(req.path)) return next();

  const state = tenantAccessState(req.tenant);
  if (state.allowed) return next();

  return sendError(res, 403, state.code, state.message);
}
