import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, uid } from './db.js';
import logger from './lib/logger.js';

export function seedDatabase() {
  const db = getDb();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    logger.info('Database already has users, skipping seed.');
    return;
  }

  const email = 'admin@travelpro.com';
  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 10);
  const nowISO = new Date().toISOString();

  db.prepare('INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, client_id, linked_supplier_id, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
    .run(uid(), email, hash, 'Admin User', 'admin', 'admin', 'en', '[]', null, null, nowISO, nowISO);

  logger.warn({ email }, 'No users found — created initial admin account. Log in and change this password immediately; this message will not repeat.');
}
