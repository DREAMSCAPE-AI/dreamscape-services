/**
 * Bookings Routes - RESTful API for booking management
 * - List user bookings with pagination, filters, and sorting
 * - Get booking details
 * - Cancel booking
 */

import { Router, Request, Response } from 'express';
import BookingService from '@/services/BookingService';
import prisma from '@/database/prisma';

type BookingStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'FAILED';
type BookingType = 'FLIGHT' | 'HOTEL' | 'ACTIVITY' | 'PACKAGE' | 'TRANSFER';
type SortOrder = 'asc' | 'desc';
type SortField = 'createdAt' | 'updatedAt' | 'totalAmount' | 'status';

const router = Router();

/**
 * GET /api/v1/bookings
 * Get user's bookings with pagination, filters, and sorting
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 50)
 * - status: BookingStatus (optional, comma-separated for multiple)
 * - type: BookingType (optional, comma-separated for multiple)
 * - sortBy: 'createdAt' | 'updatedAt' | 'totalAmount' | 'status' (default: 'createdAt')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 * - search: string (optional, searches in reference)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;

    console.log('[BookingsRoutes] GET /bookings - Query params:', req.query);
    console.log('[BookingsRoutes] GET /bookings - User ID:', userId);

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    // Parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    // Parse status filter (can be comma-separated)
    const statusParam = req.query.status as string;
    const statusFilters: BookingStatus[] | undefined = statusParam
      ? statusParam.split(',').filter(s =>
          ['DRAFT', 'PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'FAILED'].includes(s)
        ) as BookingStatus[]
      : undefined;

    // Parse type filter (can be comma-separated)
    const typeParam = req.query.type as string;
    const typeFilters: BookingType[] | undefined = typeParam
      ? typeParam.split(',').filter(t =>
          ['FLIGHT', 'HOTEL', 'ACTIVITY', 'PACKAGE', 'TRANSFER'].includes(t)
        ) as BookingType[]
      : undefined;

    // Parse sorting
    const sortBy: SortField = ['createdAt', 'updatedAt', 'totalAmount', 'status'].includes(req.query.sortBy as string)
      ? req.query.sortBy as SortField
      : 'createdAt';
    const sortOrder: SortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    // Parse search
    const search = req.query.search as string;

    // Build where clause
    const where: any = {
      userId,
      ...(statusFilters && statusFilters.length > 0 && { status: { in: statusFilters } }),
      ...(typeFilters && typeFilters.length > 0 && { type: { in: typeFilters } }),
      ...(search && { reference: { contains: search.toUpperCase() } }),
    };

    // Get total count for pagination
    const totalCount = await prisma.bookingData.count({ where });

    console.log('[BookingsRoutes] Where clause:', JSON.stringify(where));
    console.log('[BookingsRoutes] Total count:', totalCount);

    // Get bookings with pagination and sorting
    const bookings = await prisma.bookingData.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });

    console.log('[BookingsRoutes] Found bookings:', bookings.length);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Transform bookings for response
    const transformedBookings = bookings.map(booking => {
      const data = booking.data as any;
      return {
        id: booking.id,
        reference: booking.reference,
        type: booking.type,
        status: booking.status,
        totalAmount: Number(booking.totalAmount),
        currency: booking.currency,
        items: data?.items || [],
        itemCount: data?.items?.length || 0,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        confirmedAt: booking.confirmedAt,
      };
    });

    res.json({
      data: transformedBookings,
      meta: {
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        filters: {
          status: statusFilters || [],
          type: typeFilters || [],
          search: search || null,
        },
        sorting: {
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error('[BookingsRoutes] GET /bookings error:', error);
    res.status(500).json({
      error: 'Failed to get bookings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/bookings/stats
 * Get booking statistics for the user
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    // Get counts by status
    const statusCounts = await prisma.bookingData.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    });

    // Get counts by type
    const typeCounts = await prisma.bookingData.groupBy({
      by: ['type'],
      where: { userId },
      _count: { type: true },
    });

    // Get total spent (only confirmed/completed bookings)
    const totalSpent = await prisma.bookingData.aggregate({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      _sum: { totalAmount: true },
    });

    // Transform to objects
    const byStatus: Record<string, number> = {};
    statusCounts.forEach(s => {
      byStatus[s.status] = s._count.status;
    });

    const byType: Record<string, number> = {};
    typeCounts.forEach(t => {
      byType[t.type] = t._count.type;
    });

    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

    res.json({
      data: {
        total,
        byStatus,
        byType,
        totalSpent: Number(totalSpent._sum.totalAmount || 0),
        currency: 'EUR', // Default currency
      },
    });
  } catch (error) {
    console.error('[BookingsRoutes] GET /bookings/stats error:', error);
    res.status(500).json({
      error: 'Failed to get booking statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/bookings/:reference
 * Get booking details by reference
 */
router.get('/:reference', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const { reference } = req.params;

    const booking = await BookingService.getBooking(reference);

    if (!booking) {
      res.status(404).json({
        error: 'Booking not found'
      });
      return;
    }

    // Verify user owns this booking
    if (booking.userId !== userId) {
      res.status(403).json({
        error: 'Access denied'
      });
      return;
    }

    const data = booking.data as any;

    res.json({
      data: {
        id: booking.id,
        reference: booking.reference,
        type: booking.type,
        status: booking.status,
        totalAmount: Number(booking.totalAmount),
        currency: booking.currency,
        items: data?.items || [],
        metadata: data?.metadata || {},
        paymentIntentId: booking.paymentIntentId,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        confirmedAt: booking.confirmedAt,
      },
    });
  } catch (error) {
    console.error('[BookingsRoutes] GET /bookings/:reference error:', error);
    res.status(500).json({
      error: 'Failed to get booking',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/bookings/:reference/confirm
 * Confirm a booking after successful payment
 * This is a direct confirmation endpoint (alternative to Kafka flow)
 * Body: { paymentIntentId?: string }
 */
router.post('/:reference/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || req.body.userId;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const { reference } = req.params;
    const { paymentIntentId } = req.body;

    console.log(`[BookingsRoutes] POST /bookings/${reference}/confirm - User: ${userId}`);

    // Check if booking exists and belongs to user
    const existingBooking = await BookingService.getBooking(reference);

    if (!existingBooking) {
      res.status(404).json({
        error: 'Booking not found'
      });
      return;
    }

    if (existingBooking.userId !== userId) {
      res.status(403).json({
        error: 'Access denied'
      });
      return;
    }

    // Check if booking is already confirmed
    if (existingBooking.status === 'CONFIRMED') {
      res.json({
        data: {
          id: existingBooking.id,
          reference: existingBooking.reference,
          status: existingBooking.status,
          message: 'Booking is already confirmed',
        },
      });
      return;
    }

    // Check if booking can be confirmed (must be DRAFT or PENDING_PAYMENT)
    const confirmableStatuses: BookingStatus[] = ['DRAFT', 'PENDING_PAYMENT'];
    if (!confirmableStatuses.includes(existingBooking.status as BookingStatus)) {
      res.status(400).json({
        error: `Cannot confirm booking with status: ${existingBooking.status}`
      });
      return;
    }

    // Confirm the booking
    const booking = await BookingService.confirmBooking(reference, userId);

    console.log(`✅ [BookingsRoutes] Booking ${reference} confirmed successfully`);

    res.json({
      data: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        confirmedAt: booking.confirmedAt,
        message: 'Booking confirmed successfully',
      },
    });
  } catch (error) {
    console.error('[BookingsRoutes] POST /bookings/:reference/confirm error:', error);
    res.status(500).json({
      error: 'Failed to confirm booking',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/bookings/:reference/cancel
 * Cancel a booking
 * Body: { reason?: string }
 */
router.post('/:reference/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || req.body.userId;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const { reference } = req.params;
    const { reason } = req.body;

    // Check if booking exists and belongs to user
    const existingBooking = await BookingService.getBooking(reference);

    if (!existingBooking) {
      res.status(404).json({
        error: 'Booking not found'
      });
      return;
    }

    if (existingBooking.userId !== userId) {
      res.status(403).json({
        error: 'Access denied'
      });
      return;
    }

    // Check if booking can be cancelled
    const nonCancellableStatuses: BookingStatus[] = ['CANCELLED', 'COMPLETED', 'FAILED'];
    if (nonCancellableStatuses.includes(existingBooking.status as BookingStatus)) {
      res.status(400).json({
        error: `Cannot cancel booking with status: ${existingBooking.status}`
      });
      return;
    }

    const booking = await BookingService.cancelBooking(reference, userId, reason);

    res.json({
      data: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        message: 'Booking cancelled successfully',
      },
    });
  } catch (error) {
    console.error('[BookingsRoutes] POST /bookings/:reference/cancel error:', error);
    res.status(500).json({
      error: 'Failed to cancel booking',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
