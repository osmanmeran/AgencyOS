import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { getRevenueOverview, getCommissionReport } from '../services/reports.js';

const router = Router();

router.use(authMiddleware);

router.get('/revenue-overview', catchAsync(async (req, res) => {
  res.json(getRevenueOverview());
}));

router.get('/commissions', catchAsync(async (req, res) => {
  res.json(getCommissionReport());
}));

export default router;
