import { Router } from 'express';
import {
  getUserPreferencesForAI,
  getBatchUserPreferencesForAI,
  getAIIntegrationHealth
} from '@controllers/aiIntegrationController';

const router = Router();

/**
 * @route   GET /api/v1/ai/users/:userId/preferences
 * @desc    Get user preferences in AI-optimized format
 * @access  Internal (AI Service)
 * @note    This endpoint is designed for AI service consumption
 */
router.get('/users/:userId/preferences', getUserPreferencesForAI);

/**
 * @route   POST /api/v1/ai/users/preferences/batch
 * @desc    Get multiple users' preferences for batch AI processing
 * @access  Internal (AI Service)
 * @body    { userIds: string[] }
 * @note    Maximum 100 users per request
 */
router.post('/users/preferences/batch', getBatchUserPreferencesForAI);

/**
 * @route   GET /api/v1/ai/health
 * @desc    Get AI integration health and statistics
 * @access  Internal (AI Service, Monitoring)
 */
router.get('/health', getAIIntegrationHealth);

export default router;