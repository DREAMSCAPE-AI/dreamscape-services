/**
 * Accommodation Scoring Service
 *
 * Calculates personalized scores for accommodation recommendations by combining:
 * - Similarity score (cosine similarity with user vector)
 * - Popularity score (ratings, reviews, bookings)
 * - Quality score (star rating, detailed ratings)
 * - Segment boost (category matching with user segment)
 * - Diversity (MMR algorithm)
 *
 * ## 🔍 WHAT IT DOES
 * Takes vectorized hotels and user preferences, produces ranked recommendations
 * with scores, breakdowns, and human-readable explanations.
 *
 * ## 💡 WHY WE NEED IT
 * Vectors alone don't make recommendations. We need to:
 * 1. Combine multiple signals (personalization + quality + popularity)
 * 2. Apply business logic (segment preferences)
 * 3. Ensure diversity (not all similar hotels)
 * 4. Explain why hotels were recommended
 *
 * ## ⚙️ HOW IT WORKS
 * See detailed algorithm documentation: dreamscape-docs/ai/accommodations/scoring-algorithm.md
 *
 * @module accommodations/services
 * @ticket US-IA-003.2
 */

import {
  AccommodationVector,
  AccommodationFeatures,
  ScoredAccommodation,
  AccommodationCategory,
  SEGMENT_CATEGORY_BOOST,
} from '../types/accommodation-vector.types';

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  // Component weights (must sum to ≤1.0)
  weights: {
    similarity: number;   // default: 0.5
    popularity: number;   // default: 0.3
    quality: number;      // default: 0.2
  };

  // Popularity sub-weights
  popularityWeights: {
    rating: number;       // default: 0.5
    reviewCount: number;  // default: 0.3
    bookingCount: number; // default: 0.2
  };

  // Quality sub-weights
  qualityWeights: {
    starRating: number;   // default: 0.4
    cleanliness: number;  // default: 0.3
    service: number;      // default: 0.15
    facilities: number;   // default: 0.15
  };

  // Segment boost
  applySegmentBoost: boolean; // default: true

  // MMR diversity
  diversityLambda: number;    // default: 0.7 (70% relevance, 30% diversity)
  applyDiversification: boolean; // default: true

  // Filters
  minSimilarityThreshold: number; // default: 0.3
  minQualityScore: number;        // default: 0.4
}

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    similarity: 0.5,
    popularity: 0.3,
    quality: 0.2,
  },
  popularityWeights: {
    rating: 0.5,
    reviewCount: 0.3,
    bookingCount: 0.2,
  },
  qualityWeights: {
    starRating: 0.4,
    cleanliness: 0.3,
    service: 0.15,
    facilities: 0.15,
  },
  applySegmentBoost: true,
  diversityLambda: 0.7,
  applyDiversification: true,
  minSimilarityThreshold: 0.3,
  minQualityScore: 0.4,
};

/**
 * Scored hotel with vector for MMR
 */
interface HotelWithVector {
  hotel: AccommodationFeatures;
  vector: AccommodationVector;
  score: number;
  breakdown: {
    similarityScore: number;
    popularityScore: number;
    qualityScore: number;
    segmentBoost: number;
    finalScore: number;
  };
}

/**
 * AccommodationScoringService
 *
 * Main service for scoring and ranking accommodation recommendations.
 */
export class AccommodationScoringService {
  private config: ScoringConfig;

  constructor(config?: Partial<ScoringConfig>) {
    this.config = {
      ...DEFAULT_SCORING_CONFIG,
      ...config,
    };
  }

  /**
   * Score multiple accommodations
   *
   * Main entry point for scoring a list of candidates.
   *
   * @param userVector - User preference vector (8D)
   * @param userSegment - User's primary segment
   * @param hotels - Array of hotels with features and vectors
   * @param limit - Maximum results to return
   * @returns Scored and ranked recommendations
   */
  async scoreAccommodations(
    userVector: number[],
    userSegment: string,
    hotels: Array<{ features: AccommodationFeatures; vector: AccommodationVector }>,
    limit: number = 20
  ): Promise<ScoredAccommodation[]> {
    // Step 1: Calculate scores for all hotels
    const scoredHotels: HotelWithVector[] = [];

    for (const { features, vector } of hotels) {
      try {
        const similarity = this.calculateCosineSimilarity(userVector, vector);

        // Apply filters
        if (similarity < this.config.minSimilarityThreshold) {
          continue; // Skip poor matches
        }

        const popularity = this.calculatePopularityScore(features);
        const quality = this.calculateQualityScore(features);

        if (quality < this.config.minQualityScore) {
          continue; // Skip low quality
        }

        // Calculate base score (weighted combination)
        const baseScore =
          this.config.weights.similarity * similarity +
          this.config.weights.popularity * popularity +
          this.config.weights.quality * quality;

        // Apply segment boost
        const segmentBoost = this.config.applySegmentBoost
          ? this.getSegmentBoost(userSegment, features.category)
          : 1.0;

        const finalScore = Math.min(1.0, baseScore * segmentBoost);

        scoredHotels.push({
          hotel: features,
          vector,
          score: finalScore,
          breakdown: {
            similarityScore: similarity,
            popularityScore: popularity,
            qualityScore: quality,
            segmentBoost,
            finalScore,
          },
        });
      } catch (error) {
        console.error(`Error scoring hotel ${features.hotelId}:`, error);
        continue;
      }
    }

    // Step 2: Sort by score (descending)
    scoredHotels.sort((a, b) => b.score - a.score);

    // Step 3: Apply diversification (MMR)
    const finalHotels = this.config.applyDiversification
      ? this.applyMMR(scoredHotels, userVector, limit)
      : scoredHotels.slice(0, limit);

    // Step 4: Convert to ScoredAccommodation with reasons
    const results: ScoredAccommodation[] = finalHotels.map((hotel, index) => ({
      accommodation: hotel.hotel,
      vector: hotel.vector,
      score: hotel.score,
      confidence: this.calculateConfidence(hotel.breakdown),
      breakdown: hotel.breakdown,
      reasons: this.generateReasons(hotel, userVector, userSegment),
      rank: index + 1,
    }));

    return results;
  }

  // ==========================================================================
  // SCORING COMPONENTS
  // ==========================================================================

  /**
   * Calculate cosine similarity between two vectors
   *
   * Formula: cos(θ) = (A · B) / (||A|| * ||B||)
   *
   * @param vec1 - First vector
   * @param vec2 - Second vector
   * @returns Similarity score [0-1]
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

    // Prevent division by zero
    if (norm1Sqrt === 0 || norm2Sqrt === 0) {
      return 0;
    }

    const similarity = dotProduct / (norm1Sqrt * norm2Sqrt);

    // Clamp to [0, 1] (handle numerical errors)
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Calculate popularity score
   *
   * Combines rating, review count, and booking count (if available).
   *
   * @param hotel - Hotel features
   * @returns Popularity score [0-1]
   */
  private calculatePopularityScore(hotel: AccommodationFeatures): number {
    const weights = this.config.popularityWeights;
    let score = 0;

    // Rating component (baseline: 5.0/10)
    if (hotel.ratings?.overall) {
      const normalizedRating = Math.max(0, (hotel.ratings.overall - 5.0) / 5.0);
      score += weights.rating * normalizedRating;
    }

    // Review count component (logarithmic)
    if (hotel.ratings?.numberOfReviews) {
      const normalizedReviews = this.logScale(
        hotel.ratings.numberOfReviews,
        10,
        10000
      );
      score += weights.reviewCount * normalizedReviews;
    }

    // Booking count component (if available)
    // TODO: Integrate with BookingData aggregation
    // For now, use 0.5 as default
    score += weights.bookingCount * 0.5;

    return Math.min(1.0, score);
  }

  /**
   * Calculate quality score
   *
   * Combines star rating and detailed ratings (cleanliness, service, facilities).
   *
   * @param hotel - Hotel features
   * @returns Quality score [0-1]
   */
  private calculateQualityScore(hotel: AccommodationFeatures): number {
    const weights = this.config.qualityWeights;
    let score = 0;

    // Star rating component
    if (hotel.starRating) {
      const normalizedStars = (hotel.starRating - 1) / 4;
      score += weights.starRating * normalizedStars;
    }

    // Detailed ratings
    if (hotel.ratings) {
      if (hotel.ratings.cleanliness) {
        score += weights.cleanliness * (hotel.ratings.cleanliness / 10);
      }
      if (hotel.ratings.service) {
        score += weights.service * (hotel.ratings.service / 10);
      }
      if (hotel.ratings.facilities) {
        score += weights.facilities * (hotel.ratings.facilities / 10);
      }
    }

    // Fallback if detailed ratings missing
    if (!hotel.ratings?.cleanliness && !hotel.ratings?.service && !hotel.ratings?.facilities) {
      if (hotel.starRating && hotel.ratings?.overall) {
        const starScore = (hotel.starRating - 1) / 4;
        const ratingScore = (hotel.ratings.overall - 5) / 5;
        score = 0.6 * starScore + 0.4 * ratingScore;
      } else if (hotel.starRating) {
        score = (hotel.starRating - 1) / 4;
      }
    }

    return Math.max(0, Math.min(1.0, score));
  }

  /**
   * Get segment-specific boost multiplier
   *
   * @param userSegment - User's primary segment
   * @param hotelCategory - Hotel category
   * @returns Boost multiplier [0.3-1.4]
   */
  private getSegmentBoost(userSegment: string, hotelCategory: string): number {
    const segmentBoosts = SEGMENT_CATEGORY_BOOST[userSegment as keyof typeof SEGMENT_CATEGORY_BOOST];
    if (!segmentBoosts) return 1.0;
    return segmentBoosts[hotelCategory as AccommodationCategory] || 1.0;
  }

  // ==========================================================================
  // DIVERSITY (MMR)
  // ==========================================================================

  /**
   * Apply Maximum Marginal Relevance for diversification
   *
   * Greedy algorithm that selects hotels balancing relevance and diversity.
   *
   * @param hotels - Sorted hotels by score
   * @param userVector - User preference vector
   * @param limit - Number of results to select
   * @returns Diversified selection
   */
  private applyMMR(
    hotels: HotelWithVector[],
    userVector: number[],
    limit: number
  ): HotelWithVector[] {
    const lambda = this.config.diversityLambda;
    const selected: HotelWithVector[] = [];
    const remaining = [...hotels];

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
          for (const selectedHotel of selected) {
            const sim = this.calculateCosineSimilarity(
              candidate.vector,
              selectedHotel.vector
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
   *
   * @param hotel - Scored hotel with breakdown
   * @param userVector - User preference vector
   * @param userSegment - User's primary segment
   * @returns Array of reason strings
   */
  private generateReasons(
    hotel: HotelWithVector,
    userVector: number[],
    userSegment: string
  ): string[] {
    const reasons: string[] = [];
    const { breakdown } = hotel;

    // High similarity
    if (breakdown.similarityScore > 0.85) {
      reasons.push('Matches your preferences');
    } else if (breakdown.similarityScore > 0.7) {
      reasons.push('Good match for your interests');
    }

    // Segment match
    if (breakdown.segmentBoost > 1.2) {
      const segmentName = userSegment.replace(/_/g, ' ').toLowerCase();
      reasons.push(`Perfect for ${segmentName} travelers`);
    }

    // Popularity
    if (breakdown.popularityScore > 0.8) {
      reasons.push('Highly rated by other travelers');
    }

    // Quality
    if (breakdown.qualityScore > 0.8) {
      reasons.push('Excellent quality and service');
    }

    // Dimension-specific reasons
    const hotelVec = hotel.vector;

    // Gastronomy (dim 6)
    if (userVector[6] > 0.7 && hotelVec[6] > 0.7) {
      reasons.push('Great dining options');
    }

    // Urban location (dim 5)
    if (userVector[5] > 0.7 && hotelVec[5] > 0.9) {
      reasons.push('Located in the heart of the city');
    } else if (userVector[5] < 0.3 && hotelVec[5] < 0.3) {
      reasons.push('Peaceful countryside setting');
    }

    // Activity level (dim 3)
    if (userVector[3] > 0.6 && hotelVec[3] > 0.7) {
      reasons.push('Excellent fitness and wellness facilities');
    }

    // Climate amenities (dim 0)
    if (hotelVec[0] > 0.7) {
      reasons.push('Great pool and spa facilities');
    }

    // Budget value (dim 2)
    if (userVector[2] < 0.4 && hotelVec[2] < 0.4) {
      reasons.push('Great value for money');
    } else if (userVector[2] > 0.7 && hotelVec[2] > 0.7) {
      reasons.push('Luxury accommodation experience');
    }

    // Group size (dim 4)
    if (userVector[4] > 0.7 && hotelVec[4] > 0.7) {
      reasons.push('Perfect for families and groups');
    }

    // Culture vs Nature (dim 1)
    if (userVector[1] > 0.7 && hotelVec[1] > 0.7) {
      reasons.push('Ideal for cultural exploration');
    } else if (userVector[1] < 0.3 && hotelVec[1] < 0.3) {
      reasons.push('Perfect for nature lovers');
    }

    // Limit to top 5 reasons
    return reasons.slice(0, 5);
  }

  /**
   * Calculate confidence in recommendation
   *
   * Based on score breakdown consistency.
   *
   * @param breakdown - Score breakdown
   * @returns Confidence [0-1]
   */
  private calculateConfidence(breakdown: {
    similarityScore: number;
    popularityScore: number;
    qualityScore: number;
    segmentBoost: number;
    finalScore: number;
  }): number {
    // High confidence if all components are high
    const { similarityScore, popularityScore, qualityScore } = breakdown;

    const scores = [similarityScore, popularityScore, qualityScore];
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
   *
   * @param value - Input value
   * @param min - Minimum value (maps to 0)
   * @param max - Maximum value (maps to 1)
   * @returns Scaled value [0-1]
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
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<ScoringConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   *
   * @returns Current scoring configuration
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration
   *
   * Ensures weights sum to reasonable values.
   *
   * @param config - Configuration to validate
   * @returns Validation result
   */
  static validateConfig(config: ScoringConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check component weights sum
    const weightSum =
      config.weights.similarity +
      config.weights.popularity +
      config.weights.quality;

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

export default AccommodationScoringService;
