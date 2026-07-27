import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { getPlatformDb, getDbPath } from '../../server/db.js';
import {
  setTenantStatus,
  extendTrial,
  getTenantById,
  TENANT_STATUS,
  tenantAccessState,
} from '../../server/services/tenants.js';
import app from '../../server/app.js';

// Workspace lifecycle enforcement: a suspended workspace (or one whose trial
// lapsed) is refused for business traffic but must still be able to sign in and
// read its own status — otherwise there'd be no way to show the user why the
// app stopped working, and no way for an operator to reinstate it.

const createdTenantIds = [];
let server;
let baseUrl;
let counter = 0;

function uniqueSlug() {
  counter += 1;
  return `st${Date.now().toString(36)}${counter}`;
}

function cookieHeader(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return all.map((c) => c.split(';')[0]).join('; ');
}

/** Headers for a mutating request: session cookies + the double-submit CSRF token. */
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
      agencyName: 'Lifecycle Agency',
      slug,
      adminEmail: `${slug}@example.com`,
      adminPassword: 'Passw0rd1',
      adminName: 'Owner',
    }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  createdTenantIds.push(body.tenant.id);
  return { cookies: cookieHeader(res), tenant: body.tenant, slug, email: `${slug}@example.com` };
}

beforeAll(async () => {
  process.env.ALLOW_PUBLIC_SIGNUP = 'true';
  delete process.env.APP_ROOT_DOMAIN;
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

describe('tenantAccessState', () => {
  it('always allows the legacy/default tenant (no registry row)', () => {
    expect(tenantAccessState(null).allowed).toBe(true);
    expect(tenantAccessState(undefined).allowed).toBe(true);
  });

  it('blocks suspended, allows active, and ignores a trial with no deadline', () => {
    expect(tenantAccessState({ status: TENANT_STATUS.SUSPENDED }).code).toBe('WORKSPACE_SUSPENDED');
    expect(tenantAccessState({ status: TENANT_STATUS.ACTIVE }).allowed).toBe(true);
    expect(tenantAccessState({ status: TENANT_STATUS.TRIAL, trial_ends_at: null }).allowed).toBe(true);
  });

  it('blocks an expired trial but allows one still running', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(tenantAccessState({ status: TENANT_STATUS.TRIAL, trial_ends_at: past }).code).toBe('TRIAL_EXPIRED');
    expect(tenantAccessState({ status: TENANT_STATUS.TRIAL, trial_ends_at: future }).allowed).toBe(true);
  });

  it('does not lock a workspace out over an unparseable deadline', () => {
    expect(tenantAccessState({ status: TENANT_STATUS.TRIAL, trial_ends_at: 'not-a-date' }).allowed).toBe(true);
  });
});

describe('workspace lifecycle enforcement', () => {
  it('gives a new workspace a trial deadline and normal access', async () => {
    const { cookies, tenant } = await signup();
    expect(tenant.status).toBe(TENANT_STATUS.TRIAL);

    const me = await fetch(`${baseUrl}/api/tenants/me`, { headers: { Cookie: cookies } });
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(Date.parse(body.trialEndsAt)).toBeGreaterThan(Date.now());

    const entities = await fetch(`${baseUrl}/api/entities/Client`, { headers: { Cookie: cookies } });
    expect(entities.status).toBe(200);
  });

  it('refuses business API traffic once suspended, but keeps auth and status readable', async () => {
    const { cookies, tenant } = await signup();
    setTenantStatus(tenant.id, TENANT_STATUS.SUSPENDED);

    const entities = await fetch(`${baseUrl}/api/entities/Client`, { headers: { Cookie: cookies } });
    expect(entities.status).toBe(403);
    expect((await entities.json()).error.code).toBe('WORKSPACE_SUSPENDED');

    // The user must still be able to load the app far enough to be told why.
    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookies } });
    expect(me.status).toBe(200);
    const workspace = await fetch(`${baseUrl}/api/tenants/me`, { headers: { Cookie: cookies } });
    expect(workspace.status).toBe(200);
    expect((await workspace.json()).status).toBe(TENANT_STATUS.SUSPENDED);
  });

  it('refuses traffic when the trial has lapsed', async () => {
    const { cookies, tenant } = await signup();
    getPlatformDb()
      .prepare('UPDATE tenants SET trial_ends_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 1000).toISOString(), tenant.id);

    const res = await fetch(`${baseUrl}/api/entities/Client`, { headers: { Cookie: cookies } });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('TRIAL_EXPIRED');
  });

  it('restores access when the trial is extended or the workspace is activated', async () => {
    const { cookies, tenant } = await signup();
    getPlatformDb()
      .prepare('UPDATE tenants SET trial_ends_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 1000).toISOString(), tenant.id);
    expect((await fetch(`${baseUrl}/api/entities/Client`, { headers: { Cookie: cookies } })).status).toBe(403);

    extendTrial(tenant.id, 7);
    expect((await fetch(`${baseUrl}/api/entities/Client`, { headers: { Cookie: cookies } })).status).toBe(200);

    // Activating clears the deadline entirely.
    const activated = setTenantStatus(tenant.id, TENANT_STATUS.ACTIVE);
    expect(activated.trial_ends_at).toBeNull();
    expect((await fetch(`${baseUrl}/api/entities/Client`, { headers: { Cookie: cookies } })).status).toBe(200);
  });

  it('never blocks the legacy/default workspace on the bare domain', async () => {
    // No active_tenant cookie and no subdomain -> tenant 0, which has no
    // registry row and must stay reachable regardless of other workspaces.
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
  });
});

describe('platform admin lifecycle endpoints', () => {
  it('rejects a non-platform-admin', async () => {
    const { cookies, tenant } = await signup();
    const res = await fetch(`${baseUrl}/api/platform/workspaces/${tenant.id}/status`, {
      method: 'PATCH',
      headers: writeHeaders(cookies),
      body: JSON.stringify({ status: 'suspended' }),
    });
    expect(res.status).toBe(403);
  });

  it('lets a platform admin suspend and reactivate a workspace', async () => {
    const target = await signup();
    const operator = await signup();
    process.env.PLATFORM_ADMIN_EMAILS = operator.email;
    try {
      const suspend = await fetch(`${baseUrl}/api/platform/workspaces/${target.tenant.id}/status`, {
        method: 'PATCH',
        headers: writeHeaders(operator.cookies),
        body: JSON.stringify({ status: 'suspended' }),
      });
      expect(suspend.status).toBe(200);
      expect((await suspend.json()).workspace.status).toBe('suspended');

      // The suspended workspace is now blocked...
      const blocked = await fetch(`${baseUrl}/api/entities/Client`, { headers: { Cookie: target.cookies } });
      expect(blocked.status).toBe(403);

      // ...until the operator reactivates it.
      const activate = await fetch(`${baseUrl}/api/platform/workspaces/${target.tenant.id}/status`, {
        method: 'PATCH',
        headers: writeHeaders(operator.cookies),
        body: JSON.stringify({ status: 'active' }),
      });
      expect(activate.status).toBe(200);
      const restored = await fetch(`${baseUrl}/api/entities/Client`, { headers: { Cookie: target.cookies } });
      expect(restored.status).toBe(200);
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    }
  });

  it('renames a workspace', async () => {
    const target = await signup();
    const operator = await signup();
    process.env.PLATFORM_ADMIN_EMAILS = operator.email;
    try {
      const res = await fetch(`${baseUrl}/api/platform/workspaces/${target.tenant.id}`, {
        method: 'PATCH',
        headers: writeHeaders(operator.cookies),
        body: JSON.stringify({ name: 'Renamed Agency' }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).workspace.name).toBe('Renamed Agency');
      expect(getTenantById(target.tenant.id).name).toBe('Renamed Agency');
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    }
  });

  it('extends a trial and 404s an unknown workspace', async () => {
    const operator = await signup();
    process.env.PLATFORM_ADMIN_EMAILS = operator.email;
    try {
      const extend = await fetch(`${baseUrl}/api/platform/workspaces/${operator.tenant.id}/extend-trial`, {
        method: 'POST',
        headers: writeHeaders(operator.cookies),
        body: JSON.stringify({ days: 30 }),
      });
      expect(extend.status).toBe(200);
      const { workspace } = await extend.json();
      expect(Date.parse(workspace.trialEndsAt)).toBeGreaterThan(Date.now() + 29 * 86400000);

      const missing = await fetch(`${baseUrl}/api/platform/workspaces/does-not-exist/extend-trial`, {
        method: 'POST',
        headers: writeHeaders(operator.cookies),
        body: JSON.stringify({ days: 30 }),
      });
      expect(missing.status).toBe(404);
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    }
  });
});

describe('workspace deletion', () => {
  /** Suspend `id` and delete it as `operator`, returning the raw response. */
  async function deleteAs(operator, id, confirmSlug) {
    return fetch(`${baseUrl}/api/platform/workspaces/${id}`, {
      method: 'DELETE',
      headers: writeHeaders(operator.cookies),
      body: JSON.stringify({ confirmSlug }),
    });
  }

  it('refuses to delete a workspace that is not suspended', async () => {
    const target = await signup();
    const operator = await signup();
    process.env.PLATFORM_ADMIN_EMAILS = operator.email;
    try {
      const res = await deleteAs(operator, target.tenant.id, target.slug);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('SUSPEND_FIRST');
      expect(getTenantById(target.tenant.id)).toBeTruthy();
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    }
  });

  it('refuses when the slug confirmation does not match', async () => {
    const target = await signup();
    const operator = await signup();
    process.env.PLATFORM_ADMIN_EMAILS = operator.email;
    try {
      setTenantStatus(target.tenant.id, TENANT_STATUS.SUSPENDED);
      const res = await deleteAs(operator, target.tenant.id, 'not-the-slug');
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('CONFIRM_MISMATCH');
      expect(getTenantById(target.tenant.id)).toBeTruthy();
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    }
  });

  it('never deletes the primary (legacy) workspace', async () => {
    const operator = await signup();
    process.env.PLATFORM_ADMIN_EMAILS = operator.email;
    try {
      const res = await deleteAs(operator, '0', '0');
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('CANNOT_DELETE_DEFAULT');
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    }
  });

  it('deletes a suspended workspace, leaving a restorable snapshot behind', async () => {
    const target = await signup();
    const operator = await signup();
    process.env.PLATFORM_ADMIN_EMAILS = operator.email;
    try {
      const tenantDir = path.dirname(getDbPath(target.tenant.id));
      expect(fs.existsSync(tenantDir)).toBe(true);

      setTenantStatus(target.tenant.id, TENANT_STATUS.SUSPENDED);
      const res = await deleteAs(operator, target.tenant.id, target.slug);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted.slug).toBe(target.slug);

      // Registry row and the whole data directory are gone...
      expect(getTenantById(target.tenant.id)).toBeUndefined();
      expect(fs.existsSync(tenantDir)).toBe(false);

      // ...but the pre-delete snapshot survives, outside the deleted directory.
      expect(fs.existsSync(body.snapshot)).toBe(true);
      expect(body.snapshot).toContain(`deleted-${target.slug}`);
      const restored = new Database(body.snapshot, { readonly: true });
      const admin = restored.prepare('SELECT email FROM users').get();
      expect(admin.email).toBe(target.email);
      restored.close();
      fs.rmSync(body.snapshot, { force: true });

      // A session for the deleted workspace is rejected — and crucially does
      // not resurrect its directory, since getDb() would otherwise create and
      // migrate a fresh database on demand.
      const after = await fetch(`${baseUrl}/api/tenants/me`, { headers: { Cookie: target.cookies } });
      expect(after.status).toBe(401);
      expect(fs.existsSync(tenantDir)).toBe(false);
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    }
  });
});
