import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import notificationService from '../services/NotificationService';

const router = Router();

/**
 * GET /api/v1/users/notifications
 * Get notifications for the authenticated user.
 * Query params: filter=all|unread|read, page=1, limit=20
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const filter = (req.query.filter as 'all' | 'unread' | 'read') || 'all';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await notificationService.getNotifications(userId, filter, page, limit);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[NotificationRoutes] GET / error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/v1/users/notifications/unread-count
 * Get unread notification count for the authenticated user.
 */
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);

    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('[NotificationRoutes] GET /unread-count error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
});

/**
 * PATCH /api/v1/users/notifications/mark-all-read
 * Mark all notifications as read for the authenticated user.
 */
router.patch('/mark-all-read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await notificationService.markAllAsRead(userId);

    res.json({ success: true, data: { updated: result.count } });
  } catch (error) {
    console.error('[NotificationRoutes] PATCH /mark-all-read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
});

/**
 * PATCH /api/v1/users/notifications/:id/read
 * Mark a specific notification as read.
 */
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(userId, id);

    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('[NotificationRoutes] PATCH /:id/read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

export default router;
