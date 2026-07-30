import { Router } from 'express';
import { catchAsync, NotFoundError } from '../middleware/errors.js';
import { getPublicItinerary } from '../services/itineraryShare.js';

// Deliberately unauthenticated: this is the route a passenger with no
// account opens from a shared link. Read-only, rate-limited (see the
// publicShareLimiter mounted on this path in app.js), and scoped entirely by
// the opaque token — see services/itineraryShare.js for how the token
// resolves to a tenant + Trip without a session or Host-based tenant.
const router = Router();

router.get(
  '/:token',
  catchAsync(async (req, res) => {
    const result = getPublicItinerary(req.params.token);
    if (!result) throw new NotFoundError('Itinerary not found');
    res.json(result);
  }),
);

export default router;
