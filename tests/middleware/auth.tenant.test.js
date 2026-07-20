import { describe, it, expect, beforeAll } from 'vitest';
import { generateToken, authMiddleware } from '../../server/middleware/auth.js';
import { runWithTenant, getDb } from '../../server/db.js';

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

const USER = {
  id: 'u-tenant-test',
  email: 'tenant-test@agency.example',
  user_tier: 'agent',
  role: 'agent',
  custom_permissions: [],
  client_id: null,
  linked_supplier_id: null,
};

function mintToken(tenantId) {
  return runWithTenant(tenantId, () => generateToken(USER));
}

beforeAll(() => {
  // Seed the user only in tenant A's database; tenant B deliberately has no
  // such user, so a token scoped to A must never authenticate against B.
  const db = getDb('A');
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, password, name, user_tier, role, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
  ).run(USER.id, USER.email, 'x', 'Tenant Tester', USER.user_tier, USER.role);
});

describe('authMiddleware tenant scoping (Phase 2)', () => {
  it('authenticates when the subdomain tenant matches the token tenant', () => {
    const token = mintToken('A');
    const req = { headers: { authorization: `Bearer ${token}` }, tenantId: 'A' };
    const res = makeRes();
    let nextCalled = false;
    authMiddleware(req, res, () => {
      nextCalled = true;
    });
    expect(res.statusCode).toBeNull();
    expect(nextCalled).toBe(true);
    expect(req.user.id).toBe(USER.id);
  });

  it('authenticates on the apex (no subdomain) by trusting the token tenant', () => {
    const token = mintToken('A');
    const req = { headers: { authorization: `Bearer ${token}` }, tenantId: null };
    const res = makeRes();
    let nextCalled = false;
    authMiddleware(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(req.user.id).toBe(USER.id);
  });

  it('rejects a token presented against a different workspace subdomain (403)', () => {
    const token = mintToken('A');
    const req = { headers: { authorization: `Bearer ${token}` }, tenantId: 'B' };
    const res = makeRes();
    let nextCalled = false;
    authMiddleware(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('TENANT_MISMATCH');
  });

  it('writes the tenant_id claim into issued tokens', () => {
    const token = mintToken('A');
    // Decode without verifying to assert the claim is present (authMiddleware
    // already verified it on the happy path above).
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.tenant_id).toBe('A');
  });
});
