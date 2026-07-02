import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { getDb } from '../../server/db.js';
import { generateToken } from '../../server/middleware/auth.js';
import { errorHandler } from '../../server/middleware/errors.js';
import suggestionsRouter from '../../server/routes/suggestions.js';

// Regression test for a bug where POST/GET /api/suggestions always 500'd:
// the route wrote/read a `created_by` SQL column on `entities` that no
// migration ever created (the field only exists inside the JSON `data` blob).

const db = getDb();

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/suggestions', suggestionsRouter);
  app.use(errorHandler);
  return app;
}

let server;
let baseUrl;
let agentToken;
let adminToken;

beforeAll(async () => {
  db.prepare(`DELETE FROM entities WHERE type = 'Suggestion'`).run();

  agentToken = generateToken({ id: 'agent-1', email: 'agent@example.com', user_tier: 'agent', role: 'agent' });
  adminToken = generateToken({ id: 'admin-1', email: 'admin@example.com', user_tier: 'admin', role: 'admin' });

  const app = makeApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('POST/GET /api/suggestions', () => {
  it('submits a suggestion without throwing a 500', async () => {
    const res = await fetch(`${baseUrl}/api/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ type: 'feature', title: 'Add dark mode', description: 'Please' }),
    });

    expect(res.status).toBe(201);
  });

  it('lists suggestions with created_by for an admin', async () => {
    const res = await fetch(`${baseUrl}/api/suggestions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const mine = body.find(s => s.title === 'Add dark mode');
    expect(mine).toBeTruthy();
    expect(mine._created_by).toBe('agent-1');
  });

  it('rejects listing for non-admins', async () => {
    const res = await fetch(`${baseUrl}/api/suggestions`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    expect(res.status).toBe(403);
  });
});
