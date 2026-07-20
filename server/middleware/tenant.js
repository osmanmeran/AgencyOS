import { getTenantBySlug } from '../services/tenants.js';
import { DEFAULT_TENANT_ID, runWithTenant } from '../db.js';

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
 * Resolve the tenant for a request from its Host header, before auth runs
 * (see SAAS_PROJECT.md, Phase 2). Sets `req.tenantId` / `req.tenant` and runs
 * the rest of the request inside that tenant's DB context. Unknown subdomains
 * get a 404 so a request can never silently land on the wrong tenant's data.
 */
export function tenantMiddleware(req, res, next) {
  const slug = slugFromHost(req.headers.host);

  if (!slug) {
    req.tenant = null;
    req.tenantId = null;
    return runWithTenant(DEFAULT_TENANT_ID, () => next());
  }

  const tenant = getTenantBySlug(slug);
  if (!tenant) {
    return res.status(404).json({ error: { code: 'TENANT_NOT_FOUND', message: `Unknown workspace: ${slug}` } });
  }

  req.tenant = tenant;
  req.tenantId = tenant.id;
  return runWithTenant(tenant.id, () => next());
}
