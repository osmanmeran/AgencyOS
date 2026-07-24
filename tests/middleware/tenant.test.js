import { describe, it, expect, beforeAll } from 'vitest';

// APP_ROOT_DOMAIN activates subdomain routing; the middleware reads it per-call.
process.env.APP_ROOT_DOMAIN = 'marvelops.app';

import { tenantMiddleware } from '../../server/middleware/tenant.js';
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
