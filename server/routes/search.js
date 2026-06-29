import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { searchAll } from '../services/search.js';

const router = Router();

router.use(authMiddleware);

router.get('/', catchAsync(async (req, res) => {
  const q = req.query.q;
  if (!q || q.trim().length < 2) {
    return res.json([]);
  }
  const results = searchAll(q, req.user.id);
  res.json(results);
}));

export default router;
