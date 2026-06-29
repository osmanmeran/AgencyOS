import bcrypt from 'bcryptjs';
import { getDb, uid } from './db.js';
import logger from './lib/logger.js';

export function seedDatabase() {
  const db = getDb();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    logger.info('Database already has users, skipping seed.');
    return;
  }

  logger.info('Creating default users...');
  const nowISO = new Date().toISOString();
  const hash = bcrypt.hashSync('password123', 10);

  const users = [
    { id: uid(), email: 'admin@travelpro.com', password: hash, name: 'Admin User', user_tier: 'admin', role: 'admin' },
  ];

  const insertUser = db.prepare('INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, client_id, linked_supplier_id, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)');
  for (const u of users) {
    insertUser.run(u.id, u.email, u.password, u.name, u.user_tier, u.role, 'en', '[]', null, null, nowISO, nowISO);
  }

  logger.info({ users: users.map(u => u.email) }, 'Default users created');
}
