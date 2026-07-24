import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { getDb, getPlatformDb, getDbPath } from '../../server/db.js';
import { getTenantBySlug } from '../../server/services/tenants.js';
import app from '../../server/app.js';

// Avoid live Microsoft JWKS calls in the SSO-signup tests: verifyMicrosoftIdToken
// is replaced with a deterministic claim set. (/api/auth/microsoft is unaffected
// because mocks are file-scoped.)
vi.mock('../../server/services/microsoft.js', () => ({
  verifyMicrosoftIdToken: vi.fn(async () => ({
    email: 'sso@agency.com',
    name: 'SSO Admin',
    microsoftId: 'oid-sso-123',
    tid: 'tid-sso-123',
  })),
}));

// Exercises the real app (csrfMiddleware exemption, tenantMiddleware, rate
// limit, and the route mount) against the isolated test DATA_DIR.

const createdTenantIds = [];
let server;
let baseUrl;
let counter = 0;

function uniqueSlug() {
  counter += 1;
  return `ws${Date.now().toString(36)}${counter}`;
}

beforeAll(async () => {
  process.env.ALLOW_PUBLIC_SIGNUP = 'true';
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
    server.on('error', reject);
  });
});

afterAll(async () => {
  delete process.env.ALLOW_PUBLIC_SIGNUP;
  const platform = getPlatformDb();
  for (const id of createdTenantIds) {
    try {
      platform.prepare('DELETE FROM tenants WHERE id = ?').run(id);
    } catch {
      /* ignore */
    }
    const p = getDbPath(id);
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(path.dirname(p), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
  if (server) await new Promise((r) => server.close(r));
});

describe('self-serve workspace signup', () => {
  it('rejects signup when self-serve is disabled', async () => {
    const prev = process.env.ALLOW_PUBLIC_SIGNUP;
    process.env.ALLOW_PUBLIC_SIGNUP = 'false';
    try {
      const res = await fetch(`${baseUrl}/api/tenants/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyName: 'X',
          slug: uniqueSlug(),
          adminEmail: 'a@example.com',
          adminPassword: 'Passw0rd1',
        }),
      });
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe('SIGNUP_DISABLED');
    } finally {
      process.env.ALLOW_PUBLIC_SIGNUP = prev;
    }
  });

  it('exposes signup enabled state via /signup-status', async () => {
    const res = await fetch(`${baseUrl}/api/tenants/signup-status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    // No APP_ROOT_DOMAIN in this suite -> single-domain (cookie) mode.
    expect(body.subdomainMode).toBe(false);
    expect(body.rootDomain).toBe(null);
  });

  it('creates a workspace, admin user, and session', async () => {
    const slug = uniqueSlug();
    const email = `${slug}@example.com`;
    const res = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: 'Test Agency',
        slug,
        adminEmail: email,
        adminPassword: 'Passw0rd1',
        adminName: 'Owner',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(email);
    expect(body.user.user_tier).toBe('admin');
    expect(body.tenant.slug).toBe(slug);
    expect(body.tenant.status).toBe('trial');
    createdTenantIds.push(body.tenant.id);

    // Platform registry row exists.
    expect(getTenantBySlug(slug).id).toBe(body.tenant.id);

    // The admin was created in the new tenant's isolated DB.
    const tenantDb = getDb(body.tenant.id);
    const adminRow = tenantDb.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email.toLowerCase());
    expect(adminRow).toBeTruthy();
    expect(adminRow.user_tier).toBe('admin');
    expect(adminRow.is_active).toBe(1);

    // Auth cookies were set.
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/token=/);
    expect(setCookie).toMatch(/refresh_token=/);
  });

  it('rejects a duplicate slug', async () => {
    const slug = uniqueSlug();
    const first = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyName: 'A', slug, adminEmail: `${slug}a@x.com`, adminPassword: 'Passw0rd1' }),
    });
    expect(first.status).toBe(201);
    createdTenantIds.push((await first.json()).tenant.id);

    const second = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyName: 'B', slug, adminEmail: `${slug}b@x.com`, adminPassword: 'Passw0rd1' }),
    });
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe('SLUG_TAKEN');
  });

  it('rejects reserved/invalid slugs without creating a tenant', async () => {
    for (const slug of ['admin', 'api', 'has space', 'Under_Score']) {
      const res = await fetch(`${baseUrl}/api/tenants/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyName: 'A', slug, adminEmail: 'a@b.com', adminPassword: 'Passw0rd1' }),
      });
      expect(res.status).toBe(400);
      expect(getTenantBySlug(slug)).toBeUndefined();
    }
  });

  it('rejects a weak password', async () => {
    const res = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyName: 'A', slug: uniqueSlug(), adminEmail: 'a@b.com', adminPassword: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('reports slug availability via check-slug', async () => {
    const freeSlug = uniqueSlug();
    const free = await fetch(`${baseUrl}/api/tenants/check-slug?slug=${freeSlug}`);
    expect(await free.json()).toEqual({ available: true });

    const reserved = await fetch(`${baseUrl}/api/tenants/check-slug?slug=admin`);
    expect(await reserved.json()).toEqual({ available: false, reason: 'invalid' });

    const takenSlug = uniqueSlug();
    await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: 'A',
        slug: takenSlug,
        adminEmail: `${takenSlug}@x.com`,
        adminPassword: 'Passw0rd1',
      }),
    });
    const taken = await fetch(`${baseUrl}/api/tenants/check-slug?slug=${takenSlug}`);
    const takenBody = await taken.json();
    expect(takenBody.available).toBe(false);
    expect(takenBody.reason).toBe('taken');
  });

  it('sets a root-domain cookie and workspace URL when APP_ROOT_DOMAIN is set', async () => {
    const prev = process.env.APP_ROOT_DOMAIN;
    process.env.APP_ROOT_DOMAIN = 'marvelops.app';
    try {
      const slug = uniqueSlug();
      const res = await fetch(`${baseUrl}/api/tenants/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyName: 'A',
          slug,
          adminEmail: `${slug}@x.com`,
          adminPassword: 'Passw0rd1',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      createdTenantIds.push(body.tenant.id);
      expect(body.workspaceUrl).toBe(`https://${slug}.marvelops.app`);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toMatch(/Domain=\.marvelops\.app/i);
    } finally {
      if (prev === undefined) delete process.env.APP_ROOT_DOMAIN;
      else process.env.APP_ROOT_DOMAIN = prev;
    }
  });

  it('provisions a workspace via Microsoft SSO (no password, linked to Azure tenant)', async () => {
    const slug = uniqueSlug();
    const res = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: 'SSO Agency',
        slug,
        idToken: 'fake-id-token',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdTenantIds.push(body.tenant.id);
    expect(body.user.user_tier).toBe('admin');
    expect(body.user.email).toBe('sso@agency.com');

    // The workspace is registered with the Azure tenant from the token.
    const tenantRow = getTenantBySlug(slug);
    expect(tenantRow.azure_tenant_id).toBe('tid-sso-123');

    // The admin is an SSO account: microsoft_id set, no usable password.
    const tenantDb = getDb(body.tenant.id);
    const adminRow = tenantDb.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get('sso@agency.com');
    expect(adminRow.microsoft_id).toBe('oid-sso-123');
    expect(adminRow.password).toBe('');
    expect(adminRow.is_active).toBe(1);
  });

  it('rejects signup with neither password nor idToken', async () => {
    const res = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyName: 'A', slug: uniqueSlug() }),
    });
    expect(res.status).toBe(400);
  });
});
