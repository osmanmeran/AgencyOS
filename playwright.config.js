import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const e2eDbDir = path.resolve(root, 'data', 'e2e');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Shared env for globalSetup + the webServer + test workers. globalSetup
  // seeds the DB at this path; the webServer boots the backend against it.
  env: {
    NODE_ENV: 'e2e',
    DATA_DIR: e2eDbDir,
    JWT_SECRET: 'e2e-test-secret-not-for-production',
    LOG_LEVEL: 'silent',
  },
  webServer: {
    command: 'node scripts/e2eServer.mjs',
    url: 'http://localhost:5173',
    timeout: 120000,
    reuseExistingServer: false,
  },
  globalSetup: './tests/e2e/globalSetup.js',
});
