import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { execFileSync } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const DATA_DIR = process.env.DATA_DIR || path.join(root, 'data', 'e2e');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');

export default async function globalSetup() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Apply migrations to a fresh E2E database.
  execFileSync('node', ['server/migrations/cli.js', 'up'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'e2e', DATA_DIR },
    stdio: 'inherit',
  });

  const db = new Database(DB_PATH);
  const uid = () => `e2e-${Math.random().toString(36).slice(2, 10)}`;
  const hash = bcrypt.hashSync('password123', 10);
  const now = new Date().toISOString();

  const adminEmail = 'e2e.admin@travelpro.com';
  if (!db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
    db.prepare(
      `INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, client_id, linked_supplier_id, is_active, created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(uid(), adminEmail, hash, 'E2E Admin', 'admin', 'admin', 'en', '[]', null, null, now, now);
  }

  db.close();
}
