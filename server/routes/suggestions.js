import { Router } from 'express';
import { getDb, uid } from '../db.js';
import { catchAsync, sendError } from '../middleware/errors.js';
import { requireAdmin } from '../middleware/permissions.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, catchAsync(async (req, res) => {
  const db = getDb();
  const { type, title, description } = req.body;

  if (!type || !title) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Type and title are required');
  }

  const now = new Date().toISOString();

  db.prepare(`INSERT INTO entities (id, type, data, created_date, updated_date)
    VALUES (?, 'Suggestion', ?, ?, ?)`).run(
    uid(),
    JSON.stringify({
      type,
      title,
      description: description || '',
      status: 'open',
      user_email: req.user?.email,
      user_name: req.user?.name || req.user?.full_name || '',
      created_by: req.user?.id || 'anonymous',
      created_date: now,
    }),
    now,
    now,
  );

  res.status(201).json({ message: 'Suggestion submitted' });
}));

router.get('/', authMiddleware, requireAdmin, catchAsync(async (req, res) => {

  const db = getDb();
  const suggestions = db.prepare(`
    SELECT id, data, created_date FROM entities
    WHERE type = 'Suggestion'
    ORDER BY created_date DESC
  `).all();

  res.json(suggestions.map(s => {
    const data = JSON.parse(s.data);
    return { id: s.id, ...data, _created_by: data.created_by };
  }));
}));

router.patch('/:id/status', authMiddleware, requireAdmin, catchAsync(async (req, res) => {

  const { status } = req.body;
  if (!['open', 'under_review', 'planned', 'implemented', 'declined'].includes(status)) {
    return sendError(res, 400, 'INVALID_STATUS', 'Invalid status');
  }

  const db = getDb();
  const row = db.prepare('SELECT data FROM entities WHERE id = ? AND type = ?').get(req.params.id, 'Suggestion');
  if (!row) return sendError(res, 404, 'SUGGESTION_NOT_FOUND', 'Suggestion not found');

  const data = JSON.parse(row.data);
  data.status = status;
  data.updated_date = new Date().toISOString();

  db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(JSON.stringify(data), data.updated_date, req.params.id);

  res.json({ message: 'Status updated', status });
}));

export default router;
