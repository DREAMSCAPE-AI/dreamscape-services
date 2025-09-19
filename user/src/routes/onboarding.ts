import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getOnboardingProfile,
  createOnboardingProfile,
  updateOnboardingStep,
  getOnboardingProgress,
  completeOnboarding,
  deleteOnboardingProfile
} from '../controllers/onboardingController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/users/onboarding
 * @desc    Get user's onboarding profile
 * @access  Private
 */
router.get('/', getOnboardingProfile);

/**
 * @route   POST /api/v1/users/onboarding
 * @desc    Create new onboarding profile
 * @access  Private
 */
router.post('/', createOnboardingProfile);

/**
 * @route   PUT /api/v1/users/onboarding/step
 * @desc    Update a specific onboarding step
 * @access  Private
 * @body    { step: string, data: object, markCompleted?: boolean }
 */
router.put('/step', updateOnboardingStep);

/**
 * @route   GET /api/v1/users/onboarding/progress
 * @desc    Get onboarding progress
 * @access  Private
 */
router.get('/progress', getOnboardingProgress);

/**
 * @route   POST /api/v1/users/onboarding/complete
 * @desc    Mark onboarding as completed
 * @access  Private
 */
router.post('/complete', completeOnboarding);

/**
 * @route   DELETE /api/v1/users/onboarding
 * @desc    Delete onboarding profile (reset)
 * @access  Private
 */
router.delete('/', deleteOnboardingProfile);

export default router;