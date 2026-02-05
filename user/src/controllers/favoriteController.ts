import { Response } from 'express';
import { prisma, FavoriteType } from '@dreamscape/db';
import { AuthRequest } from '../middleware/auth';

// Helper function to send error responses
const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, error: message });
};

// Validation helper for favorite data
const validateFavoriteData = (data: any): string[] => {
  const errors: string[] = [];

  if (!data.entityType) {
    errors.push('Entity type is required');
  } else if (!Object.values(FavoriteType).includes(data.entityType)) {
    errors.push(`Invalid entity type. Must be one of: ${Object.values(FavoriteType).join(', ')}`);
  }

  if (!data.entityId) {
    errors.push('Entity ID is required');
  } else if (typeof data.entityId !== 'string') {
    errors.push('Entity ID must be a string');
  }

  if (data.category && typeof data.category !== 'string') {
    errors.push('Category must be a string');
  }

  if (data.notes && typeof data.notes !== 'string') {
    errors.push('Notes must be a string');
  }

  return errors;
};

/**
 * Get all favorites for authenticated user
 * Query params: limit (default 20, max 100), offset (default 0), entityType (optional filter)
 */
export const getAllFavorites = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    // Parse and validate pagination parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const entityType = req.query.entityType as FavoriteType | undefined;

    // Validate entityType if provided
    if (entityType && !Object.values(FavoriteType).includes(entityType)) {
      return sendError(res, 400, `Invalid entity type. Must be one of: ${Object.values(FavoriteType).join(', ')}`);
    }

    // Build where clause
    const where: any = { userId };
    if (entityType) {
      where.entityType = entityType;
    }

    // Get favorites with pagination
    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        }
      }),
      prisma.favorite.count({ where })
    ]);

    res.json({
      success: true,
      data: favorites,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    sendError(res, 500, 'Failed to fetch favorites');
  }
};

/**
 * Add a new favorite for authenticated user
 * Body: { entityType, entityId, entityData?, category?, notes? }
 */
export const addFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const { entityType, entityId, entityData, category, notes } = req.body;

    // Validate input data
    const validationErrors = validateFavoriteData(req.body);
    if (validationErrors.length > 0) {
      return sendError(res, 400, validationErrors.join(', '));
    }

    // Check if favorite already exists (unique constraint)
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType,
          entityId
        }
      }
    });

    if (existingFavorite) {
      return sendError(res, 409, 'This item is already in your favorites');
    }

    // Create new favorite
    const favorite = await prisma.favorite.create({
      data: {
        userId,
        entityType,
        entityId,
        entityData: entityData || null,
        category: category || null,
        notes: notes || null
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Favorite added successfully',
      data: favorite
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return sendError(res, 409, 'This item is already in your favorites');
    }
    console.error('Error adding favorite:', error);
    sendError(res, 500, 'Failed to add favorite');
  }
};

/**
 * Get specific favorite by ID
 * Params: id (favorite ID)
 */
export const getFavoriteById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!id) {
      return sendError(res, 400, 'Favorite ID is required');
    }

    const favorite = await prisma.favorite.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    if (!favorite) {
      return sendError(res, 404, 'Favorite not found');
    }

    // Ensure user can only access their own favorites
    if (favorite.userId !== userId) {
      return sendError(res, 403, 'Access denied');
    }

    res.json({
      success: true,
      data: favorite
    });
  } catch (error) {
    console.error('Error fetching favorite:', error);
    sendError(res, 500, 'Failed to fetch favorite');
  }
};

/**
 * Update favorite by ID
 * Params: id (favorite ID)
 * Body: { category?, notes?, entityData? }
 */
export const updateFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { category, notes, entityData } = req.body;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!id) {
      return sendError(res, 400, 'Favorite ID is required');
    }

    // Check if favorite exists and belongs to user
    const existingFavorite = await prisma.favorite.findUnique({
      where: { id }
    });

    if (!existingFavorite) {
      return sendError(res, 404, 'Favorite not found');
    }

    if (existingFavorite.userId !== userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Validate update data
    if (category !== undefined && typeof category !== 'string' && category !== null) {
      return sendError(res, 400, 'Category must be a string or null');
    }

    if (notes !== undefined && typeof notes !== 'string' && notes !== null) {
      return sendError(res, 400, 'Notes must be a string or null');
    }

    // Build update data object
    const updateData: any = {};
    if (category !== undefined) updateData.category = category;
    if (notes !== undefined) updateData.notes = notes;
    if (entityData !== undefined) updateData.entityData = entityData;

    if (Object.keys(updateData).length === 0) {
      return sendError(res, 400, 'No valid fields to update');
    }

    // Update favorite
    const updatedFavorite = await prisma.favorite.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Favorite updated successfully',
      data: updatedFavorite
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Favorite not found');
    }
    console.error('Error updating favorite:', error);
    sendError(res, 500, 'Failed to update favorite');
  }
};

/**
 * Delete favorite by ID
 * Params: id (favorite ID)
 */
export const deleteFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!id) {
      return sendError(res, 400, 'Favorite ID is required');
    }

    // Check if favorite exists and belongs to user
    const existingFavorite = await prisma.favorite.findUnique({
      where: { id }
    });

    if (!existingFavorite) {
      return sendError(res, 404, 'Favorite not found');
    }

    if (existingFavorite.userId !== userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Delete favorite
    await prisma.favorite.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Favorite deleted successfully'
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Favorite not found');
    }
    console.error('Error deleting favorite:', error);
    sendError(res, 500, 'Failed to delete favorite');
  }
};

/**
 * Check if entity is favorited by authenticated user
 * Params: entityType, entityId
 */
export const checkFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { entityType, entityId } = req.params;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!entityType || !entityId) {
      return sendError(res, 400, 'Entity type and ID are required');
    }

    // Validate entityType
    if (!Object.values(FavoriteType).includes(entityType as FavoriteType)) {
      return sendError(res, 400, `Invalid entity type. Must be one of: ${Object.values(FavoriteType).join(', ')}`);
    }

    // Check if favorite exists
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType: entityType as FavoriteType,
          entityId
        }
      },
      select: {
        id: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      isFavorited: !!favorite,
      favorite: favorite || null
    });
  } catch (error) {
    console.error('Error checking favorite:', error);
    sendError(res, 500, 'Failed to check favorite status');
  }
};

/**
 * Batch check if multiple entities are favorited by authenticated user
 * Body: { items: [{ entityType, entityId }] }
 * Returns: { results: [{ entityType, entityId, isFavorited, favorite? }] }
 */
export const checkFavoritesBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { items } = req.body;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!items || !Array.isArray(items)) {
      return sendError(res, 400, 'Items array is required');
    }

    if (items.length === 0) {
      res.json({ success: true, results: [] });
      return;
    }

    if (items.length > 100) {
      return sendError(res, 400, 'Maximum 100 items allowed per batch request');
    }

    // Validate all items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.entityType || !item.entityId) {
        return sendError(res, 400, `Item at index ${i}: entityType and entityId are required`);
      }
      if (!Object.values(FavoriteType).includes(item.entityType as FavoriteType)) {
        return sendError(res, 400, `Item at index ${i}: Invalid entity type. Must be one of: ${Object.values(FavoriteType).join(', ')}`);
      }
    }

    // Build WHERE clause for batch query
    const whereConditions = items.map(item => ({
      userId,
      entityType: item.entityType as FavoriteType,
      entityId: item.entityId
    }));

    // Fetch all favorites in a single query
    const favorites = await prisma.favorite.findMany({
      where: {
        AND: [
          { userId },
          {
            OR: whereConditions.map(condition => ({
              entityType: condition.entityType,
              entityId: condition.entityId
            }))
          }
        ]
      },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        createdAt: true
      }
    });

    // Create a map for quick lookup
    const favoritesMap = new Map(
      favorites.map(fav => [
        `${fav.entityType}:${fav.entityId}`,
        fav
      ])
    );

    // Build results array
    const results = items.map(item => {
      const key = `${item.entityType}:${item.entityId}`;
      const favorite = favoritesMap.get(key);

      return {
        entityType: item.entityType,
        entityId: item.entityId,
        isFavorited: !!favorite,
        favorite: favorite || null
      };
    });

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error checking favorites batch:', error);
    sendError(res, 500, 'Failed to check favorites status');
  }
};
