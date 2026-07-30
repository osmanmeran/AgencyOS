import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// APP_ROOT_DOMAIN activates subdomain routing; the middleware reads it per-call.
process.env.APP_ROOT_DOMAIN = 'marvelops.app';

import { tenantMiddleware, workspaceUrl } from '../../server/middleware/tenant.js';
import { createTenant } from '../../server/services/tenants.js';
import { runWithTenant, getTenantId, DEFAULT_TENANT_ID } from '../../server/db.js';

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('tenantMiddleware (Phase 2 resolution)', () => {
  let tenant;
  beforeAll(() => {
    tenant = createTenant({ slug: 'acme', name: 'Acme Travel' });
  });

  it('resolves a known subdomain to its tenant and sets the DB context', () => {
    const req = { headers: { host: 'acme.marvelops.app' } };
    const res = makeRes();
    let captured = null;
    tenantMiddleware(req, res, () => {
      captured = getTenantId();
    });
    expect(req.tenantId).toBe(tenant.id);
    expect(req.tenant.slug).toBe('acme');
    expect(captured).toBe(tenant.id);
  });

  it('returns 404 for an unknown subdomain (no silent cross-tenant fallthrough)', () => {
    const req = { headers: { host: 'nope.marvelops.app' } };
    const res = makeRes();
    let called = false;
    tenantMiddleware(req, res, () => {
      called = true;
    });
    expect(res.statusCode).toBe(404);
    expect(called).toBe(false);
    expect(res.body.error.code).toBe('TENANT_NOT_FOUND');
  });

  it('falls back to the default tenant for apex / no subdomain', () => {
    const req = { headers: { host: 'marvelops.app' } };
    const res = makeRes();
    let captured = null;
    tenantMiddleware(req, res, () => {
      captured = getTenantId();
    });
    expect(req.tenantId).toBeNull();
    expect(captured).toBe(DEFAULT_TENANT_ID);
  });

  it('ignores non-root hosts (localhost) and uses the default tenant', () => {
    const req = { headers: { host: 'localhost:3001' } };
    const res = makeRes();
    let captured = null;
    tenantMiddleware(req, res, () => {
      captured = getTenantId();
    });
    expect(captured).toBe(DEFAULT_TENANT_ID);
  });

  it('ignores any upstream tenant context and resolves from Host (security)', () => {
    // The Host header is authoritative; a request must not be able to smuggle
    // in a tenant context via an upstream middleware. An apex host yields the
    // default tenant regardless of any outer runWithTenant().
    const req = { headers: { host: 'marvelops.app' } };
    const res = makeRes();
    let captured = null;
    runWithTenant('abc', () => {
      tenantMiddleware(req, res, () => {
        captured = getTenantId();
      });
    });
    expect(captured).toBe(DEFAULT_TENANT_ID);
  });
});

describe('workspaceUrl', () => {
  const originalAppUrl = process.env.APP_URL;
  afterAll(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  });

  it('builds the tenant’s own subdomain when one is resolved (subdomain mode)', () => {
    // APP_ROOT_DOMAIN is 'marvelops.app' for this whole file (see top).
    delete process.env.APP_URL;
    const req = { tenant: { slug: 'acme' }, protocol: 'https', get: () => 'marvelops.app' };
    expect(workspaceUrl(req)).toBe('https://acme.marvelops.app');
  });

  it('prefers the tenant subdomain over a global APP_URL override', () => {
    // This is the bug being fixed: an operator setting APP_URL for an
    // unrelated reason (e.g. a canonical URL for cron/report links) must not
    // silently redirect every invite to the apex instead of the workspace
    // that actually issued it.
    process.env.APP_URL = 'https://marvelops.app';
    const req = { tenant: { slug: 'acme' }, protocol: 'https', get: () => 'acme.marvelops.app' };
    expect(workspaceUrl(req)).toBe('https://acme.marvelops.app');
  });

  it('falls back to APP_URL when there is no resolved tenant (legacy/apex, no cookie)', () => {
    process.env.APP_URL = 'https://marvelops.app';
    const req = { tenant: null, protocol: 'https', get: () => 'marvelops.app' };
    expect(workspaceUrl(req)).toBe('https://marvelops.app');
  });

  it('falls back to the request origin when neither a tenant nor APP_URL is available', () => {
    delete process.env.APP_URL;
    const req = { tenant: null, protocol: 'https', get: () => 'marvelops.app' };
    expect(workspaceUrl(req)).toBe('https://marvelops.app');
  });

  it('uses APP_URL (single-domain / cookie mode has no per-tenant subdomain to build)', () => {
    // Same shape as single-domain mode: APP_ROOT_DOMAIN would be unset there,
    // so even a resolved req.tenant (via the active_tenant cookie) can't
    // produce a subdomain — this pins the case where APP_ROOT_DOMAIN is set
    // but req.tenant is unresolved (e.g. an apex request with no cookie yet).
    process.env.APP_URL = 'https://acme-agency.example';
    const req = { tenant: null, protocol: 'https', get: () => 'marvelops.app' };
    expect(workspaceUrl(req)).toBe('https://acme-agency.example');
  });
});
