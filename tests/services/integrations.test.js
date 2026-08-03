import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { getDb } from '../../server/db.js';

// MICROSOFT_CLIENT_ID is captured as a module-level constant at import time,
// so it must be set before the first import of services/integrations.js.
process.env.MICROSOFT_CLIENT_ID = 'test-client-id-123';

const { getOutlookStatus, disconnectOutlook, connectOutlook, sendOutlookEmail } =
  await import('../../server/services/integrations.js');

const db = getDb();

function outlookTokenRow(userId) {
  const row = db.prepare("SELECT data FROM entities WHERE type = 'OutlookToken' AND id = ?").get(userId);
  return row ? JSON.parse(row.data) : null;
}

describe('Integrations Service', () => {
  beforeAll(() => {
    getDb();
  });

  describe('getOutlookStatus', () => {
    it('should return disconnected for unknown user', () => {
      const status = getOutlookStatus('nonexistent-user');
      expect(status).toEqual({ connected: false });
    });
  });

  describe('disconnectOutlook', () => {
    it('should not throw for unknown user', () => {
      expect(() => disconnectOutlook('nonexistent-user')).not.toThrow();
    });
  });

  describe('connectOutlook / sendOutlookEmail', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('connects and stores the Graph profile', async () => {
      const userId = 'user-connect-1';
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url) => {
          expect(String(url)).toContain('/me');
          return { ok: true, json: async () => ({ mail: 'agent@company.com', displayName: 'Agent Smith' }) };
        }),
      );

      const result = await connectOutlook(userId, {
        token_data: { access_token: 'tok', refresh_token: 'refresh', expires_in: 3600 },
      });

      expect(result).toEqual({ email: 'agent@company.com', name: 'Agent Smith' });
      expect(getOutlookStatus(userId)).toEqual({ connected: true, email: 'agent@company.com', name: 'Agent Smith' });
    });

    it('rejects a connect with no access token', async () => {
      await expect(connectOutlook('user-connect-2', { token_data: {} })).rejects.toThrow('Missing access token');
    });

    it('falls back to a 1h expiry instead of NaN when expires_in is missing', async () => {
      const userId = 'user-connect-3';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, json: async () => ({}) })),
      );

      await connectOutlook(userId, { token_data: { access_token: 'tok', refresh_token: 'refresh' } });

      const stored = outlookTokenRow(userId);
      expect(Number.isFinite(stored.expires_at)).toBe(true);
      expect(stored.expires_at).toBeGreaterThan(Date.now());
    });

    it('sends an email using a still-valid access token without refreshing', async () => {
      const userId = 'user-send-1';
      const fetchMock = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/sendMail')) return { ok: true, json: async () => ({}) };
        if (u.includes('/me')) return { ok: true, json: async () => ({ mail: 'a@b.com' }) };
        throw new Error(`Unexpected fetch: ${u}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      await connectOutlook(userId, {
        token_data: { access_token: 'valid-token', refresh_token: 'refresh', expires_in: 3600 },
      });
      await sendOutlookEmail(userId, { to: 'client@example.com', subject: 'Hi', body: 'Hello' });

      const sendCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/sendMail'));
      expect(sendCall[1].headers.Authorization).toBe('Bearer valid-token');
    });

    it('refreshes an expired access token before sending', async () => {
      const userId = 'user-send-2';
      const fetchMock = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/sendMail')) return { ok: true, json: async () => ({}) };
        if (u.includes('/oauth2/v2.0/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'refreshed-token', refresh_token: 'new-refresh', expires_in: 3600 }),
          };
        }
        if (u.includes('/me')) return { ok: true, json: async () => ({ mail: 'a@b.com' }) };
        throw new Error(`Unexpected fetch: ${u}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      await connectOutlook(userId, {
        token_data: { access_token: 'stale-token', refresh_token: 'refresh', expires_in: -10 },
      });
      await sendOutlookEmail(userId, { to: 'client@example.com', subject: 'Hi', body: 'Hello' });

      const sendCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/sendMail'));
      expect(sendCall[1].headers.Authorization).toBe('Bearer refreshed-token');
    });

    it('auto-disconnects and throws Unauthorized on a 401 from Graph', async () => {
      const userId = 'user-send-401';
      const fetchMock = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/sendMail')) return { ok: false, status: 401, text: async () => 'unauthorized' };
        if (u.includes('/me')) return { ok: true, json: async () => ({ mail: 'a@b.com' }) };
        throw new Error(`Unexpected fetch: ${u}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      await connectOutlook(userId, { token_data: { access_token: 'tok', refresh_token: 'refresh', expires_in: 3600 } });
      await expect(sendOutlookEmail(userId, { to: 'x@y.com', subject: 'Hi', body: 'Hello' })).rejects.toThrow(
        'Outlook authorization expired',
      );

      expect(getOutlookStatus(userId)).toEqual({ connected: false });
    });

    it('surfaces a clear permission error on a 403 from Graph, keeping the connection', async () => {
      const userId = 'user-send-403';
      const fetchMock = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/sendMail')) return { ok: false, status: 403, text: async () => 'forbidden' };
        if (u.includes('/me')) return { ok: true, json: async () => ({ mail: 'a@b.com' }) };
        throw new Error(`Unexpected fetch: ${u}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      await connectOutlook(userId, { token_data: { access_token: 'tok', refresh_token: 'refresh', expires_in: 3600 } });
      await expect(sendOutlookEmail(userId, { to: 'x@y.com', subject: 'Hi', body: 'Hello' })).rejects.toThrow(
        /Mail.Send/,
      );

      expect(getOutlookStatus(userId)).toEqual({ connected: true, email: 'a@b.com', name: '' });
    });

    it('fails clearly when a refresh is needed but there is no refresh token', async () => {
      const userId = 'user-send-norefresh';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, json: async () => ({ mail: 'a@b.com' }) })),
      );

      await connectOutlook(userId, { token_data: { access_token: 'stale', expires_in: -10 } });
      await expect(sendOutlookEmail(userId, { to: 'x@y.com', subject: 'Hi', body: 'Hello' })).rejects.toThrow(
        'No refresh token available',
      );
    });
  });
});
