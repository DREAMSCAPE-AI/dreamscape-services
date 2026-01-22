import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getAllFavorites,
  addFavorite,
  getFavoriteById,
  updateFavorite,
  deleteFavorite,
  checkFavorite
} from '../controllers/favoriteController';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/v1/users/favorites
 * Get all favorites for authenticated user
 * Query params:
 *   - limit: number (default 20, max 100)
 *   - offset: number (default 0)
 *   - entityType: FavoriteType (optional filter)
 */
router.get('/', getAllFavorites);

/**
 * POST /api/v1/users/favorites
 * Add a new favorite
 * Body: { entityType, entityId, entityData?, category?, notes? }
 */
router.post('/', addFavorite);

/**
 * GET /api/v1/users/favorites/check/:entityType/:entityId
 * Check if entity is favorited by authenticated user
 * Params: entityType, entityId
 *
 * Note: This route must be defined before the /:id route to avoid conflicts
 */
router.get('/check/:entityType/:entityId', checkFavorite);

/**
 * GET /api/v1/users/favorites/:id
 * Get specific favorite by ID
 * Params: id (favorite ID)
 */
router.get('/:id', getFavoriteById);

/**
 * PUT /api/v1/users/favorites/:id
 * Update favorite (category, notes, entityData)
 * Params: id (favorite ID)
 * Body: { category?, notes?, entityData? }
 */
router.put('/:id', updateFavorite);

/**
 * DELETE /api/v1/users/favorites/:id
 * Delete favorite
 * Params: id (favorite ID)
 */
router.delete('/:id', deleteFavorite);

export default router;
