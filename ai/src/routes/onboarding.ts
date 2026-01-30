/**
 * IA-002.3: Onboarding Integration Routes
 * Handles cold start workflow when users complete onboarding
 */

import { Router, Request, Response } from 'express';
import { OnboardingOrchestratorService } from '../onboarding/onboarding-orchestrator.service';

const router = Router();
const orchestrator = new OnboardingOrchestratorService();

/**
 * POST /api/v1/ai/onboarding/complete
 * Process onboarding completion and generate initial recommendations
 * IA-002.3
 */
router.post('/onboarding/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, onboardingData } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const result = await orchestrator.processOnboardingComplete(userId, onboardingData);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to process onboarding',
      });
      return;
    }

    res.json({
      success: true,
      fallback: result.fallback || false,
      userVector: {
        segment: result.userVector?.primarySegment,
        confidence: result.userVector?.confidence,
        source: result.userVector?.source,
      },
      recommendations: result.recommendations,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process onboarding completion',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/v1/ai/users/:userId/refine
 * Refine user profile based on interactions
 * IA-002.3
 */
router.patch('/users/:userId/refine', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { interaction } = req.body;

    if (!interaction || !interaction.type || !interaction.destinationId) {
      res.status(400).json({
        error: 'interaction.type and interaction.destinationId are required',
      });
      return;
    }

    const result = await orchestrator.refineUserProfile(userId, interaction);

    res.json({
      success: true,
      vectorUpdated: result.vectorUpdated,
      segmentsChanged: result.segmentsChanged,
      newRecommendationsGenerated: result.newRecommendationsGenerated,
    });
  } catch (error) {
    console.error('Profile refinement error:', error);
    res.status(500).json({
      error: 'Failed to refine user profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/ai/users/:userId/segment
 * Get user's assigned segment(s)
 * IA-002.1
 */
router.get('/users/:userId/segment', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const userVector = await prisma.userVector.findUnique({
      where: { userId },
      select: {
        segments: true,
        primarySegment: true,
        segmentConfidence: true,
        lastSegmentUpdate: true,
      },
    });

    if (!userVector) {
      res.status(404).json({ error: 'User vector not found' });
      return;
    }

    res.json({
      userId,
      segments: userVector.segments,
      primarySegment: userVector.primarySegment,
      confidence: userVector.segmentConfidence,
      lastUpdated: userVector.lastSegmentUpdate,
    });
  } catch (error) {
    console.error('Get segment error:', error);
    res.status(500).json({
      error: 'Failed to get user segment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/ai/users/:userId/regenerate
 * Manually trigger vector regeneration (for testing/admin)
 * IA-002.3
 */
router.post('/users/:userId/regenerate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Re-run complete workflow
    const result = await orchestrator.processOnboardingComplete(userId);

    res.json({
      success: result.success,
      regenerated: true,
      recommendations: result.recommendations.length,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Regeneration error:', error);
    res.status(500).json({
      error: 'Failed to regenerate user vector',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
