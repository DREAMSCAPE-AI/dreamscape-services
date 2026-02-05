/**
 * Onboarding Orchestrator Service
 *
 * Orchestrates the complete cold start workflow when a user completes onboarding:
 * 1. Fetch user onboarding preferences
 * 2. Generate enriched UserVector (segment-aware)
 * 3. Save to database
 * 4. Generate initial cold start recommendations
 * 5. Publish events (Kafka)
 * 6. Log analytics
 *
 * @module onboarding/orchestrator
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { OnboardingToVectorService } from './onboarding-to-vector.service';
import { ColdStartService } from '../recommendations/cold-start.service';
import { EnrichedUserVector } from '../segments/segment-to-vector.service';

const prisma = new PrismaClient();

// Configuration
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

interface OnboardingResult {
  success: boolean;
  fallback?: boolean;
  userVector?: EnrichedUserVector;
  recommendations: any[];
  metadata: {
    processingTime?: number;
    strategy: string;
    segmentAssigned?: string;
    confidence?: number;
  };
  error?: string;
}

interface RefinementResult {
  vectorUpdated: boolean;
  segmentsChanged: boolean;
  newRecommendationsGenerated: boolean;
  updatedVector?: any;
}

export class OnboardingOrchestratorService {
  private onboardingToVector: OnboardingToVectorService;
  private coldStartService: ColdStartService;

  constructor() {
    this.onboardingToVector = new OnboardingToVectorService();
    this.coldStartService = new ColdStartService();
  }

  /**
   * Main workflow: Process onboarding completion
   *
   * Called when user completes onboarding questionnaire.
   *
   * @param userId - User ID
   * @param onboardingData - Complete onboarding profile (optional, will be fetched if not provided)
   * @returns Result with recommendations
   */
  async processOnboardingComplete(
    userId: string,
    onboardingData?: any
  ): Promise<OnboardingResult> {
    console.log('='.repeat(80));
    console.log(`[OnboardingOrchestrator] Processing onboarding for user ${userId}`);
    console.log('='.repeat(80));

    const startTime = Date.now();

    try {
      // Step 1: Fetch AI preferences (if not provided)
      let aiPreferences = onboardingData;
      if (!aiPreferences) {
        console.log('[Step 1/6] Fetching user preferences...');
        aiPreferences = await this.fetchUserPreferences(userId);
        console.log('  ✓ Preferences fetched');
      } else {
        console.log('[Step 1/6] Using provided preferences');
      }

      if (!aiPreferences || !aiPreferences.isOnboardingCompleted) {
        return {
          success: false,
          recommendations: [],
          metadata: { strategy: 'none' },
          error: 'Onboarding not completed',
        };
      }

      // Step 2: Transform to enriched UserVector
      console.log('[Step 2/6] Generating enriched user vector...');
      const enrichedVector = await this.onboardingToVector.transformToEnrichedVector(
        userId,
        aiPreferences
      );
      console.log(`  ✓ Enriched vector generated (segment: ${enrichedVector.primarySegment}, confidence: ${(enrichedVector.confidence * 100).toFixed(1)}%)`);

      // Step 3: Save UserVector to database
      console.log('[Step 3/6] Saving user vector...');
      await this.saveEnrichedVector(userId, enrichedVector);
      console.log('  ✓ User vector saved');

      // Step 4: Generate cold start recommendations
      console.log('[Step 4/6] Generating cold start recommendations...');
      const recommendations = await this.coldStartService.getHybridRecommendations(
        userId,
        enrichedVector.vector,
        {
          popularityWeight: 0.4,
          similarityWeight: 0.6,
          applySegmentBoost: true,
          limit: 30,
        }
      );
      console.log(`  ✓ Generated ${recommendations.length} recommendations`);

      // Step 5: Publish Kafka event
      console.log('[Step 5/6] Publishing event...');
      await this.publishOnboardingCompletedEvent(userId, enrichedVector, recommendations);
      console.log('  ✓ Event published');

      // Step 6: Log analytics
      console.log('[Step 6/6] Logging analytics...');
      await this.logOnboardingCompletion(userId, enrichedVector, recommendations);
      console.log('  ✓ Analytics logged');

      const processingTime = Date.now() - startTime;

      console.log('='.repeat(80));
      console.log(`[OnboardingOrchestrator] ✅ SUCCESS (${processingTime}ms)`);
      console.log('='.repeat(80));

      return {
        success: true,
        userVector: enrichedVector,
        recommendations: recommendations.slice(0, 10), // Top 10 for display
        metadata: {
          processingTime,
          strategy: enrichedVector.source,
          segmentAssigned: enrichedVector.primarySegment,
          confidence: enrichedVector.confidence,
        },
      };
    } catch (error: any) {
      console.error('='.repeat(80));
      console.error('[OnboardingOrchestrator] ❌ ERROR');
      console.error('='.repeat(80));
      console.error(error);

      // Fallback to popularity-only recommendations
      return await this.fallbackToPopularity(userId, aiPreferences);
    }
  }

  /**
   * Refine user profile based on interactions
   *
   * Called when user interacts with recommendations (view, click, book).
   *
   * @param userId - User ID
   * @param interaction - Interaction data
   * @returns Refinement result
   */
  async refineUserProfile(
    userId: string,
    interaction: {
      type: 'view' | 'click' | 'book' | 'like' | 'dislike';
      destinationId: string;
      timestamp?: Date;
    }
  ): Promise<RefinementResult> {
    console.log(`[OnboardingOrchestrator] Refining profile for user ${userId} (action: ${interaction.type})`);

    try {
      // Fetch current UserVector
      const currentVector = await prisma.userVector.findUnique({
        where: { userId },
        select: {
          id: true,
          vector: true,
          segments: true,
          usageCount: true,
          primarySegment: true,
        },
      });

      if (!currentVector) {
        console.warn(`  ⚠️  No UserVector found for user ${userId}`);
        return {
          vectorUpdated: false,
          segmentsChanged: false,
          newRecommendationsGenerated: false,
        };
      }

      // Apply refinement
      const updatedVector = await this.onboardingToVector.refineVectorFromInteraction(userId, {
        destinationId: interaction.destinationId,
        action: interaction.type,
        timestamp: interaction.timestamp || new Date(),
      });

      // Calculate vector change magnitude
      const oldVec = currentVector.vector as number[];
      const newVec = updatedVector;
      const vectorChange = this.calculateVectorDistance(oldVec, newVec);

      console.log(`  ✓ Vector updated (change: ${(vectorChange * 100).toFixed(2)}%)`);

      // Re-calculate segments if significant change
      let segmentsChanged = false;
      let updatedSegments = currentVector.segments;

      if (vectorChange > 0.2) {
        console.log('  → Significant change detected, re-calculating segments...');
        const aiPreferences = await this.fetchUserPreferences(userId);
        const newSegments = await this.onboardingToVector['segmentEngine'].assignSegment(aiPreferences);
        updatedSegments = newSegments.map(s => ({
          segment: s.segment,
          score: s.score,
          reasons: s.reasons,
          assignedAt: s.assignedAt.toISOString(),
        }));
        segmentsChanged = true;
        console.log(`    ✓ Segments updated: ${newSegments.map(s => s.segment).join(', ')}`);
      }

      // Update database
      await prisma.userVector.update({
        where: { userId },
        data: {
          vector: updatedVector,
          segments: updatedSegments,
          usageCount: currentVector.usageCount + 1,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Regenerate recommendations if needed
      let newRecommendationsGenerated = false;
      if (vectorChange > 0.15 || currentVector.usageCount % 10 === 0) {
        console.log('  → Regenerating recommendations...');
        await this.regenerateRecommendations(userId, updatedVector);
        newRecommendationsGenerated = true;
        console.log('    ✓ Recommendations regenerated');
      }

      return {
        vectorUpdated: true,
        segmentsChanged,
        newRecommendationsGenerated,
        updatedVector,
      };
    } catch (error) {
      console.error('[OnboardingOrchestrator] Refinement error:', error);
      return {
        vectorUpdated: false,
        segmentsChanged: false,
        newRecommendationsGenerated: false,
      };
    }
  }

  /**
   * Fetch user preferences from User Service
   */
  private async fetchUserPreferences(userId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${USER_SERVICE_URL}/api/v1/users/${userId}/ai-preferences`,
        {
          headers: { 'X-Internal-Service': 'ai-service' },
          timeout: 5000,
        }
      );
      return response.data.data;
    } catch (error: any) {
      console.error(`Failed to fetch preferences for user ${userId}:`, error.message);
      throw new Error('Failed to fetch user preferences');
    }
  }

  /**
   * Save enriched user vector to database
   */
  private async saveEnrichedVector(userId: string, enrichedVector: EnrichedUserVector): Promise<void> {
    await prisma.userVector.upsert({
      where: { userId },
      create: {
        userId,
        vector: enrichedVector.vector,
        segments: enrichedVector.baseVector ? [{
          segment: enrichedVector.primarySegment,
          score: enrichedVector.confidence,
          assignedAt: new Date().toISOString(),
        }] : undefined,
        primarySegment: enrichedVector.primarySegment,
        segmentConfidence: enrichedVector.confidence,
        lastSegmentUpdate: new Date(),
        version: 1,
        source: enrichedVector.source,
        usageCount: 0,
      },
      update: {
        vector: enrichedVector.vector,
        segments: enrichedVector.baseVector ? [{
          segment: enrichedVector.primarySegment,
          score: enrichedVector.confidence,
          assignedAt: new Date().toISOString(),
        }] : undefined,
        primarySegment: enrichedVector.primarySegment,
        segmentConfidence: enrichedVector.confidence,
        lastSegmentUpdate: new Date(),
        source: enrichedVector.source,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Fallback to popularity-only recommendations
   */
  private async fallbackToPopularity(userId: string, profile: any): Promise<OnboardingResult> {
    console.log('[OnboardingOrchestrator] 🔄 Falling back to popularity-only recommendations');

    try {
      const recommendations = await this.coldStartService.getRecommendationsForNewUser(
        userId,
        profile,
        { strategy: 'POPULARITY_ONLY', limit: 10 }
      );

      return {
        success: true,
        fallback: true,
        recommendations,
        metadata: { strategy: 'popularity_fallback' },
      };
    } catch (fallbackError) {
      console.error('[OnboardingOrchestrator] Fallback also failed:', fallbackError);
      return {
        success: false,
        recommendations: [],
        metadata: { strategy: 'failed' },
        error: 'All recommendation strategies failed',
      };
    }
  }

  /**
   * Publish onboarding completed event (Kafka)
   */
  private async publishOnboardingCompletedEvent(
    userId: string,
    vector: EnrichedUserVector,
    recommendations: any[]
  ): Promise<void> {
    // TODO: Integrate with Kafka service
    const event = {
      userId,
      primarySegment: vector.primarySegment,
      confidence: vector.confidence,
      recommendationCount: recommendations.length,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Kafka Event] ai.onboarding.completed:`, JSON.stringify(event));
    // await kafkaService.publish('ai.onboarding.completed', event);
  }

  /**
   * Log analytics for onboarding completion
   */
  private async logOnboardingCompletion(
    userId: string,
    vector: EnrichedUserVector,
    recommendations: any[]
  ): Promise<void> {
    // TODO: Send to analytics service
    console.log(`[Analytics] Onboarding completed: ${userId}, segment: ${vector.primarySegment}, recs: ${recommendations.length}`);
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private calculateVectorDistance(vec1: number[], vec2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum) / Math.sqrt(vec1.length); // Normalized
  }

  /**
   * Regenerate recommendations for user
   */
  private async regenerateRecommendations(userId: string, userVector: number[]): Promise<void> {
    // TODO: Use RecommendationService to regenerate
    console.log(`[Regenerate] Recommendations for user ${userId}`);
  }
}
