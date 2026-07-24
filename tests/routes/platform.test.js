import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import app from '../../server/app.js';
import { getDb, getPlatformDb } from '../../server/db.js';

// Platform (SaaS operator) admin routes. Gated by PLATFORM_ADMIN_EMAILS
// (allow-list, read at call time) on top of a normal session.
const ADMIN_EMAIL = 'platform-admin@example.com';
const MEMBER_EMAIL = 'platform-member@example.com';
const PASSWORD = 'correct horse battery staple';
const ADMIN_ID = 'plat-admin';
const MEMBER_ID = 'plat-member';

let server;
let baseUrl;

function insertUsers() {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).run(ADMIN_ID, ADMIN_EMAIL, bcrypt.hashSync(PASSWORD, 10), 'Platform Admin', 'admin', 'admin', now, now);
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).run(MEMBER_ID, MEMBER_EMAIL, bcrypt.hashSync(PASSWORD, 10), 'Platform Member', 'agent', 'agent', now, now);
}

function seedTenants() {
  const platform = getPlatformDb();
  if (!platform.prepare("SELECT id FROM tenants WHERE id = '0'").get()) {
    platform
      .prepare(
        "INSERT INTO tenants (id, slug, name, status, azure_tenant_id, created_date) VALUES ('0','legacy','Legacy Agency','active',NULL,datetime('now'))",
      )
      .run();
  }
  if (!platform.prepare("SELECT id FROM tenants WHERE slug = 'otherco'").get()) {
    platform
      .prepare(
        "INSERT INTO tenants (id, slug, name, status, azure_tenant_id, created_date) VALUES ('other','otherco','Other Co','trial',NULL,datetime('now'))",
      )
      .run();
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
    cookieHeader: [token, refresh, csrf].filter(Boolean).join('; '),
    csrfValue: csrf ? csrf.split('=')[1] : null,
  };
}

beforeAll(async () => {
  seedTenants();
  insertUsers();
  process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
    server.on('error', reject);
  });
});

afterAll(async () => {
  delete process.env.PLATFORM_ADMIN_EMAILS;
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(ADMIN_ID, MEMBER_ID);
  const platform = getPlatformDb();
  platform.prepare("DELETE FROM tenants WHERE id IN ('0','other')").run();
  if (server) await new Promise((r) => server.close(r));
});

describe('platform admin routes', () => {
  it('rejects an unauthenticated request (401)', async () => {
    const res = await fetch(`${baseUrl}/api/platform/workspaces`);
    expect(res.status).toBe(401);
  });

  it('forbids a non-platform-admin member (403)', async () => {
    const s = await login(MEMBER_EMAIL);
    const res = await fetch(`${baseUrl}/api/platform/workspaces`, {
      headers: { Cookie: s.cookieHeader },
    });
    expect(res.status).toBe(403);
  });

  it('lists workspaces for a platform admin (200)', async () => {
    const s = await login(ADMIN_EMAIL);
    const res = await fetch(`${baseUrl}/api/platform/workspaces`, {
      headers: { Cookie: s.cookieHeader },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.workspaces)).toBe(true);
    expect(body.workspaces.length).toBeGreaterThanOrEqual(2);
    const slugs = body.workspaces.map((w) => w.slug);
    expect(slugs).toContain('legacy');
    expect(slugs).toContain('otherco');
    const legacy = body.workspaces.find((w) => w.slug === 'legacy');
    expect(legacy.userCount).toBeGreaterThanOrEqual(2); // admin + member seeded
    expect(typeof legacy.entityCount).toBe('number');
  });

  it('returns platform stats (200)', async () => {
    const s = await login(ADMIN_EMAIL);
    const res = await fetch(`${baseUrl}/api/platform/stats`, {
      headers: { Cookie: s.cookieHeader },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceCount).toBeGreaterThanOrEqual(2);
    expect(body.byStatus).toBeTruthy();
    expect(body.totalUsers).toBeGreaterThanOrEqual(2);
  });
});
