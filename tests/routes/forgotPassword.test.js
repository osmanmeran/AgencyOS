import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { getPlatformDb, getDbPath } from '../../server/db.js';

const sentEmails = [];
vi.mock('../../server/services/email.js', () => ({
  sendEmail: vi.fn(async (payload) => {
    sentEmails.push(payload);
    return { status: 'sent' };
  }),
  isSmtpConfigured: vi.fn(() => true),
}));

const createdTenantIds = [];
let server;
let baseUrl;
let counter = 0;

function uniqueSlug() {
  counter += 1;
  return `fp${Date.now().toString(36)}${counter}`;
}

function cookieHeader(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return all.map((c) => c.split(';')[0]).join('; ');
}

async function signup(adminEmail) {
  const slug = uniqueSlug();
  const res = await fetch(`${baseUrl}/api/tenants/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agencyName: 'Forgot Password Agency',
      slug,
      adminEmail,
      adminPassword: 'OldPassw0rd1',
      adminName: 'Owner',
    }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  createdTenantIds.push(body.tenant.id);
  return { cookies: cookieHeader(res), slug };
}

beforeAll(async () => {
  process.env.ALLOW_PUBLIC_SIGNUP = 'true';
  delete process.env.APP_ROOT_DOMAIN; // single-domain (cookie) mode
  const app = (await import('../../server/app.js')).default;
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

describe('POST /api/auth/forgot-password + /reset-password', () => {
  it('responds identically for an unknown email (no enumeration) and sends no email', async () => {
    sentEmails.length = 0;
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nobody-${Date.now()}@example.com` }),
    });
    expect(res.status).toBe(200);
    expect(sentEmails).toHaveLength(0);
  });

  it('sends a working reset link for a registered account, and it changes the password', async () => {
    const adminEmail = `admin-${Date.now()}@example.com`;
    const { cookies } = await signup(adminEmail);
    sentEmails.length = 0;

    // requestPasswordReset only ever looks at the current tenant (see its doc
    // comment) — in single-domain mode that's the active_tenant cookie set at
    // signup, exactly like a real user would have from being on their own
    // workspace's login page.
    const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      body: JSON.stringify({ email: adminEmail }),
    });
    expect(forgotRes.status).toBe(200);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].template).toBe('password_reset');
    const { resetUrl } = sentEmails[0].templateData;
    expect(resetUrl).toMatch(new RegExp(`^${baseUrl}/reset-password\\?token=`));
    const token = new URL(resetUrl).searchParams.get('token');

    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'BrandNewPass1' }),
    });
    expect(resetRes.status).toBe(200);

    // Old password no longer works, new one does.
    const oldLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'OldPassw0rd1' }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'BrandNewPass1' }),
    });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an invalid reset token with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bogus-token', newPassword: 'SomePass123' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a weak new password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bogus-token', newPassword: 'short' }),
    });
    expect(res.status).toBe(400);
  });
});
