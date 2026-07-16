import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { getDb } from '../../server/db.js';
import { generateToken } from '../../server/middleware/auth.js';
import { errorHandler } from '../../server/middleware/errors.js';

// The OCR router reads OCR_ENABLED at module-load time, so set it before the
// dynamic import (static imports are hoisted and would run before this line).
process.env.OCR_ENABLED = 'false';

const db = getDb();

let server;
let baseUrl;
let token;

beforeAll(async () => {
  const ocrRouter = (await import('../../server/routes/ocr.js')).default;

  const app = express();
  app.use(express.json());
  app.use('/api/integrations', ocrRouter);
  app.use(errorHandler);

  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).run('ocr-user', 'ocr@example.com', '', 'ocr', 'agent', 'agent', now, now);
  token = generateToken({ id: 'ocr-user', email: 'ocr@example.com', user_tier: 'agent', role: 'agent' });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  db.prepare(`DELETE FROM users WHERE id = 'ocr-user'`).run();
  await new Promise((resolve) => server.close(resolve));
});

describe('OCR route feature flag', () => {
  it('returns 503 OCR_DISABLED for /ocr/extract when OCR_ENABLED is false', async () => {
    const res = await fetch(`${baseUrl}/api/integrations/ocr/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file_path: '/tmp/nope.pdf' }),
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error?.code).toBe('OCR_DISABLED');
  });

  it('returns 503 OCR_DISABLED for /ocr/upload when OCR_ENABLED is false', async () => {
    const res = await fetch(`${baseUrl}/api/integrations/ocr/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error?.code).toBe('OCR_DISABLED');
  });
});
