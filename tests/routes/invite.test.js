import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { getPlatformDb, getDbPath } from '../../server/db.js';

// The invite email's link used to be built from process.env.APP_URL, unconditionally
// overriding the request's own workspace — a global APP_URL set for an unrelated
// reason (e.g. a canonical URL for cron/report links) would silently send every
// invite to the apex instead of the workspace that issued it. workspaceUrl()
// (server/middleware/tenant.js) fixes this; tests/middleware/tenant.test.js pins
// the subdomain-preferred-over-APP_URL logic directly (subdomain routing can't be
// exercised over real HTTP here — Node's fetch does not allow spoofing the Host
// header, confirmed empirically). This suite instead proves the invite route is
// correctly wired end-to-end in single-domain (cookie) mode, the default when
// wildcard DNS isn't configured — where the same workspaceUrl() call now has no
// subdomain to build and must still produce a working link.

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
  return `inv${Date.now().toString(36)}${counter}`;
}

function cookieHeader(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return all.map((c) => c.split(';')[0]).join('; ');
}

function writeHeaders(cookies) {
  const csrf = cookies
    .split('; ')
    .find((c) => c.startsWith('csrf_token='))
    ?.slice('csrf_token='.length);
  return { 'Content-Type': 'application/json', Cookie: cookies, 'X-CSRF-Token': csrf || '' };
}

async function signup() {
  const slug = uniqueSlug();
  const res = await fetch(`${baseUrl}/api/tenants/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agencyName: 'Invite Agency',
      slug,
      adminEmail: `${slug}@example.com`,
      adminPassword: 'Passw0rd1',
      adminName: 'Owner',
    }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  createdTenantIds.push(body.tenant.id);
  return { cookies: cookieHeader(res), tenant: body.tenant, slug };
}

beforeAll(async () => {
  process.env.ALLOW_PUBLIC_SIGNUP = 'true';
  delete process.env.APP_ROOT_DOMAIN; // single-domain (cookie) mode: no subdomain to spoof anyway
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

describe('POST /api/auth/invite — invite link URL', () => {
  it('builds a working accept-invite link from the request origin (single-domain mode)', async () => {
    delete process.env.APP_URL;
    const { cookies } = await signup();
    sentEmails.length = 0;

    const res = await fetch(`${baseUrl}/api/auth/invite`, {
      method: 'POST',
      headers: writeHeaders(cookies),
      body: JSON.stringify({ email: 'teammate@example.com', name: 'Teammate', user_tier: 'agent' }),
    });
    expect(res.status).toBe(201);

    expect(sentEmails).toHaveLength(1);
    const { inviteUrl } = sentEmails[0].templateData;
    expect(inviteUrl).toBe(`${baseUrl}/accept-invite?token=${(await res.json()).token}`);
  });

  it('respects an explicit APP_URL override when no subdomain is in play', async () => {
    process.env.APP_URL = 'https://marvelops.example';
    const { cookies } = await signup();
    sentEmails.length = 0;

    await fetch(`${baseUrl}/api/auth/invite`, {
      method: 'POST',
      headers: writeHeaders(cookies),
      body: JSON.stringify({ email: 'second-teammate@example.com', name: 'Teammate Two', user_tier: 'agent' }),
    });

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].templateData.inviteUrl).toMatch(/^https:\/\/marvelops\.example\/accept-invite\?token=/);
    delete process.env.APP_URL;
  });
});
