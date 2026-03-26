import { Router } from 'express';
import { authenticateToken } from '@middleware/auth';
import { requireAdmin } from '@middleware/requireAdmin';
import * as ctrl from '../controllers/adminDashboardController';

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/dashboard/stats', ctrl.getDashboardStats);
router.get('/dashboard/revenue-chart', ctrl.getRevenueChart);
router.get('/dashboard/bookings-by-destination', ctrl.getBookingsByDestination);
router.get('/dashboard/recent-transactions', ctrl.getRecentTransactions);

export default router;
