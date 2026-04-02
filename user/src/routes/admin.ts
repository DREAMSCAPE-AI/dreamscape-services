import { Router } from 'express';
import { authenticateToken } from '@middleware/auth';
import { requireAdmin } from '@middleware/requireAdmin';
import * as dashboardCtrl from '../controllers/adminDashboardController';
import * as userCtrl from '../controllers/adminUserController';
import * as bookingCtrl from '../controllers/adminBookingController';
import * as paymentCtrl from '../controllers/adminPaymentController';

const router = Router();

router.use(authenticateToken, requireAdmin);

// Dashboard
router.get('/dashboard/stats', dashboardCtrl.getDashboardStats);
router.get('/dashboard/revenue-chart', dashboardCtrl.getRevenueChart);
router.get('/dashboard/bookings-by-destination', dashboardCtrl.getBookingsByDestination);
router.get('/dashboard/recent-transactions', dashboardCtrl.getRecentTransactions);

// Users
router.get('/users', userCtrl.listUsers);
router.get('/users/export', userCtrl.exportUsers);   // BEFORE /:id
router.get('/users/:id', userCtrl.getUser);
router.get('/users/:id/activity', userCtrl.getUserActivity);
router.put('/users/:id', userCtrl.updateUser);
router.put('/users/:id/suspend', userCtrl.suspendUser);
router.put('/users/:id/reactivate', userCtrl.reactivateUser);
router.delete('/users/:id', userCtrl.deleteUser);

// Bookings
router.get('/bookings', bookingCtrl.listBookings);
router.get('/bookings/export', bookingCtrl.exportBookings);   // BEFORE /:id
router.get('/bookings/:id', bookingCtrl.getBooking);
router.put('/bookings/:id/status', bookingCtrl.updateBookingStatus);
router.put('/bookings/:id/cancel', bookingCtrl.cancelBooking);
router.put('/bookings/:id/modify', bookingCtrl.modifyBooking);
router.post('/bookings/:id/resend-email', bookingCtrl.resendEmail);
router.put('/bookings/bulk/status', bookingCtrl.bulkUpdateBookingStatus);

// Payments
router.get('/payments', paymentCtrl.listPayments);
router.get('/payments/:id', paymentCtrl.getPayment);
router.put('/payments/:id/status', paymentCtrl.updatePaymentStatus);

export default router;
