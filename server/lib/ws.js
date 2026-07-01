import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import { getJwtSecret } from '../middleware/auth.js';
import logger from './logger.js';

// Map userId -> Set<WebSocket>
const clients = new Map();

export function createWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
    const url = new URL(req.url, 'http://localhost');
    const token = cookies.token || url.searchParams.get('token');

    if (!token) { ws.close(4001, 'Authentication required'); return; }

    let user;
    try { user = jwt.verify(token, getJwtSecret()); } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.userId = user.id;

    if (!clients.has(user.id)) clients.set(user.id, new Set());
    clients.get(user.id).add(ws);

    logger.debug({ userId: user.id }, 'WebSocket connected');

    ws.on('close', () => {
      const conns = clients.get(user.id);
      if (conns) { conns.delete(ws); if (conns.size === 0) clients.delete(user.id); }
      logger.debug({ userId: user.id }, 'WebSocket disconnected');
    });

    ws.on('error', (err) => logger.error({ err }, 'WebSocket error'));
  });

  logger.info('WebSocket server initialized at /ws');
  return wss;
}

export function sendToUser(userId, data) {
  const conns = clients.get(userId);
  if (!conns || conns.size === 0) return false;
  const message = JSON.stringify(data);
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(message);
  }
  return true;
}

export function getConnectedUserIds() {
  return Array.from(clients.keys());
}
