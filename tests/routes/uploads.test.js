import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { getDb, getPlatformDb, getDbPath, getUploadDir, uid, runWithTenant } from '../../server/db.js';
import app from '../../server/app.js';

// /uploads used to be served by express.static: no session, no tenant scoping,
// no permission check. These tests pin the three properties that replaced it —
// anonymous requests are rejected, a workspace can only read files inside its
// own uploads directory, and a document's entity permission still applies.

const createdTenantIds = [];
let server;
let baseUrl;
let counter = 0;

function uniqueSlug() {
  counter += 1;
  return `up${Date.now().toString(36)}${counter}`;
}

function cookieHeader(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return all.map((c) => c.split(';')[0]).join('; ');
}

/** Create a workspace with an admin, returning its cookies + tenant. */
async function signup() {
  const slug = uniqueSlug();
  const res = await fetch(`${baseUrl}/api/tenants/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agencyName: 'Upload Agency',
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

/** Write a file directly into a tenant's uploads dir (bypassing the upload route). */
function seedFile(tenantId, filename, contents) {
  const dir = getUploadDir(tenantId);
  fs.writeFileSync(path.join(dir, filename), contents);
  return filename;
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

describe('GET /uploads/:filename', () => {
  it('rejects anonymous requests (no longer statically served)', async () => {
    const { tenant } = await signup();
    seedFile(tenant.id, 'anon-probe.txt', 'secret');

    const res = await fetch(`${baseUrl}/uploads/anon-probe.txt`);
    expect(res.status).toBe(401);
  });

  it('serves a file to an authenticated member of the owning workspace', async () => {
    const { cookies, tenant } = await signup();
    seedFile(tenant.id, 'logo.txt', 'workspace-logo');

    const res = await fetch(`${baseUrl}/uploads/logo.txt`, { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('workspace-logo');
  });

  it('does not serve another workspace’s file, even with a valid session', async () => {
    const a = await signup();
    const b = await signup();
    seedFile(a.tenant.id, 'agency-a-passport.txt', 'A private');

    // B is fully authenticated, and knows the exact filename.
    const res = await fetch(`${baseUrl}/uploads/agency-a-passport.txt`, { headers: { Cookie: b.cookies } });
    expect(res.status).toBe(404);

    // A can still read its own file — the 404 above is isolation, not breakage.
    const own = await fetch(`${baseUrl}/uploads/agency-a-passport.txt`, { headers: { Cookie: a.cookies } });
    expect(own.status).toBe(200);
  });

  it('applies the document permission check for files attached to an entity', async () => {
    const { cookies, tenant } = await signup();
    const filename = seedFile(tenant.id, 'restricted.txt', 'restricted contents');

    // A documents row owned by a *different* user, attached to an entity that
    // does not exist — userCanAccessDocument denies it for a non-admin.
    runWithTenant(tenant.id, () => {
      getDb()
        .prepare(
          `INSERT INTO documents (id, entity_type, entity_id, original_name, stored_name, mime_type, size, uploaded_by, created_date)
           VALUES (?, 'Trip', 'nonexistent-trip', 'restricted.txt', ?, 'text/plain', 10, 'someone-else', ?)`,
        )
        .run(uid(), filename, new Date().toISOString());

      // Downgrade the workspace admin to agent so the admin bypass doesn't apply.
      getDb().prepare("UPDATE users SET user_tier = 'agent', role = 'agent'").run();
    });

    const res = await fetch(`${baseUrl}/uploads/${filename}`, { headers: { Cookie: cookies } });
    expect(res.status).toBe(403);
  });

  it('does not let /api/documents/:id/download reach another workspace’s file', async () => {
    const a = await signup();
    const b = await signup();
    const filename = seedFile(a.tenant.id, 'contract-a.txt', 'A contract');

    // Same document id exists in both workspaces' DBs (ids are per-tenant), but
    // B's row points at a file that only exists in A's directory.
    const sharedId = uid();
    const now = new Date().toISOString();
    for (const t of [a.tenant.id, b.tenant.id]) {
      runWithTenant(t, () => {
        getDb()
          .prepare(
            `INSERT INTO documents (id, entity_type, entity_id, original_name, stored_name, mime_type, size, uploaded_by, created_date)
             VALUES (?, NULL, NULL, 'contract-a.txt', ?, 'text/plain', 10, NULL, ?)`,
          )
          .run(sharedId, filename, now);
      });
    }

    const own = await fetch(`${baseUrl}/api/documents/${sharedId}/download`, { headers: { Cookie: a.cookies } });
    expect(own.status).toBe(200);
    expect(await own.text()).toBe('A contract');

    // B resolves the same stored_name inside its own (empty) uploads dir.
    const cross = await fetch(`${baseUrl}/api/documents/${sharedId}/download`, { headers: { Cookie: b.cookies } });
    expect(cross.status).toBe(404);
  });

  it('rejects path traversal attempts', async () => {
    const { cookies } = await signup();
    // Encoded so the segment survives to the route rather than being resolved
    // away by fetch/Express path normalisation.
    const res = await fetch(`${baseUrl}/uploads/${encodeURIComponent('../../marvelops.db')}`, {
      headers: { Cookie: cookies },
    });
    expect([400, 404]).toContain(res.status);
  });
});
