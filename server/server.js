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
import { startReportScheduler } from './services/reportScheduler.js';
import { startBackupScheduler } from './services/backupScheduler.js';
import { startExchangeRateScheduler } from './services/exchangeRateScheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const BIND_ADDRESS = process.env.BIND_ADDRESS || '0.0.0.0';

// Node leaves the process in an unknown state after either of these — log
// and exit rather than keep serving requests against possibly-corrupted
// state. Railway's restartPolicy (ON_FAILURE, max 3 retries) brings it back.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection — exiting');
  process.exit(1);
});

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
  startReportScheduler();
  startBackupScheduler();
  startExchangeRateScheduler();
};

let server;
if (hasSsl) {
  const httpsOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  };
  server = https.createServer(httpsOptions, app);
} else {
  server = http.createServer(app);
}

const wss = createWebSocketServer(server);
server.listen(PORT, BIND_ADDRESS, onServerStart);
