import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { getDb } from '../../server/db.js';
import { generateToken } from '../../server/middleware/auth.js';
import { errorHandler } from '../../server/middleware/errors.js';
import auditRouter from '../../server/routes/audit.js';

// Regression test: GET /api/audit/logs used to be readable by ANY
// authenticated user (including client/supplier portal accounts), leaking
// staff emails, entity ids, and request IPs. The route is admin-only now.

const db = getDb();

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/audit', auditRouter);
  app.use(errorHandler);
  return app;
}

let server;
let baseUrl;
const tokens = {};

function insertUser({ id, email, tier }) {
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).run(id, email, '', email.split('@')[0], tier, tier, now, now);
}

const USERS = [
  { id: 'audit-admin-1', email: 'audit-admin@example.com', tier: 'admin' },
  { id: 'audit-agent-1', email: 'audit-agent@example.com', tier: 'agent' },
  { id: 'audit-client-1', email: 'audit-client@example.com', tier: 'client' },
];

beforeAll(async () => {
  // authMiddleware re-reads the user from the DB on every request, so the
  // token subjects must exist as real rows — a signed JWT alone is not enough.
  for (const u of USERS) {
    insertUser(u);
    tokens[u.tier] = generateToken({ id: u.id, email: u.email, user_tier: u.tier, role: u.tier });
  }

  const app = makeApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  db.prepare(`DELETE FROM users WHERE id IN ('audit-admin-1', 'audit-agent-1', 'audit-client-1')`).run();
  await new Promise((resolve) => server.close(resolve));
});

describe('GET /api/audit/logs', () => {
  it('returns logs for an admin', async () => {
    const res = await fetch(`${baseUrl}/api/audit/logs`, {
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it('rejects staff below admin', async () => {
    const res = await fetch(`${baseUrl}/api/audit/logs`, {
      headers: { Authorization: `Bearer ${tokens.agent}` },
    });
    expect(res.status).toBe(403);
  });

  it('rejects client-portal users', async () => {
    const res = await fetch(`${baseUrl}/api/audit/logs`, {
      headers: { Authorization: `Bearer ${tokens.client}` },
    });
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await fetch(`${baseUrl}/api/audit/logs`);
    expect(res.status).toBe(401);
  });
});
