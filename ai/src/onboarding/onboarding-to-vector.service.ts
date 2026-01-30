/**
 * Onboarding To Vector Service
 *
 * Transforms user onboarding data into enriched feature vectors,
 * combining user preferences with segment-based profiles for optimal
 * cold start recommendations.
 *
 * Extends VectorizationService with segment-aware blending.
 *
 * @module onboarding/onboarding-to-vector
 */

import VectorizationService from '../services/VectorizationService';
import { SegmentEngineService } from '../segments/segment-engine.service';
import { SegmentToVectorService, EnrichedUserVector, FeatureVector } from '../segments/segment-to-vector.service';
import { SegmentAssignment } from '../segments/types/segment.types';

interface AIUserPreferences {
  userId: string;
  isOnboardingCompleted: boolean;
  preferences: any;
  metadata: {
    completedSteps: string[];
    dataQuality: {
      completeness: number;
      confidence: number;
    };
  };
}

export class OnboardingToVectorService extends VectorizationService {
  private segmentEngine: SegmentEngineService;
  private segmentToVector: SegmentToVectorService;

  constructor() {
    super();
    this.segmentEngine = new SegmentEngineService();
    this.segmentToVector = new SegmentToVectorService();
  }

  /**
   * Transform onboarding profile to enriched user vector
   *
   * Main entry point that combines:
   * - Traditional vectorization (from parent class)
   * - Segment assignment
   * - Adaptive blending based on confidence
   *
   * @param userId - User ID
   * @param onboardingProfile - Complete onboarding data
   * @returns Enriched vector with segments and metadata
   */
  async transformToEnrichedVector(
    userId: string,
    onboardingProfile: AIUserPreferences
  ): Promise<EnrichedUserVector> {
    console.log(`[OnboardingToVector] Processing user ${userId}...`);

    // Step 1: Generate base vector from preferences (traditional method)
    const baseVector = await this.generateUserVector(userId);
    console.log(`  ✓ Base vector generated (${baseVector.length}D)`);

    // Step 2: Assign user segments
    const segments = await this.segmentEngine.assignSegment(onboardingProfile, {
      maxSegments: 3,
      minScore: 0.3,
      includeReasons: true,
    });
    console.log(`  ✓ Assigned ${segments.length} segment(s): ${segments.map(s => s.segment).join(', ')}`);

    if (segments.length === 0) {
      // No segments assigned - return base vector only
      return {
        vector: baseVector as FeatureVector,
        baseVector: baseVector as FeatureVector,
        blendingWeight: 1.0,
        confidence: 0.5,
        primarySegment: 'BUDGET_BACKPACKER' as any, // Default fallback
        source: 'preference_only',
      };
    }

    // Step 3: Generate vector from primary segment
    const primarySegment = segments[0];
    const segmentVector = this.segmentToVector.generateVectorFromSegment(primarySegment.segment);
    console.log(`  ✓ Segment vector generated for ${primarySegment.segment}`);

    // Step 4: Calculate confidence score
    const confidence = this.calculateConfidence(onboardingProfile);
    console.log(`  ✓ Confidence calculated: ${(confidence * 100).toFixed(1)}%`);

    // Step 5: Blend vectors adaptively
    const blendedVector = this.blendVectors(baseVector as FeatureVector, segmentVector, confidence);
    const preferenceWeight = this.segmentToVector['calculatePreferenceWeight'](confidence); // Access private method

    console.log(`  ✓ Vectors blended (${(preferenceWeight * 100).toFixed(0)}% preferences, ${((1 - preferenceWeight) * 100).toFixed(0)}% segment)`);

    return {
      vector: blendedVector,
      baseVector: baseVector as FeatureVector,
      segmentVector,
      blendingWeight: preferenceWeight,
      confidence,
      primarySegment: primarySegment.segment,
      source: 'blended',
    };
  }

  /**
   * Calculate confidence score based on profile completeness
   *
   * Factors:
   * - Data completeness (40%)
   * - Critical fields present (60%)
   *
   * @param profile - User onboarding profile
   * @returns Confidence score [0-1]
   */
  private calculateConfidence(profile: AIUserPreferences): number {
    const { completeness } = profile.metadata.dataQuality;
    const criticalFieldsPresent = this.checkCriticalFields(profile);

    // Base confidence from completeness
    const completenessScore = completeness / 100;

    // Critical fields multiplier
    const criticalMultiplier = criticalFieldsPresent ? 1.0 : 0.6;

    // Combined confidence
    const confidence = completenessScore * criticalMultiplier;

    // Clamp to [0.2, 0.95]
    return Math.max(0.2, Math.min(0.95, confidence));
  }

  /**
   * Check if critical fields are present and valid
   *
   * Critical fields:
   * - Budget range
   * - Travel types
   * - Group composition
   * - Activity level
   *
   * @param profile - Onboarding profile
   * @returns true if all critical fields present
   */
  private checkCriticalFields(profile: AIUserPreferences): boolean {
    const prefs = profile.preferences;

    const hasBudget = prefs.budget?.globalRange?.min != null && prefs.budget?.globalRange?.max != null;
    const hasTravelTypes = prefs.travel?.types?.length > 0;
    const hasGroupInfo = prefs.travel?.groupTypes?.length > 0;
    const hasActivityLevel = prefs.activities?.activityLevel != null;

    return hasBudget && hasTravelTypes && hasGroupInfo && hasActivityLevel;
  }

  /**
   * Blend base vector with segment vector
   *
   * Uses adaptive weighting based on confidence:
   * - High confidence (>0.7): 80% preferences, 20% segment
   * - Medium confidence (0.4-0.7): 60% preferences, 40% segment
   * - Low confidence (<0.4): 30% preferences, 70% segment
   *
   * @param baseVector - Vector from user preferences
   * @param segmentVector - Vector from segment profile
   * @param confidence - Confidence score [0-1]
   * @returns Blended feature vector
   */
  private blendVectors(
    baseVector: FeatureVector,
    segmentVector: FeatureVector,
    confidence: number
  ): FeatureVector {
    // Determine weights based on confidence
    let preferenceWeight: number;
    if (confidence >= 0.7) {
      preferenceWeight = 0.8;
    } else if (confidence >= 0.4) {
      preferenceWeight = 0.6;
    } else {
      preferenceWeight = 0.3;
    }

    const segmentWeight = 1 - preferenceWeight;

    // Blend each dimension
    const blended = baseVector.map((prefVal, idx) => {
      const segVal = segmentVector[idx];
      return preferenceWeight * prefVal + segmentWeight * segVal;
    }) as FeatureVector;

    return blended;
  }

  /**
   * Update user vector based on new interactions
   *
   * Applies incremental learning: new_vector = old_vector * (1 - α) + adjustment * α
   *
   * @param userId - User ID
   * @param interaction - User interaction data
   * @returns Updated vector
   */
  async refineVectorFromInteraction(
    userId: string,
    interaction: {
      destinationId: string;
      action: 'view' | 'click' | 'book' | 'like' | 'dislike';
      timestamp: Date;
    }
  ): Promise<FeatureVector> {
    // Fetch current user vector
    const currentVector = await this.getUserVector(userId);

    // Fetch destination vector
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const itemVector = await prisma.itemVector.findFirst({
      where: { destinationId: interaction.destinationId },
      select: { vector: true },
    });

    if (!itemVector) {
      console.warn(`[RefineVector] Destination ${interaction.destinationId} not found`);
      return currentVector as FeatureVector;
    }

    const destVector = itemVector.vector as FeatureVector;

    // Calculate adjustment based on action type
    const actionWeights: Record<typeof interaction.action, number> = {
      view: 0.05,    // Small signal
      click: 0.10,   // Medium signal
      like: 0.15,    // Strong positive signal
      book: 0.20,    // Very strong signal
      dislike: -0.10, // Negative signal
    };

    const learningRate = actionWeights[interaction.action];

    // Apply adjustment
    const adjusted = currentVector.map((val, idx) => {
      const destVal = destVector[idx];
      const adjustment = learningRate * (destVal - val);
      return val + adjustment;
    }) as FeatureVector;

    // Normalize to [0-1]
    const normalized = this.segmentToVector.normalizeVector(adjusted);

    // Save updated vector
    await this.saveUserVector(userId, 'behavior');

    console.log(`[RefineVector] User ${userId} vector refined (action: ${interaction.action}, lr: ${learningRate})`);

    return normalized;
  }

  /**
   * Regenerate vector when profile is significantly updated
   *
   * @param userId - User ID
   * @param updatedProfile - New onboarding profile
   * @returns New enriched vector
   */
  async regenerateVector(
    userId: string,
    updatedProfile: AIUserPreferences
  ): Promise<EnrichedUserVector> {
    console.log(`[OnboardingToVector] Regenerating vector for user ${userId}...`);
    return await this.transformToEnrichedVector(userId, updatedProfile);
  }
}
