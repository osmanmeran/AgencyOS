import { getTenantBySlug, isValidSlug } from '../services/tenants.js';
import { DEFAULT_TENANT_ID, runWithTenant } from '../db.js';

// Name of the cookie that selects the active workspace on the bare/apex domain
// when wildcard subdomain DNS isn't available (single-domain / cookie mode). Set
// at signup and login; read by tenantMiddleware as a fallback after the Host
// subdomain. httpOnly — the frontend gets workspace info from
// GET /api/tenants/me, never from this cookie.
export const ACTIVE_TENANT_COOKIE = 'active_tenant';

// Hosts that are always the apex/control plane, never a tenant workspace.
const RESERVED_HOSTS = new Set(['www', 'api', 'app', 'admin', 'platform', 'auth', 'mail', 'ftp', 'status', 'cdn']);

// Resolves the workspace slug from the Host header. When APP_ROOT_DOMAIN is
// set, a request to `<slug>.<APP_ROOT_DOMAIN>` resolves to the tenant with that
// slug. Leave it unset in dev / single-tenant mode (localhost, bare IP) so every
// request falls through to the default (legacy) tenant and the app keeps working
// unchanged. Required for the SaaS subdomain routing to activate. Read per-call
// (not at module load) so config changes and tests don't require a reload.
function slugFromHost(host) {
  const ROOT_DOMAIN = process.env.APP_ROOT_DOMAIN
    ? process.env.APP_ROOT_DOMAIN.toLowerCase().replace(/^\.+/, '')
    : null;
  if (!host || !ROOT_DOMAIN) return null;
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) return null;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    if (slug && !RESERVED_HOSTS.has(slug)) return slug;
  }
  return null;
}

/**
 * Absolute base URL for the requesting workspace, used to build links that
 * leave the request — invite emails, client-facing notification links.
 *
 * In subdomain mode (APP_ROOT_DOMAIN set) with a resolved tenant, this is the
 * tenant's own `<slug>.<APP_ROOT_DOMAIN>` — landing the recipient directly on
 * their workspace. Without this, a global `APP_URL` set for an unrelated
 * reason (a single canonical URL for cron/report links, say) silently sends
 * every invite to the apex instead. The apex still resolves correctly via the
 * active_tenant cookie fallback below (and via the token search in
 * `locateInvite`, which never depends on which domain accepted it) — but
 * landing straight on the subdomain is strictly better and doesn't depend on
 * that fallback surviving a browser's cookie settings.
 *
 * Falls back to `APP_URL`, then the request's own origin, when there is no
 * per-tenant subdomain to build: the legacy/default tenant, or single-domain
 * (cookie) mode, where every workspace is reached through the bare domain by
 * design.
 */
export function workspaceUrl(req) {
  const rootDomain = process.env.APP_ROOT_DOMAIN;
  if (rootDomain && req.tenant?.slug) {
    return `https://${req.tenant.slug}.${rootDomain.replace(/^\.+/, '')}`;
  }
  // Every caller appends its own leading-slash path (`${workspaceUrl(req)}/foo`),
  // so a trailing slash on APP_URL (very easy to set — it's how a browser
  // address bar shows a bare root URL) would double up into `...com//foo`.
  // That breaks route matching entirely: neither React Router nor the
  // login-redirect exemptions for standalone pages (App.jsx, api-client.js)
  // recognize a path starting with `//` as the route they're meant to allow.
  const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return base.replace(/\/+$/, '');
}

/**
 * Resolve the tenant for a request from its Host header, before auth runs
 * (see SAAS_PROJECT.md, Phase 2). Sets `req.tenantId` / `req.tenant` and runs
 * the rest of the request inside that tenant's DB context. Unknown subdomains
 * get a 404 so a request can never silently land on the wrong tenant's data.
 */
export function tenantMiddleware(req, res, next) {
  const slug = slugFromHost(req.headers.host);

  // A subdomain match is authoritative and strict: an unknown subdomain gets a
  // 404 so a request can never silently land on the wrong tenant's data.
  if (slug) {
    const tenant = getTenantBySlug(slug);
    if (!tenant) {
      return res.status(404).json({ error: { code: 'TENANT_NOT_FOUND', message: `Unknown workspace: ${slug}` } });
    }
    req.tenant = tenant;
    req.tenantId = tenant.id;
    return runWithTenant(tenant.id, () => next());
  }

  // Single-domain fallback: an explicit workspace selection stored in a cookie
  // (set at signup / login) lets the bare/apex domain host any workspace
  // without requiring wildcard DNS. An unknown/invalid cookie value simply
  // falls back to the default (legacy) tenant rather than 404-ing the app.
  const cookieSlug = req.cookies && req.cookies[ACTIVE_TENANT_COOKIE];
  if (cookieSlug && isValidSlug(cookieSlug)) {
    const tenant = getTenantBySlug(cookieSlug);
    if (tenant) {
      req.tenant = tenant;
      req.tenantId = tenant.id;
      return runWithTenant(tenant.id, () => next());
    }
  }

  req.tenant = null;
  req.tenantId = null;
  return runWithTenant(DEFAULT_TENANT_ID, () => next());
}
