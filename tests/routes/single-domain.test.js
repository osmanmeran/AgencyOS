import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { getDb, getPlatformDb, getDbPath } from '../../server/db.js';
import app from '../../server/app.js';

// Single-domain (cookie) mode: when APP_ROOT_DOMAIN is unset (e.g. a default
// *.up.railway.app host), a workspace is reached via the `active_tenant`
// cookie on the bare domain rather than a <slug>.<domain> subdomain. This suite
// proves a workspace can be created AND used (login + authenticated call) without
// any subdomain DNS.

// Avoid live Microsoft JWKS in the SSO-signup path.
vi.mock('../../server/services/microsoft.js', () => ({
  verifyMicrosoftIdToken: vi.fn(async () => ({
    email: 'sso@agency.com',
    name: 'SSO Admin',
    microsoftId: 'oid-sso-123',
    tid: 'tid-sso-123',
  })),
}));

const createdTenantIds = [];
let server;
let baseUrl;
let counter = 0;

function uniqueSlug() {
  counter += 1;
  return `ws${Date.now().toString(36)}${counter}`;
}

function cookieHeader(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return all.map((c) => c.split(';')[0]).join('; ');
}

function cookieValue(res, name) {
  const header = cookieHeader(res);
  const m = header.split('; ').find((c) => c.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : null;
}

beforeAll(async () => {
  process.env.ALLOW_PUBLIC_SIGNUP = 'true';
  delete process.env.APP_ROOT_DOMAIN; // force single-domain (cookie) mode
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

describe('single-domain (cookie) workspace mode', () => {
  it('signup sets the active_tenant cookie (no subdomain)', async () => {
    const slug = uniqueSlug();
    const res = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: 'Cookie Agency',
        slug,
        adminEmail: `${slug}@example.com`,
        adminPassword: 'Passw0rd1',
        adminName: 'Owner',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdTenantIds.push(body.tenant.id);

    // No subdomain URL in single-domain mode.
    expect(body.workspaceUrl).toBe('/');

    // The active_tenant cookie selects the workspace on the bare domain.
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/active_tenant=/);
    expect(cookieValue(res, 'active_tenant')).toBe(slug);
  });

  it('authenticated calls resolve to the cookie-selected workspace on the bare domain', async () => {
    const slug = uniqueSlug();
    const email = `${slug}@example.com`;
    const signup = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: 'Resolved Agency',
        slug,
        adminEmail: email,
        adminPassword: 'Passw0rd1',
        adminName: 'Owner',
      }),
    });
    const { tenant } = await signup.json();
    createdTenantIds.push(tenant.id);

    // GET /api/auth/me on the bare domain, presenting the cookies the signup
    // set (token + active_tenant). It must land on the new workspace, not tenant 0.
    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader(signup) },
    });
    expect(me.status).toBe(200);
    const meBody = await me.json();
    expect(meBody.success).toBe(true);
    expect(meBody.user.email).toBe(email);

    // The user actually lives in the new tenant's isolated DB.
    const tenantDb = getDb(tenant.id);
    const row = tenantDb.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email.toLowerCase());
    expect(row).toBeTruthy();
  });

  it('login on the bare domain finds the user across tenants and sets the cookie', async () => {
    const slug = uniqueSlug();
    const email = `${slug}@example.com`;
    const signup = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: 'Login Agency',
        slug,
        adminEmail: email,
        adminPassword: 'Passw0rd1',
        adminName: 'Owner',
      }),
    });
    const { tenant } = await signup.json();
    createdTenantIds.push(tenant.id);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Passw0rd1' }),
    });
    expect(login.status).toBe(200);
    expect(cookieValue(login, 'active_tenant')).toBe(slug);

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader(login) },
    });
    expect(me.status).toBe(200);
    expect((await me.json()).user.email).toBe(email);
  });

  it('rejects a workspace token presented against a different active_tenant cookie', async () => {
    // Workspace X: the token we'll present.
    const slugX = uniqueSlug();
    const emailX = `${slugX}@example.com`;
    const signupX = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: 'Workspace X',
        slug: slugX,
        adminEmail: emailX,
        adminPassword: 'Passw0rd1',
        adminName: 'Owner X',
      }),
    });
    const { tenant: tenantX } = await signupX.json();
    createdTenantIds.push(tenantX.id);

    // Workspace Y: a different active_tenant selector.
    const slugY = uniqueSlug();
    const signupY = await fetch(`${baseUrl}/api/tenants/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: 'Workspace Y',
        slug: slugY,
        adminEmail: `${slugY}@example.com`,
        adminPassword: 'Passw0rd1',
        adminName: 'Owner Y',
      }),
    });
    const { tenant: tenantY } = await signupY.json();
    createdTenantIds.push(tenantY.id);

    // X's token + Y's active_tenant cookie -> the guard must reject.
    const tokenX = cookieValue(signupX, 'token');
    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `token=${tokenX}; active_tenant=${slugY}` },
    });
    expect(me.status).toBe(403);
    expect((await me.json()).error.code).toBe('TENANT_MISMATCH');
  });
});
