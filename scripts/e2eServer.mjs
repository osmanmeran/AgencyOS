import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR || path.join(root, 'data', 'e2e');
const env = { ...process.env, NODE_ENV: 'e2e', DATA_DIR, JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-secret-not-for-production', LOG_LEVEL: 'silent' };

function waitForPort(port, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for port ${port}`));
        setTimeout(tick, 300);
      });
    };
    tick();
  });
}

// Start the backend first and wait for it, so the Vite dev server (which
// proxies /api -> :3001) never receives a request before the API is ready.
const backend = spawn('node', ['server/server.js'], { cwd: root, env, stdio: 'inherit' });
await waitForPort(3001);

const frontend = spawn('npx', ['vite', '--port', '5173', '--strictPort'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
await waitForPort(5173);

const shutdown = () => {
  try {
    backend.kill();
  } catch {}
  try {
    frontend.kill();
  } catch {}
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
