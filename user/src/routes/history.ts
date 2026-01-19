import { Router } from 'express';
import { authenticateToken } from '@middleware/auth';
import {
  getUserHistory,
  addHistoryEntry,
  deleteHistoryEntry,
  clearUserHistory,
  getHistoryStats,
} from '@controllers/historyController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/users/history
 * @desc    Get user's history with pagination and filters
 * @access  Private
 * @query   page, limit, actionType, entityType, entityId
 */
router.get('/', getUserHistory);

/**
 * @route   GET /api/v1/users/history/stats
 * @desc    Get user's history statistics
 * @access  Private
 */
router.get('/stats', getHistoryStats);

/**
 * @route   POST /api/v1/users/history
 * @desc    Add a new history entry
 * @access  Private
 * @body    { actionType, entityType, entityId, metadata? }
 */
router.post('/', addHistoryEntry);

/**
 * @route   DELETE /api/v1/users/history/:id
 * @desc    Delete a specific history entry
 * @access  Private
 */
router.delete('/:id', deleteHistoryEntry);

/**
 * @route   DELETE /api/v1/users/history
 * @desc    Clear all user history (or by entityType query param)
 * @access  Private
 * @query   entityType? (optional filter)
 */
router.delete('/', clearUserHistory);

export default router;
