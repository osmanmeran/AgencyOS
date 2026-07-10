import { Router } from 'express';
import { getDb } from '../db.js';
import { sendError } from '../middleware/errors.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';

const router = Router();

router.use(authMiddleware, requireAdmin);

router.get('/list-users', (req, res) => {
  const db = getDb();
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const users = db
    .prepare(
      'SELECT id, email, name, user_tier, role, is_active, microsoft_id FROM users ORDER BY created_date LIMIT ? OFFSET ?',
    )
    .all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  res.json({ users, total, limit, offset });
});

// Emergency user fix endpoint — admin only
router.post('/fix-user', (req, res) => {
  try {
    const { email, user_tier, role } = req.body;
    if (!email) return sendError(res, 400, 'VALIDATION_ERROR', 'email required');
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (!user) return sendError(res, 404, 'USER_NOT_FOUND', `User not found: ${email}`);
    const tier = user_tier || 'admin';
    const r = role || tier;
    db.prepare('UPDATE users SET user_tier = ?, role = ?, updated_date = ? WHERE id = ?').run(
      tier,
      r,
      new Date().toISOString(),
      user.id,
    );
    const updated = db
      .prepare('SELECT id, email, name, user_tier, role, is_active FROM users WHERE id = ?')
      .get(user.id);
    res.json({ success: true, user: updated });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// Fix existing trips where created_by_name = 'Unknown' by looking up the user via created_by email
router.post('/fix-trip-agents', (req, res) => {
  try {
    const db = getDb();
    const trips = db.prepare("SELECT id, data FROM entities WHERE type = 'Trip'").all();
    let fixed = 0;
    for (const row of trips) {
      const data = JSON.parse(row.data);
      if (data.created_by_name === 'Unknown' && data.created_by) {
        const user = db.prepare('SELECT name, phone FROM users WHERE LOWER(email) = LOWER(?)').get(data.created_by);
        if (user && user.name) {
          data.created_by_name = user.name;
          if (user.phone) data.created_by_phone = user.phone;
          db.prepare('UPDATE entities SET data = ? WHERE id = ?').run(JSON.stringify(data), row.id);
          fixed++;
        }
      }
    }
    res.json({ success: true, fixed });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

export default router;
