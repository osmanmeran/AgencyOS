import { Router } from 'express';
import { getDb, uid } from '../db.js';
import { catchAsync } from '../middleware/errors.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, catchAsync(async (req, res) => {
  const db = getDb();
  const { type, title, description } = req.body;

  if (!type || !title) {
    return res.status(400).json({ error: { message: 'Type and title are required' } });
  }

  const now = new Date().toISOString();

  db.prepare(`INSERT INTO entities (id, type, data, created_by, created_date, updated_date)
    VALUES (?, 'Suggestion', ?, ?, ?, ?)`).run(
    uid(),
    JSON.stringify({
      type,
      title,
      description: description || '',
      status: 'open',
      user_email: req.user?.email,
      user_name: req.user?.name || req.user?.full_name || '',
      created_date: now,
    }),
    req.user?.id || 'anonymous',
    now,
    now,
  );

  res.status(201).json({ message: 'Suggestion submitted' });
}));

router.get('/', authMiddleware, catchAsync(async (req, res) => {
  if (req.user?.user_tier !== 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: { message: 'Admin access required' } });
  }

  const db = getDb();
  const suggestions = db.prepare(`
    SELECT id, data, created_by, created_date FROM entities
    WHERE type = 'Suggestion'
    ORDER BY created_date DESC
  `).all();

  res.json(suggestions.map(s => ({ id: s.id, ...JSON.parse(s.data), _created_by: s.created_by })));
}));

router.patch('/:id/status', authMiddleware, catchAsync(async (req, res) => {
  if (req.user?.user_tier !== 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: { message: 'Admin access required' } });
  }

  const { status } = req.body;
  if (!['open', 'under_review', 'planned', 'implemented', 'declined'].includes(status)) {
    return res.status(400).json({ error: { message: 'Invalid status' } });
  }

  const db = getDb();
  const row = db.prepare('SELECT data FROM entities WHERE id = ? AND type = ?').get(req.params.id, 'Suggestion');
  if (!row) return res.status(404).json({ error: { message: 'Suggestion not found' } });

  const data = JSON.parse(row.data);
  data.status = status;
  data.updated_date = new Date().toISOString();

  db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(data), data.updated_date, req.params.id);

  res.json({ message: 'Status updated', status });
}));

export default router;
