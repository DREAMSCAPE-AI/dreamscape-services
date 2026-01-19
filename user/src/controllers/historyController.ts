import { Response } from 'express';
import { prisma } from '@dreamscape/db';
import { AuthRequest } from '@middleware/auth';

// Helper function to send error responses
const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({
    error: message,
  });
};

// Helper function to send success responses
const sendSuccess = (res: Response, data: any, message?: string): void => {
  res.json({
    success: true,
    ...(message && { message }),
    data,
  });
};

// Valid action types from Prisma enum
const VALID_ACTION_TYPES = [
  'CREATED',
  'VIEWED',
  'UPDATED',
  'DELETED',
  'SEARCHED',
  'FAVORITED',
  'UNFAVORITED',
] as const;

// Valid entity types
const VALID_ENTITY_TYPES = [
  'booking',
  'search',
  'favorite',
  'destination',
  'hotel',
  'activity',
  'flight',
];

/**
 * Get user history with pagination and filters
 */
export const getUserHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Filter parameters
    const actionType = req.query.actionType as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;

    // Build where clause
    const where: any = { userId };

    if (actionType && VALID_ACTION_TYPES.includes(actionType as any)) {
      where.actionType = actionType;
    }

    if (entityType && VALID_ENTITY_TYPES.includes(entityType)) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    // Fetch history with pagination
    const [history, total] = await Promise.all([
      prisma.userHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userHistory.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    sendSuccess(res, {
      items: history,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching user history:', error);
    sendError(res, 500, 'Failed to fetch user history');
  }
};

/**
 * Add a new history entry
 */
export const addHistoryEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const { actionType, entityType, entityId, metadata } = req.body;

    // Validation
    if (!actionType || !VALID_ACTION_TYPES.includes(actionType)) {
      return sendError(
        res,
        400,
        `Invalid action type. Valid values are: ${VALID_ACTION_TYPES.join(', ')}`
      );
    }

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
      return sendError(
        res,
        400,
        `Invalid entity type. Valid values are: ${VALID_ENTITY_TYPES.join(', ')}`
      );
    }

    if (!entityId || typeof entityId !== 'string') {
      return sendError(res, 400, 'Entity ID is required and must be a string');
    }

    // Optional metadata validation
    if (metadata !== undefined && typeof metadata !== 'object') {
      return sendError(res, 400, 'Metadata must be a valid JSON object');
    }

    // Create history entry
    const historyEntry = await prisma.userHistory.create({
      data: {
        userId,
        actionType,
        entityType,
        entityId,
        metadata: metadata || null,
      },
    });

    // Log analytics event
    await prisma.analytics.create({
      data: {
        service: 'user',
        event: 'history_entry_created',
        userId,
        data: {
          actionType,
          entityType,
          entityId,
        },
      },
    });

    sendSuccess(res, historyEntry, 'History entry created successfully');
  } catch (error) {
    console.error('Error creating history entry:', error);
    sendError(res, 500, 'Failed to create history entry');
  }
};

/**
 * Delete a specific history entry
 */
export const deleteHistoryEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!id) {
      return sendError(res, 400, 'History entry ID is required');
    }

    // Check if the history entry exists and belongs to the user
    const historyEntry = await prisma.userHistory.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!historyEntry) {
      return sendError(res, 404, 'History entry not found or does not belong to you');
    }

    // Delete the history entry
    await prisma.userHistory.delete({
      where: { id },
    });

    sendSuccess(res, null, 'History entry deleted successfully');
  } catch (error: any) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'History entry not found');
    }
    console.error('Error deleting history entry:', error);
    sendError(res, 500, 'Failed to delete history entry');
  }
};

/**
 * Clear all user history
 */
export const clearUserHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    // Optional: Only delete specific entity types if provided
    const entityType = req.query.entityType as string | undefined;

    const where: any = { userId };
    if (entityType && VALID_ENTITY_TYPES.includes(entityType)) {
      where.entityType = entityType;
    }

    // Delete all history entries for the user
    const result = await prisma.userHistory.deleteMany({
      where,
    });

    // Log analytics event
    await prisma.analytics.create({
      data: {
        service: 'user',
        event: 'history_cleared',
        userId,
        data: {
          deletedCount: result.count,
          entityType: entityType || 'all',
        },
      },
    });

    sendSuccess(
      res,
      { deletedCount: result.count },
      `Successfully deleted ${result.count} history entries`
    );
  } catch (error) {
    console.error('Error clearing user history:', error);
    sendError(res, 500, 'Failed to clear user history');
  }
};

/**
 * Get history statistics for the user
 */
export const getHistoryStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    // Get counts by action type
    const actionTypeCounts = await prisma.userHistory.groupBy({
      by: ['actionType'],
      where: { userId },
      _count: {
        actionType: true,
      },
    });

    // Get counts by entity type
    const entityTypeCounts = await prisma.userHistory.groupBy({
      by: ['entityType'],
      where: { userId },
      _count: {
        entityType: true,
      },
    });

    // Get total count
    const totalCount = await prisma.userHistory.count({
      where: { userId },
    });

    // Get most recent activity
    const recentActivity = await prisma.userHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      totalCount,
      byActionType: actionTypeCounts.reduce((acc, item) => {
        acc[item.actionType] = item._count.actionType;
        return acc;
      }, {} as Record<string, number>),
      byEntityType: entityTypeCounts.reduce((acc, item) => {
        acc[item.entityType] = item._count.entityType;
        return acc;
      }, {} as Record<string, number>),
      mostRecentActivity: recentActivity?.createdAt || null,
    };

    sendSuccess(res, stats);
  } catch (error) {
    console.error('Error fetching history stats:', error);
    sendError(res, 500, 'Failed to fetch history statistics');
  }
};
