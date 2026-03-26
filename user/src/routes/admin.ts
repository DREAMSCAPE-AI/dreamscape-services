import { Router } from 'express';
import { authenticateToken } from '@middleware/auth';
import { requireAdmin } from '@middleware/requireAdmin';
import * as dashboardCtrl from '../controllers/adminDashboardController';
import * as userCtrl from '../controllers/adminUserController';

const router = Router();

router.use(authenticateToken, requireAdmin);

// Dashboard
router.get('/dashboard/stats', dashboardCtrl.getDashboardStats);
router.get('/dashboard/revenue-chart', dashboardCtrl.getRevenueChart);
router.get('/dashboard/bookings-by-destination', dashboardCtrl.getBookingsByDestination);
router.get('/dashboard/recent-transactions', dashboardCtrl.getRecentTransactions);

// Users CRUD
router.get('/users', userCtrl.listUsers);
router.get('/users/:id', userCtrl.getUser);
router.put('/users/:id', userCtrl.updateUser);
router.delete('/users/:id', userCtrl.deleteUser);

export default router;
