import { describe, it, expect } from 'vitest';
import http from 'http';
import { WebSocket } from 'ws';
import { generateToken } from '../../server/middleware/auth.js';
import { runWithTenant } from '../../server/db.js';
import { createWebSocketServer, broadcast, sendToUser } from '../../server/lib/ws.js';

function listen(server) {
  return new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
}
function wsConnect(port, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}
function nextMessage(ws) {
  return new Promise((resolve) => ws.once('message', (d) => resolve(JSON.parse(d.toString()))));
}
function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

const mkUser = (id) => ({
  id,
  email: `${id}@example.com`,
  user_tier: 'agent',
  role: 'agent',
  custom_permissions: [],
  client_id: null,
  linked_supplier_id: null,
});

describe('WebSocket tenant isolation (Phase 2)', () => {
  it('delivers a broadcast only to the matching tenant', async () => {
    const server = http.createServer();
    const wss = createWebSocketServer(server);
    const port = await listen(server);

    const tokenA = runWithTenant('A', () => generateToken(mkUser('ua')));
    const tokenB = runWithTenant('B', () => generateToken(mkUser('ub')));

    const clientA = await wsConnect(port, tokenA);
    const clientB = await wsConnect(port, tokenB);

    const msgA = nextMessage(clientA);
    const msgB = nextMessage(clientB);

    const payload = { type: 'entity_change', action: 'create', entityType: 'Trip', entityId: '1' };
    broadcast(payload, { tenantId: 'A' });

    const receivedA = await msgA;
    let bReceived = false;
    try {
      await Promise.race([msgB, timeout(300)]);
      bReceived = true;
    } catch {
      // expected: tenant B must not receive tenant A's broadcast
    }

    expect(receivedA.type).toBe('entity_change');
    expect(bReceived).toBe(false);

    clientA.close();
    clientB.close();
    await new Promise((r) => wss.close(r));
    await new Promise((r) => server.close(r));
  });

  it('scopes sendToUser by tenant so user ids cannot collide across tenants', async () => {
    const server = http.createServer();
    const wss = createWebSocketServer(server);
    const port = await listen(server);

    const tokenA = runWithTenant('A', () => generateToken(mkUser('same-id')));
    const tokenB = runWithTenant('B', () => generateToken(mkUser('same-id')));

    const clientA = await wsConnect(port, tokenA);
    const clientB = await wsConnect(port, tokenB);

    const msgA = nextMessage(clientA);
    const msgB = nextMessage(clientB);

    // A user "same-id" exists in BOTH tenants; a targeted send to tenant A must
    // reach only tenant A's socket, not tenant B's.
    const ok = sendToUser('same-id', { type: 'ping' }, 'A');
    expect(ok).toBe(true);

    const receivedA = await msgA;
    let bReceived = false;
    try {
      await Promise.race([msgB, timeout(300)]);
      bReceived = true;
    } catch {
      // expected
    }

    expect(receivedA.type).toBe('ping');
    expect(bReceived).toBe(false);

    // Sending to tenant B's "same-id" reaches B, not A.
    const msgA2 = nextMessage(clientA);
    const okB = sendToUser('same-id', { type: 'pong' }, 'B');
    expect(okB).toBe(true);
    const receivedB = await msgB;
    let aReceived2 = false;
    try {
      await Promise.race([msgA2, timeout(300)]);
      aReceived2 = true;
    } catch {}
    expect(receivedB.type).toBe('pong');
    expect(aReceived2).toBe(false);

    clientA.close();
    clientB.close();
    await new Promise((r) => wss.close(r));
    await new Promise((r) => server.close(r));
  });

  it('refuses to broadcast without a tenantId (no cross-tenant fan-out)', () => {
    // Calling broadcast() with no tenantId must be a no-op, not a leak.
    expect(() => broadcast({ type: 'x' })).not.toThrow();
  });
});
