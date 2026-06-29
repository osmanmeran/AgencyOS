import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { getUnreadCount, getNotifications, markRead, markAllRead } from '../services/notifications.js';

const router = Router();

router.use(authMiddleware);

router.get('/unread', (req, res) => {
  res.json({ count: getUnreadCount(req.user.id) });
});

router.get('/', catchAsync(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const notifications = getNotifications(req.user.id, { limit, offset });
  const unread = getUnreadCount(req.user.id);
  res.json({ notifications, unread });
}));

router.patch('/:id/read', (req, res) => {
  markRead(req.params.id);
  res.json({ success: true });
});

router.post('/read-all', (req, res) => {
  markAllRead(req.user.id);
  res.json({ success: true });
});

export default router;
