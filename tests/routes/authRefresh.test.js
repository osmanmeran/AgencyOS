import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getDb } from '../../server/db.js';
import { errorHandler } from '../../server/middleware/errors.js';
import { csrfMiddleware } from '../../server/middleware/csrf.js';
import authRoutes from '../../server/routes/auth.js';
import {
  createRefreshToken,
  findValidRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  issueSession,
} from '../../server/services/auth.js';

const db = getDb();
const USER_ID = 'refresh-test-user';
const EMAIL = 'refresh-test@example.com';
const PASSWORD = 'correct horse battery staple';

function insertUser() {
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).run(USER_ID, EMAIL, bcrypt.hashSync(PASSWORD, 10), 'Refresh Test', 'agent', 'agent', now, now);
}

function fakeRes() {
  const res = {};
  res.cookies = {};
  res.cookie = (name, value) => {
    res.cookies[name] = value;
    return res;
  };
  return res;
}

beforeAll(() => {
  insertUser();
});
afterAll(() => {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(USER_ID);
  db.prepare(`DELETE FROM refresh_tokens WHERE user_id = ?`).run(USER_ID);
});

describe('refresh token service', () => {
  it('issues and rotates a refresh token, revoking the previous one', () => {
    const raw1 = createRefreshToken(USER_ID, { userAgent: 'test' });
    expect(findValidRefreshToken(raw1)).not.toBeNull();

    const rotated = rotateRefreshToken(raw1, { userAgent: 'test' });
    expect(rotated.accessToken).toBeTruthy();
    expect(rotated.refreshToken).toBeTruthy();
    expect(rotated.refreshToken).not.toBe(raw1);

    // The old token is now revoked and cannot be used again.
    expect(findValidRefreshToken(raw1)).toBeNull();
    expect(() => rotateRefreshToken(raw1)).toThrow();

    // The new token is valid.
    expect(findValidRefreshToken(rotated.refreshToken)).not.toBeNull();
  });

  it('rejects an expired or missing refresh token', () => {
    expect(findValidRefreshToken('not-a-real-token')).toBeNull();
    expect(() => rotateRefreshToken('not-a-real-token')).toThrow();
  });

  it('revokes a single token and all tokens for a user', () => {
    const a = createRefreshToken(USER_ID);
    const b = createRefreshToken(USER_ID);
    revokeRefreshToken(a);
    expect(findValidRefreshToken(a)).toBeNull();
    expect(findValidRefreshToken(b)).not.toBeNull();

    revokeAllUserRefreshTokens(USER_ID);
    expect(findValidRefreshToken(b)).toBeNull();
  });

  it('issueSession sets all three auth cookies', () => {
    const res = fakeRes();
    const session = issueSession(
      res,
      {
        id: USER_ID,
        email: EMAIL,
        user_tier: 'agent',
        role: 'agent',
        custom_permissions: [],
        client_id: null,
        linked_supplier_id: null,
      },
      {},
    );
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(res.cookies.token).toBe(session.accessToken);
    expect(res.cookies.refresh_token).toBe(session.refreshToken);
    expect(res.cookies.csrf_token).toBeTruthy();
  });
});

describe('POST /api/auth/refresh route', () => {
  let server;
  let baseUrl;

  // Log in and return { cookieHeader, csrfValue } for a fresh session. The
  // refresh token is single-use (rotation revokes it), so each CSRF-sensitive
  // test starts a new session here.
  async function login() {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    expect(loginRes.status).toBe(200);
    const setCookies = loginRes.headers.getSetCookie();
    const get = (name) => {
      const h = setCookies.find((c) => c.startsWith(name + '='));
      return h ? h.split(';')[0] : null;
    };
    const refresh = get('refresh_token');
    const csrf = get('csrf_token');
    return {
      refresh,
      csrf,
      cookieHeader: [refresh, csrf].filter(Boolean).join('; '),
      csrfValue: csrf ? csrf.split('=')[1] : null,
    };
  }

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(csrfMiddleware);
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);

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

  it('rotates the refresh token and issues a new access token', async () => {
    const s = await login();
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': s.csrfValue, Cookie: s.cookieHeader },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeTruthy();
    expect(data.user.email).toBe(EMAIL);

    const newCookies = res.headers.getSetCookie();
    const newRefresh = newCookies.find((c) => c.startsWith('refresh_token='));
    expect(newRefresh).toBeTruthy();
    expect(newRefresh.split(';')[0]).not.toBe(s.refresh);
  });

  it('rejects a refresh attempt with no refresh cookie (401)', async () => {
    const s = await login();
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': s.csrfValue, Cookie: s.csrf },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a refresh attempt without a CSRF token (403)', async () => {
    const s = await login();
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: s.cookieHeader },
    });
    expect(res.status).toBe(403);
  });
});
