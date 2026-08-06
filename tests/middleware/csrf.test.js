import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { csrfMiddleware } from '../../server/middleware/csrf.js';
import { errorHandler } from '../../server/middleware/errors.js';

const TOKEN = 'a'.repeat(64);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfMiddleware);
  app.get('/api/thing', (req, res) => res.json({ ok: true }));
  app.post('/api/thing', (req, res) => res.json({ ok: true }));
  app.post('/api/auth/login', (req, res) => res.json({ ok: true }));
  app.post('/api/auth/microsoft', (req, res) => res.json({ ok: true }));
  app.post('/api/auth/google', (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

let server;
let baseUrl;

beforeAll(async () => {
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

describe('csrfMiddleware', () => {
  it('allows safe methods without a token', async () => {
    const res = await fetch(`${baseUrl}/api/thing`);
    expect(res.status).toBe(200);
  });

  it('allows the login endpoint without a token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST' });
    expect(res.status).toBe(200);
  });

  // Every SSO provider's session-establishing endpoint must be exempt: no
  // csrf_token cookie exists yet when it runs, so a double-submit check can
  // only ever fail. Google's was missed when the provider was added, which
  // made sign-in fail with "Missing or invalid CSRF token".
  it.each(['/api/auth/microsoft', '/api/auth/google'])(
    'allows the session-establishing endpoint %s without a token',
    async (path) => {
      const res = await fetch(`${baseUrl}${path}`, { method: 'POST' });
      expect(res.status).toBe(200);
    },
  );

  it('rejects a mutation with no cookie or header', async () => {
    const res = await fetch(`${baseUrl}/api/thing`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('rejects a mutation with a header but no matching cookie', async () => {
    const res = await fetch(`${baseUrl}/api/thing`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': TOKEN },
    });
    expect(res.status).toBe(403);
  });

  it('rejects a mutation when header and cookie mismatch', async () => {
    const res = await fetch(`${baseUrl}/api/thing`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': TOKEN, Cookie: `csrf_token=${'b'.repeat(64)}` },
    });
    expect(res.status).toBe(403);
  });

  it('allows a mutation when header and cookie match', async () => {
    const res = await fetch(`${baseUrl}/api/thing`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': TOKEN, Cookie: `csrf_token=${TOKEN}` },
    });
    expect(res.status).toBe(200);
  });

  it('allows a mutation authenticated via Bearer header even without a CSRF token', async () => {
    const res = await fetch(`${baseUrl}/api/thing`, {
      method: 'POST',
      headers: { Authorization: 'Bearer sometoken' },
    });
    expect(res.status).toBe(200);
  });
});
