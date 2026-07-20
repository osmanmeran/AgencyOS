import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import app from '../../server/app.js';
import { getDb, getPlatformDb } from '../../server/db.js';

// Authenticated workspace control plane (Phase 4). Exercises GET/PATCH
// /api/tenants/me against the real app (tenantMiddleware + authMiddleware +
// csrfMiddleware) on the default (apex) tenant, which resolves to tenant '0'.
const ADMIN_ID = 'ws-me-admin';
const AGENT_ID = 'ws-me-agent';
const EMAIL = 'ws-me-admin@example.com';
const AGENT_EMAIL = 'ws-me-agent@example.com';
const PASSWORD = 'correct horse battery staple';

let server;
let baseUrl;

function insertUsers() {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).run(ADMIN_ID, EMAIL, bcrypt.hashSync(PASSWORD, 10), 'WS Admin', 'admin', 'admin', now, now);
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).run(AGENT_ID, AGENT_EMAIL, bcrypt.hashSync(PASSWORD, 10), 'WS Agent', 'agent', 'agent', now, now);
}

// The apex resolves to tenant '0'; the control plane needs a platform row for it.
function ensureTenantZero() {
  const platform = getPlatformDb();
  if (!platform.prepare('SELECT id FROM tenants WHERE id = ?').get('0')) {
    platform
      .prepare(
        "INSERT INTO tenants (id, slug, name, status, azure_tenant_id, created_date) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      )
      .run('0', 'legacy', 'Legacy Agency', 'active', null);
  }
}

async function login(email) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  const setCookies = res.headers.getSetCookie();
  const get = (name) => {
    const h = setCookies.find((c) => c.startsWith(name + '='));
    return h ? h.split(';')[0] : null;
  };
  const token = get('token');
  const refresh = get('refresh_token');
  const csrf = get('csrf_token');
  return {
    token,
    refresh,
    csrf,
    cookieHeader: [token, refresh, csrf].filter(Boolean).join('; '),
    csrfValue: csrf ? csrf.split('=')[1] : null,
  };
}

beforeAll(async () => {
  ensureTenantZero();
  insertUsers();
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
    server.on('error', reject);
  });
});

afterAll(async () => {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(ADMIN_ID, AGENT_ID);
  getPlatformDb().prepare('DELETE FROM tenants WHERE id = ?').run('0');
  if (server) await new Promise((r) => server.close(r));
});

describe('GET /api/tenants/me', () => {
  it('returns the workspace for an authenticated member', async () => {
    const s = await login(EMAIL);
    const res = await fetch(`${baseUrl}/api/tenants/me`, {
      headers: { Cookie: s.cookieHeader },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('0');
    expect(body.slug).toBe('legacy');
    expect(body.name).toBe('Legacy Agency');
    expect(body.status).toBe('active');
  });

  it('rejects an unauthenticated request (401)', async () => {
    const res = await fetch(`${baseUrl}/api/tenants/me`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/tenants/me', () => {
  it('updates name + azureTenantId for an admin', async () => {
    const s = await login(EMAIL);
    const res = await fetch(`${baseUrl}/api/tenants/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrfValue, Cookie: s.cookieHeader },
      body: JSON.stringify({ name: 'Renamed Agency', azureTenantId: '11111111-1111-1111-1111-111111111111' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Renamed Agency');
    expect(body.azureTenantId).toBe('11111111-1111-1111-1111-111111111111');

    // Persisted: a subsequent GET reflects the change.
    const getRes = await fetch(`${baseUrl}/api/tenants/me`, { headers: { Cookie: s.cookieHeader } });
    const getBody = await getRes.json();
    expect(getBody.name).toBe('Renamed Agency');
    expect(getBody.azureTenantId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('rejects an invalid azureTenantId (400)', async () => {
    const s = await login(EMAIL);
    const res = await fetch(`${baseUrl}/api/tenants/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrfValue, Cookie: s.cookieHeader },
      body: JSON.stringify({ azureTenantId: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
  });

  it('forbids a non-admin member (403)', async () => {
    const s = await login(AGENT_EMAIL);
    const res = await fetch(`${baseUrl}/api/tenants/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrfValue, Cookie: s.cookieHeader },
      body: JSON.stringify({ name: 'Hijack' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects a missing CSRF token (403)', async () => {
    const s = await login(EMAIL);
    const res = await fetch(`${baseUrl}/api/tenants/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: s.cookieHeader },
      body: JSON.stringify({ name: 'No Csrf' }),
    });
    expect(res.status).toBe(403);
  });
});
