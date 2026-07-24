import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import { getJwtSecret } from '../middleware/auth.js';
import logger from './logger.js';

// Connections are scoped per tenant so a live update for one agency is never
// delivered to another's sockets. Keyed by `${tenantId}|${userId}` -> Set<ws>.
const clients = new Map();

function clientKey(tenantId, userId) {
  return `${tenantId}|${userId}`;
}

export function createWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
    const url = new URL(req.url, 'http://localhost');
    const token = cookies.token || url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user;
    try {
      user = jwt.verify(token, getJwtSecret());
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.userId = user.id;
    // The tenant claim pins the socket to the user's workspace; broadcasts and
    // direct sends use it so cross-tenant ids can never collide or leak.
    ws.tenantId = user.tenant_id || '0';

    const key = clientKey(ws.tenantId, user.id);
    if (!clients.has(key)) clients.set(key, new Set());
    clients.get(key).add(ws);

    logger.debug({ userId: user.id, tenantId: ws.tenantId }, 'WebSocket connected');

    ws.on('close', () => {
      const conns = clients.get(key);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) clients.delete(key);
      }
      logger.debug({ userId: user.id, tenantId: ws.tenantId }, 'WebSocket disconnected');
    });

    ws.on('error', (err) => {
      logger.error({ err, userId: user.id, tenantId: ws.tenantId }, 'WebSocket connection error');
      // Terminate the faulty socket so it can't linger half-open; the 'close'
      // handler above then removes it from the clients map.
      try {
        ws.terminate();
      } catch {}
    });
  });

  wss.on('error', (err) => logger.error({ err }, 'WebSocket server error'));

  logger.info('WebSocket server initialized at /ws');
  return wss;
}

export function sendToUser(userId, data, tenantId = '0') {
  const conns = clients.get(clientKey(tenantId, userId));
  if (!conns || conns.size === 0) return false;
  const message = JSON.stringify(data);
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(message);
  }
  return true;
}

// Sends to every connected user in a single tenant, except (optionally) the
// one who triggered the change. tenantId is required — a broadcast with no
// tenant would otherwise fan out across all agencies (cross-tenant leak).
export function broadcast(data, { excludeUserId, tenantId } = {}) {
  if (!tenantId) {
    logger.error('broadcast() called without tenantId — refusing to fan out across tenants');
    return;
  }
  const message = JSON.stringify(data);
  const prefix = `${tenantId}|`;
  for (const [key, conns] of clients.entries()) {
    if (!key.startsWith(prefix)) continue;
    const userId = key.slice(prefix.length);
    if (excludeUserId && userId === excludeUserId) continue;
    for (const ws of conns) {
      if (ws.readyState === 1) ws.send(message);
    }
  }
}

export function getConnectedUserIds(tenantId) {
  if (!tenantId) return Array.from(clients.keys()).map((k) => k.split('|')[1]);
  const prefix = `${tenantId}|`;
  return Array.from(clients.keys())
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));
}
