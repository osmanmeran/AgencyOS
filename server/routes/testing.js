import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, uid } from '../db.js';
import { catchAsync, sendError } from '../middleware/errors.js';
import { requireAdmin } from '../middleware/permissions.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../lib/logger.js';

const router = Router();

const TEST_USERS = {
  manager: { email: 'test.manager@travelpro.com', name: 'Test Manager', tier: 'manager', role: 'manager' },
  agent: { email: 'test.agent@travelpro.com', name: 'Test Agent', tier: 'agent', role: 'agent' },
  accounting: { email: 'test.accounting@travelpro.com', name: 'Test Accounting', tier: 'accounting', role: 'accounting' },
};

router.post('/create-test-user', authMiddleware, requireAdmin, catchAsync(async (req, res) => {

  const { tier } = req.body;
  if (!TEST_USERS[tier]) return sendError(res, 400, 'UNKNOWN_TIER', `Unknown tier: ${tier}`);

  const db = getDb();
  const config = TEST_USERS[tier];
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(config.email);

  if (existing) {
    return res.json({ message: `${tier} test user already exists`, email: config.email });
  }

  const hash = bcrypt.hashSync('password123', 10);
  const nowISO = new Date().toISOString();
  db.prepare('INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, client_id, linked_supplier_id, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
    .run(uid(), config.email, hash, config.name, config.tier, config.role, 'en', '[]', null, null, nowISO, nowISO);

  logger.info({ email: config.email, tier }, 'Test user created');
  res.json({ message: `${tier} test user created`, email: config.email, password: 'password123' });
}));

router.post('/create-test-users', authMiddleware, requireAdmin, catchAsync(async (req, res) => {

  const db = getDb();
  const hash = bcrypt.hashSync('password123', 10);
  const nowISO = new Date().toISOString();
  const results = [];

  for (const [tier, config] of Object.entries(TEST_USERS)) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(config.email);
    if (existing) {
      results.push({ tier, email: config.email, status: 'already exists' });
      continue;
    }
    db.prepare('INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, client_id, linked_supplier_id, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
      .run(uid(), config.email, hash, config.name, config.tier, config.role, 'en', '[]', null, null, nowISO, nowISO);
    results.push({ tier, email: config.email, status: 'created', password: 'password123' });
    logger.info({ email: config.email, tier }, 'Test user created');
  }

  res.json({ users: results });
}));

router.post('/cleanup-test-users', authMiddleware, requireAdmin, catchAsync(async (req, res) => {

  const db = getDb();
  const emails = Object.values(TEST_USERS).map(u => u.email);
  const placeholders = emails.map(() => '?').join(',');
  const result = db.prepare(`DELETE FROM users WHERE email IN (${placeholders})`).run(...emails);

  logger.info({ deleted: result.changes }, 'Test users cleaned up');
  res.json({ message: 'Test users removed', deleted: result.changes });
}));

router.get('/db-health', authMiddleware, requireAdmin, catchAsync(async (req, res) => {

  const db = getDb();
  const migrationCount = db.prepare('SELECT COUNT(*) as count FROM _migrations').get();
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const entityCount = db.prepare('SELECT COUNT(*) as count FROM entities').get();

  res.json({
    connected: true,
    migrations: migrationCount.count,
    users: userCount.count,
    entities: entityCount.count,
    dbPath: process.env.DB_PATH || 'data/marvelops.db',
  });
}));

export default router;
