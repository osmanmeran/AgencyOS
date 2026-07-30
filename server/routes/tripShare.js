import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { enableShare, revokeShare } from '../services/itineraryShare.js';
import { workspaceUrl } from '../middleware/tenant.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/:id/share',
  catchAsync(async (req, res) => {
    const trip = enableShare(req.params.id, req.user, { rotate: !!req.body?.rotate });
    res.json({
      share_enabled: trip.share_enabled,
      share_token: trip.share_token,
      share_url: `${workspaceUrl(req)}/share/itinerary/${trip.share_token}`,
    });
  }),
);

router.delete(
  '/:id/share',
  catchAsync(async (req, res) => {
    const trip = revokeShare(req.params.id, req.user);
    res.json({ share_enabled: trip.share_enabled, share_token: trip.share_token });
  }),
);

export default router;
