/**
 * Activity Scoring Service
 *
 * Calculates personalized scores for activity recommendations by combining:
 * - Similarity score (cosine similarity with user vector)
 * - Popularity score (ratings, reviews, bookings)
 * - Quality score (rating, features, booking reliability)
 * - Contextual score (duration match, budget fit, companion suitability)
 * - Segment boost (category matching with user segment)
 * - Diversity (MMR algorithm)
 *
 * ## 🔍 WHAT IT DOES
 * Takes vectorized activities and user preferences, produces ranked recommendations
 * with scores, breakdowns, and human-readable explanations.
 *
 * ## 💡 WHY WE NEED IT
 * Vectors alone don't make recommendations. We need to:
 * 1. Combine multiple signals (personalization + quality + context)
 * 2. Apply business logic (segment preferences)
 * 3. Ensure diversity (not all similar activities)
 * 4. Explain why activities were recommended
 *
 * ## ⚙️ HOW IT WORKS
 * - Calculate base score from similarity, popularity, quality, and context
 * - Apply segment-specific boosts
 * - Use MMR for diversification
 * - Generate human-readable explanations
 *
 * @module activities/services
 * @ticket US-IA-004.2
 */

import {
  ActivityVector,
  ActivityFeatures,
  ScoredActivity,
  ActivityCategory,
  SEGMENT_ACTIVITY_BOOST,
} from '../types/activity-vector.types';

/**
 * Scoring configuration
 */
export interface ActivityScoringConfig {
  // Component weights (must sum to ≤1.0)
  weights: {
    similarity: number;   // default: 0.5
    popularity: number;   // default: 0.25
    quality: number;      // default: 0.15
    contextual: number;   // default: 0.1
  };

  // Popularity sub-weights
  popularityWeights: {
    rating: number;       // default: 0.5
    reviewCount: number;  // default: 0.3
    isPopular: number;    // default: 0.2
  };

  // Quality sub-weights
  qualityWeights: {
    rating: number;               // default: 0.4
    instantConfirmation: number;  // default: 0.3
    freeCancellation: number;     // default: 0.2
    features: number;             // default: 0.1 (guidedTour, transportation, etc.)
  };

  // Contextual sub-weights (trip-specific factors)
  contextualWeights: {
    durationMatch: number;        // default: 0.4 (matches available time)
    budgetFit: number;            // default: 0.3 (within budget range)
    companionSuitability: number; // default: 0.3 (family, couple, solo, etc.)
  };

  // Segment boost
  applySegmentBoost: boolean; // default: true

  // MMR diversity
  diversityLambda: number;    // default: 0.7 (70% relevance, 30% diversity)
  applyDiversification: boolean; // default: true

  // Filters
  minSimilarityThreshold: number; // default: 0.25 (more lenient than accommodations)
  minQualityScore: number;        // default: 0.3
}

/**
 * Default scoring configuration
 */
export const DEFAULT_ACTIVITY_SCORING_CONFIG: ActivityScoringConfig = {
  weights: {
    similarity: 0.5,
    popularity: 0.25,
    quality: 0.15,
    contextual: 0.1,
  },
  popularityWeights: {
    rating: 0.5,
    reviewCount: 0.3,
    isPopular: 0.2,
  },
  qualityWeights: {
    rating: 0.4,
    instantConfirmation: 0.3,
    freeCancellation: 0.2,
    features: 0.1,
  },
  contextualWeights: {
    durationMatch: 0.4,
    budgetFit: 0.3,
    companionSuitability: 0.3,
  },
  applySegmentBoost: true,
  diversityLambda: 0.7,
  applyDiversification: true,
  minSimilarityThreshold: 0.25,
  minQualityScore: 0.3,
};

/**
 * Trip context for contextual scoring
 */
export interface TripContext {
  stayDuration?: number;        // Days
  travelCompanions?: string;    // "solo", "couple", "family", "friends"
  budgetPerActivity?: number;   // Max budget per activity
  timeAvailable?: number;       // Minutes available
}

/**
 * Scored activity with vector for MMR
 */
interface ActivityWithVector {
  activity: ActivityFeatures;
  vector: ActivityVector;
  score: number;
  breakdown: {
    similarityScore: number;
    popularityScore: number;
    qualityScore: number;
    contextualScore: number;
    segmentBoost: number;
    finalScore: number;
  };
}

/**
 * ActivityScoringService
 *
 * Main service for scoring and ranking activity recommendations.
 */
export class ActivityScoringService {
  private config: ActivityScoringConfig;

  constructor(config?: Partial<ActivityScoringConfig>) {
    this.config = {
      ...DEFAULT_ACTIVITY_SCORING_CONFIG,
      ...config,
    };
  }

  /**
   * Score multiple activities
   *
   * Main entry point for scoring a list of candidates.
   *
   * @param userVector - User preference vector (8D)
   * @param userSegment - User's primary segment
   * @param activities - Array of activities with features and vectors
   * @param tripContext - Optional trip context for contextual scoring
   * @param limit - Maximum results to return
   * @returns Scored and ranked recommendations
   */
  async scoreActivities(
    userVector: number[],
    userSegment: string,
    activities: Array<{ features: ActivityFeatures; vector: ActivityVector }>,
    tripContext?: TripContext,
    limit: number = 20
  ): Promise<ScoredActivity[]> {
    // Step 1: Calculate scores for all activities
    const scoredActivities: ActivityWithVector[] = [];

    for (const { features, vector } of activities) {
      try {
        const similarity = this.calculateCosineSimilarity(userVector, vector);

        // Apply filters
        if (similarity < this.config.minSimilarityThreshold) {
          continue; // Skip poor matches
        }

        const popularity = this.calculatePopularityScore(features);
        const quality = this.calculateQualityScore(features);
        const contextual = tripContext
          ? this.calculateContextualScore(features, tripContext)
          : 0.5; // Default neutral if no context

        if (quality < this.config.minQualityScore) {
          continue; // Skip low quality
        }

        // Calculate base score (weighted combination)
        const baseScore =
          this.config.weights.similarity * similarity +
          this.config.weights.popularity * popularity +
          this.config.weights.quality * quality +
          this.config.weights.contextual * contextual;

        // Apply segment boost
        const segmentBoost = this.config.applySegmentBoost
          ? this.getSegmentBoost(userSegment, features.category)
          : 1.0;

        const finalScore = Math.min(1.0, baseScore * segmentBoost);

        scoredActivities.push({
          activity: features,
          vector,
          score: finalScore,
          breakdown: {
            similarityScore: similarity,
            popularityScore: popularity,
            qualityScore: quality,
            contextualScore: contextual,
            segmentBoost,
            finalScore,
          },
        });
      } catch (error) {
        console.error(`Error scoring activity ${features.activityId}:`, error);
        continue;
      }
    }

    // Step 2: Sort by score (descending)
    scoredActivities.sort((a, b) => b.score - a.score);

    // Step 3: Apply diversification (MMR)
    const finalActivities = this.config.applyDiversification
      ? this.applyMMR(scoredActivities, userVector, limit)
      : scoredActivities.slice(0, limit);

    // Step 4: Convert to ScoredActivity with reasons
    const results: ScoredActivity[] = finalActivities.map((activity, index) => ({
      activity: activity.activity,
      vector: activity.vector,
      score: activity.score,
      confidence: this.calculateConfidence(activity.breakdown),
      breakdown: activity.breakdown,
      reasons: this.generateReasons(activity, userVector, userSegment, tripContext),
      rank: index + 1,
    }));

    return results;
  }

  // ==========================================================================
  // SCORING COMPONENTS
  // ==========================================================================

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const norm1Sqrt = Math.sqrt(norm1);
    const norm2Sqrt = Math.sqrt(norm2);

    if (norm1Sqrt === 0 || norm2Sqrt === 0) {
      return 0;
    }

    const similarity = dotProduct / (norm1Sqrt * norm2Sqrt);
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Calculate popularity score
   */
  private calculatePopularityScore(activity: ActivityFeatures): number {
    const weights = this.config.popularityWeights;
    let score = 0;

    // Rating component (0-5 scale)
    if (activity.rating > 0) {
      const normalizedRating = activity.rating / 5;
      score += weights.rating * normalizedRating;
    }

    // Review count component (logarithmic)
    if (activity.reviewCount > 0) {
      const normalizedReviews = this.logScale(activity.reviewCount, 5, 500);
      score += weights.reviewCount * normalizedReviews;
    }

    // Popular flag
    if (activity.metadata?.isPopular) {
      score += weights.isPopular;
    }

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(activity: ActivityFeatures): number {
    const weights = this.config.qualityWeights;
    let score = 0;

    // Rating component
    if (activity.rating > 0) {
      score += weights.rating * (activity.rating / 5);
    }

    // Instant confirmation
    if (activity.bookingInfo.instantConfirmation) {
      score += weights.instantConfirmation;
    }

    // Free cancellation
    if (activity.bookingInfo.freeCancellation) {
      score += weights.freeCancellation;
    }

    // Features bonus (guidedTour, transportation, etc.)
    const featureCount = Object.values(activity.features).filter(v => v === true).length;
    const featureScore = Math.min(1, featureCount / 5); // Normalize by 5 features
    score += weights.features * featureScore;

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Calculate contextual score
   *
   * NEW: This accounts for trip-specific factors like duration match and budget fit.
   */
  private calculateContextualScore(
    activity: ActivityFeatures,
    tripContext: TripContext
  ): number {
    const weights = this.config.contextualWeights;
    let score = 0;

    // Duration match
    if (tripContext.timeAvailable) {
      const durationDiff = Math.abs(activity.duration.value - tripContext.timeAvailable);
      const durationMatch = Math.max(0, 1 - durationDiff / tripContext.timeAvailable);
      score += weights.durationMatch * durationMatch;
    } else {
      score += weights.durationMatch * 0.5; // Neutral if no time constraint
    }

    // Budget fit
    if (tripContext.budgetPerActivity) {
      if (activity.price.amount === 0) {
        score += weights.budgetFit; // Free is always good
      } else if (activity.price.amount <= tripContext.budgetPerActivity) {
        const budgetRatio = activity.price.amount / tripContext.budgetPerActivity;
        score += weights.budgetFit * (1 - budgetRatio * 0.3); // Prefer mid-range
      } else {
        // Over budget - penalty
        const overBudget = activity.price.amount / tripContext.budgetPerActivity;
        score += weights.budgetFit * Math.max(0, 1 - (overBudget - 1));
      }
    } else {
      score += weights.budgetFit * 0.5; // Neutral if no budget constraint
    }

    // Companion suitability
    if (tripContext.travelCompanions) {
      const companionScore = this.getCompanionSuitabilityScore(
        activity,
        tripContext.travelCompanions
      );
      score += weights.companionSuitability * companionScore;
    } else {
      score += weights.companionSuitability * 0.5; // Neutral
    }

    return Math.min(1.0, score);
  }

  /**
   * Get companion suitability score
   */
  private getCompanionSuitabilityScore(
    activity: ActivityFeatures,
    companions: string
  ): number {
    switch (companions.toLowerCase()) {
      case 'family':
        return activity.features.childFriendly ? 1.0 : 0.5;
      case 'couple':
        return activity.groupSize.max >= 2 && activity.groupSize.max <= 10 ? 1.0 : 0.7;
      case 'solo':
        return activity.groupSize.min <= 1 ? 1.0 : 0.6;
      case 'friends':
        return activity.groupSize.max >= 4 ? 1.0 : 0.7;
      default:
        return 0.5;
    }
  }

  /**
   * Get segment-specific boost multiplier
   */
  private getSegmentBoost(userSegment: string, activityCategory: ActivityCategory): number {
    const segmentBoosts = SEGMENT_ACTIVITY_BOOST[userSegment as keyof typeof SEGMENT_ACTIVITY_BOOST];
    if (!segmentBoosts) return 1.0;
    return segmentBoosts[activityCategory] || 1.0;
  }

  // ==========================================================================
  // DIVERSITY (MMR)
  // ==========================================================================

  /**
   * Apply Maximum Marginal Relevance for diversification
   */
  private applyMMR(
    activities: ActivityWithVector[],
    userVector: number[],
    limit: number
  ): ActivityWithVector[] {
    const lambda = this.config.diversityLambda;
    const selected: ActivityWithVector[] = [];
    const remaining = [...activities];

    while (selected.length < limit && remaining.length > 0) {
      let bestIndex = -1;
      let bestMMRScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];

        // Relevance component
        const relevance = candidate.score;

        // Diversity component (max similarity to already selected)
        let maxSimilarity = 0;
        if (selected.length > 0) {
          for (const selectedActivity of selected) {
            const sim = this.calculateCosineSimilarity(
              candidate.vector,
              selectedActivity.vector
            );
            maxSimilarity = Math.max(maxSimilarity, sim);
          }
        }

        // MMR score
        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestMMRScore) {
          bestMMRScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        selected.push(remaining[bestIndex]);
        remaining.splice(bestIndex, 1);
      } else {
        break;
      }
    }

    return selected;
  }

  // ==========================================================================
  // EXPLAINABILITY
  // ==========================================================================

  /**
   * Generate human-readable reasons for recommendation
   */
  private generateReasons(
    activity: ActivityWithVector,
    userVector: number[],
    userSegment: string,
    tripContext?: TripContext
  ): string[] {
    const reasons: string[] = [];
    const { breakdown } = activity;
    const features = activity.activity;

    // High similarity
    if (breakdown.similarityScore > 0.85) {
      reasons.push('Perfect match for your preferences');
    } else if (breakdown.similarityScore > 0.7) {
      reasons.push('Great match for your interests');
    }

    // Segment match
    if (breakdown.segmentBoost > 1.2) {
      reasons.push(`Highly recommended for ${userSegment.replace(/_/g, ' ').toLowerCase()} travelers`);
    }

    // Popularity
    if (breakdown.popularityScore > 0.8) {
      reasons.push('Highly rated by travelers');
    }

    // Quality features
    if (features.bookingInfo.instantConfirmation) {
      reasons.push('Instant confirmation available');
    }
    if (features.bookingInfo.freeCancellation) {
      reasons.push('Free cancellation');
    }

    // Duration fit
    if (tripContext?.timeAvailable && Math.abs(features.duration.value - tripContext.timeAvailable) < 30) {
      reasons.push('Perfect duration for your schedule');
    }

    // Budget fit
    if (features.price.amount === 0) {
      reasons.push('Free activity!');
    } else if (tripContext?.budgetPerActivity && features.price.amount < tripContext.budgetPerActivity * 0.7) {
      reasons.push('Great value for money');
    }

    // Companion fit
    if (tripContext?.travelCompanions === 'family' && features.features.childFriendly) {
      reasons.push('Family-friendly');
    }

    // Dimension-specific reasons
    const activityVec = activity.vector;

    // Gastronomy (dim 6)
    if (userVector[6] > 0.7 && activityVec[6] > 0.7) {
      reasons.push('Excellent culinary experience');
    }

    // Activity level (dim 3)
    if (userVector[3] > 0.7 && activityVec[3] > 0.7) {
      reasons.push('High-energy adventure activity');
    } else if (userVector[3] < 0.3 && activityVec[3] < 0.3) {
      reasons.push('Relaxed and leisurely pace');
    }

    // Culture vs Nature (dim 1)
    if (userVector[1] > 0.7 && activityVec[1] > 0.7) {
      reasons.push('Rich cultural experience');
    } else if (userVector[1] < 0.3 && activityVec[1] < 0.3) {
      reasons.push('Perfect for nature lovers');
    }

    // Urban vs Rural (dim 5)
    if (userVector[5] > 0.7 && activityVec[5] > 0.9) {
      reasons.push('Located in the heart of the city');
    }

    // Features
    if (features.features.guidedTour) {
      reasons.push('Expert-guided tour');
    }
    if (features.features.mealIncluded) {
      reasons.push('Meal included');
    }
    if (features.features.transportation) {
      reasons.push('Transportation provided');
    }

    // Limit to top 5 reasons
    return reasons.slice(0, 5);
  }

  /**
   * Calculate confidence in recommendation
   */
  private calculateConfidence(breakdown: {
    similarityScore: number;
    popularityScore: number;
    qualityScore: number;
    contextualScore: number;
    segmentBoost: number;
    finalScore: number;
  }): number {
    const { similarityScore, popularityScore, qualityScore, contextualScore } = breakdown;

    const scores = [similarityScore, popularityScore, qualityScore, contextualScore];
    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Calculate variance
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // High confidence if high average and low variance
    const avgConfidence = average;
    const consistencyConfidence = 1 - stdDev;

    return (avgConfidence + consistencyConfidence) / 2;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Logarithmic scaling
   */
  private logScale(value: number, min: number, max: number): number {
    if (value < min) return 0;
    if (value > max) return 1;

    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logValue = Math.log10(value);

    return (logValue - logMin) / (logMax - logMin);
  }

  /**
   * Update scoring configuration
   */
  updateConfig(config: Partial<ActivityScoringConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ActivityScoringConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: ActivityScoringConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check component weights sum
    const weightSum =
      config.weights.similarity +
      config.weights.popularity +
      config.weights.quality +
      config.weights.contextual;

    if (Math.abs(weightSum - 1.0) > 0.01) {
      errors.push(`Component weights should sum to 1.0, got ${weightSum.toFixed(3)}`);
    }

    // Check ranges
    if (config.diversityLambda < 0 || config.diversityLambda > 1) {
      errors.push('diversityLambda must be in [0, 1]');
    }

    if (config.minSimilarityThreshold < 0 || config.minSimilarityThreshold > 1) {
      errors.push('minSimilarityThreshold must be in [0, 1]');
    }

    if (config.minQualityScore < 0 || config.minQualityScore > 1) {
      errors.push('minQualityScore must be in [0, 1]');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default ActivityScoringService;
