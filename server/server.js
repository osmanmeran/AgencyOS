import 'dotenv/config';
import http from 'http';
import https from 'https';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';
import logger from './lib/logger.js';
import { createWebSocketServer, sendToUser } from './lib/ws.js';
import { setBroadcastFn } from './services/notifications.js';
import { startReminderService } from './services/reminders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const BIND_ADDRESS = process.env.BIND_ADDRESS || '0.0.0.0';

const server = http.createServer(app);

const wss = createWebSocketServer(server);

setBroadcastFn((userId, notification) => {
  sendToUser(userId, { type: 'notification', notification });
});

const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
const hasSsl = sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

const getLocalIp = () => {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
};

const onServerStart = () => {
  const ip = getLocalIp();
  logger.info({ port: PORT, https: hasSsl, mode: process.env.NODE_ENV || 'development', ip }, 'Server started');
  startReminderService();
};

if (hasSsl) {
  const httpsOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  };
  https.createServer(httpsOptions, app).listen(PORT, BIND_ADDRESS, onServerStart);
} else {
  server.listen(PORT, BIND_ADDRESS, onServerStart);
}
