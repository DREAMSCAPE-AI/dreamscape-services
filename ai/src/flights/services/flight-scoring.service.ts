/**
 * Flight Scoring Service
 *
 * Calculates personalized scores for flight recommendations by combining:
 * - Similarity score (cosine similarity with user vector)
 * - Popularity score (airline rating, on-time performance, route popularity)
 * - Quality score (amenities, flexibility, on-time, comfort)
 * - Contextual score (timing preferences, trip purpose, duration fit)
 * - Segment boost (cabin class matching with user segment)
 * - Diversity (MMR algorithm)
 *
 * ## 🔍 WHAT IT DOES
 * Takes vectorized flights and user preferences, produces ranked recommendations
 * with scores, breakdowns, and human-readable explanations.
 *
 * ## 💡 WHY WE NEED IT
 * Vectors alone don't make recommendations. We need to:
 * 1. Combine multiple signals (personalization + quality + context)
 * 2. Apply business logic (segment preferences for cabin class)
 * 3. Ensure diversity (not all same airline/route)
 * 4. Explain why flights were recommended
 *
 * ## ⚙️ HOW IT WORKS
 * - Calculate base score from similarity, popularity, quality, and context
 * - Apply segment-specific cabin class boosts
 * - Use MMR for diversification
 * - Generate human-readable explanations
 *
 * @module flights/services
 * @ticket US-IA-004-bis.2
 */

import {
  FlightVector,
  FlightFeatures,
  ScoredFlight,
  FlightClass,
  FlightType,
  SEGMENT_FLIGHT_CLASS_BOOST,
} from '../types/flight-vector.types';

/**
 * Scoring configuration
 */
export interface FlightScoringConfig {
  // Component weights (must sum to ≤1.0)
  weights: {
    similarity: number;   // default: 0.45
    popularity: number;   // default: 0.25
    quality: number;      // default: 0.2
    contextual: number;   // default: 0.1
  };

  // Popularity sub-weights
  popularityWeights: {
    airlineRating: number;      // default: 0.4
    routePopularity: number;    // default: 0.3
    onTimePerformance: number;  // default: 0.2
    reviewCount: number;        // default: 0.1
  };

  // Quality sub-weights
  qualityWeights: {
    onTimePerformance: number;  // default: 0.3
    amenities: number;          // default: 0.25 (wifi, power, entertainment, meals)
    baggage: number;            // default: 0.2
    flexibility: number;        // default: 0.15 (refundable, changeable)
    comfort: number;            // default: 0.1 (seats available, cabin quality)
  };

  // Contextual sub-weights (trip-specific factors)
  contextualWeights: {
    timingPreference: number;   // default: 0.4 (departure time, red-eye, overnight)
    durationFit: number;        // default: 0.3 (direct vs connections preference)
    priceFit: number;           // default: 0.3 (budget match for trip purpose)
  };

  // Segment boost
  applySegmentBoost: boolean; // default: true

  // MMR diversity
  diversityLambda: number;    // default: 0.6 (60% relevance, 40% diversity)
  applyDiversification: boolean; // default: true

  // Filters
  minSimilarityThreshold: number; // default: 0.2 (lenient for flights)
  minQualityScore: number;        // default: 0.25
}

/**
 * Default scoring configuration
 */
export const DEFAULT_FLIGHT_SCORING_CONFIG: FlightScoringConfig = {
  weights: {
    similarity: 0.45,
    popularity: 0.25,
    quality: 0.2,
    contextual: 0.1,
  },
  popularityWeights: {
    airlineRating: 0.4,
    routePopularity: 0.3,
    onTimePerformance: 0.2,
    reviewCount: 0.1,
  },
  qualityWeights: {
    onTimePerformance: 0.3,
    amenities: 0.25,
    baggage: 0.2,
    flexibility: 0.15,
    comfort: 0.1,
  },
  contextualWeights: {
    timingPreference: 0.4,
    durationFit: 0.3,
    priceFit: 0.3,
  },
  applySegmentBoost: true,
  diversityLambda: 0.6,
  applyDiversification: true,
  minSimilarityThreshold: 0.2,
  minQualityScore: 0.25,
};

/**
 * Trip context for contextual scoring
 */
export interface TripContext {
  tripPurpose?: 'LEISURE' | 'BUSINESS' | 'FAMILY' | 'ROMANTIC';
  budgetPerPerson?: number;
  preferDirectFlights?: boolean;
  maxLayoverTime?: number;        // minutes
  preferredDepartureTime?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  avoidRedEye?: boolean;
  travelCompanions?: string;      // "solo", "couple", "family", "friends"
}

/**
 * Scored flight with vector for MMR
 */
interface FlightWithVector {
  flight: FlightFeatures;
  vector: FlightVector;
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
 * FlightScoringService
 *
 * Main service for scoring and ranking flight recommendations.
 */
export class FlightScoringService {
  private config: FlightScoringConfig;

  constructor(config?: Partial<FlightScoringConfig>) {
    this.config = {
      ...DEFAULT_FLIGHT_SCORING_CONFIG,
      ...config,
    };
  }

  /**
   * Score multiple flights
   *
   * Main entry point for scoring a list of candidates.
   *
   * @param userVector - User preference vector (8D)
   * @param userSegment - User's primary segment
   * @param flights - Array of flights with features and vectors
   * @param tripContext - Optional trip context for contextual scoring
   * @param limit - Maximum results to return
   * @returns Scored and ranked recommendations
   */
  async scoreFlights(
    userVector: number[],
    userSegment: string,
    flights: Array<{ features: FlightFeatures; vector: FlightVector }>,
    tripContext?: TripContext,
    limit: number = 20
  ): Promise<ScoredFlight[]> {
    // Step 1: Calculate scores for all flights
    const scoredFlights: FlightWithVector[] = [];

    for (const { features, vector } of flights) {
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
          ? this.getSegmentBoost(userSegment, features.flightClass)
          : 1.0;

        const finalScore = Math.min(1.0, baseScore * segmentBoost);

        scoredFlights.push({
          flight: features,
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
        console.error(`Error scoring flight ${features.flightId}:`, error);
        continue;
      }
    }

    // Step 2: Sort by score (descending)
    scoredFlights.sort((a, b) => b.score - a.score);

    // Step 3: Apply diversification (MMR)
    const finalFlights = this.config.applyDiversification
      ? this.applyMMR(scoredFlights, userVector, limit)
      : scoredFlights.slice(0, limit);

    // Step 4: Convert to ScoredFlight with reasons
    const results: ScoredFlight[] = finalFlights.map((flight, index) => ({
      flight: flight.flight,
      vector: flight.vector,
      score: flight.score,
      confidence: this.calculateConfidence(flight.breakdown),
      breakdown: flight.breakdown,
      reasons: this.generateReasons(flight, userVector, userSegment, tripContext),
      rank: index + 1,
      tags: this.generateTags(flight.flight, flight.breakdown),
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
  private calculatePopularityScore(flight: FlightFeatures): number {
    const weights = this.config.popularityWeights;
    let score = 0;

    // Airline rating component (0-5 scale)
    if (flight.popularity.airlineRating > 0) {
      const normalizedRating = flight.popularity.airlineRating / 5;
      score += weights.airlineRating * normalizedRating;
    }

    // Route popularity (0-1)
    score += weights.routePopularity * flight.popularity.routePopularity;

    // On-time performance (0-1)
    score += weights.onTimePerformance * flight.popularity.onTimePerformance;

    // Review count (logarithmic, less relevant for flights)
    if (flight.popularity.reviewCount > 0) {
      const normalizedReviews = this.logScale(flight.popularity.reviewCount, 5, 100);
      score += weights.reviewCount * normalizedReviews;
    }

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(flight: FlightFeatures): number {
    const weights = this.config.qualityWeights;
    let score = 0;

    // On-time performance
    score += weights.onTimePerformance * flight.popularity.onTimePerformance;

    // Amenities (wifi, power, entertainment, meals)
    let amenityScore = 0;
    if (flight.amenities.wifi) amenityScore += 0.3;
    if (flight.amenities.power) amenityScore += 0.3;
    if (flight.amenities.entertainment) amenityScore += 0.2;
    if (flight.amenities.meals > 0) amenityScore += 0.2;
    score += weights.amenities * amenityScore;

    // Baggage allowance
    const baggageScore = Math.min(1,
      (flight.amenities.baggage.checked.quantity * 0.6) +
      (flight.amenities.baggage.cabin.quantity * 0.4)
    );
    score += weights.baggage * baggageScore;

    // Flexibility (refundable, changeable)
    let flexScore = 0;
    if (flight.bookingInfo.refundable) flexScore += 0.6;
    if (flight.bookingInfo.changeable) flexScore += 0.4;
    score += weights.flexibility * flexScore;

    // Comfort (seats available, cabin quality via class)
    let comfortScore = Math.min(1, flight.bookingInfo.seatsAvailable / 9) * 0.5;
    if (flight.flightClass === FlightClass.FIRST_CLASS) {
      comfortScore += 0.5;
    } else if (flight.flightClass === FlightClass.BUSINESS) {
      comfortScore += 0.4;
    } else if (flight.flightClass === FlightClass.PREMIUM_ECONOMY) {
      comfortScore += 0.3;
    } else {
      comfortScore += 0.2;
    }
    score += weights.comfort * comfortScore;

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Calculate contextual score
   *
   * Accounts for trip-specific factors like timing, duration, and price fit.
   */
  private calculateContextualScore(
    flight: FlightFeatures,
    tripContext: TripContext
  ): number {
    const weights = this.config.contextualWeights;
    let score = 0;

    // Timing preference
    score += weights.timingPreference * this.getTimingScore(flight, tripContext);

    // Duration/stops fit
    score += weights.durationFit * this.getDurationFitScore(flight, tripContext);

    // Price fit
    score += weights.priceFit * this.getPriceFitScore(flight, tripContext);

    return Math.min(1.0, score);
  }

  /**
   * Get timing preference score
   */
  private getTimingScore(flight: FlightFeatures, tripContext: TripContext): number {
    let score = 0.5; // Default neutral

    // Preferred departure time
    if (tripContext.preferredDepartureTime) {
      if (flight.schedule.timeOfDay === tripContext.preferredDepartureTime) {
        score += 0.4;
      }
    } else {
      score += 0.2; // No strong preference
    }

    // Red-eye avoidance
    if (tripContext.avoidRedEye && flight.schedule.isRedEye) {
      score -= 0.3;
    } else if (!tripContext.avoidRedEye && flight.schedule.isRedEye) {
      // Some travelers prefer red-eye for business trips
      if (tripContext.tripPurpose === 'BUSINESS') {
        score += 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get duration fit score
   */
  private getDurationFitScore(flight: FlightFeatures, tripContext: TripContext): number {
    let score = 0.5; // Default

    // Direct flight preference
    if (tripContext.preferDirectFlights) {
      if (flight.flightType === FlightType.DIRECT) {
        score = 1.0;
      } else if (flight.flightType === FlightType.ONE_STOP) {
        score = 0.5;
      } else {
        score = 0.2;
      }
    } else {
      // Efficient connections are acceptable
      if (flight.flightType === FlightType.DIRECT) {
        score = 0.9;
      } else if (flight.flightType === FlightType.ONE_STOP) {
        score = 0.7;
      } else {
        score = 0.5;
      }
    }

    // Layover time check
    if (tripContext.maxLayoverTime && flight.duration.layover > 0) {
      if (flight.duration.layover <= tripContext.maxLayoverTime) {
        score += 0.1; // Bonus for acceptable layover
      } else {
        score -= 0.3; // Penalty for too long layover
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get price fit score
   */
  private getPriceFitScore(flight: FlightFeatures, tripContext: TripContext): number {
    if (!tripContext.budgetPerPerson) {
      return 0.5; // Neutral if no budget specified
    }

    const price = flight.price.amount;
    const budget = tripContext.budgetPerPerson;

    if (price <= budget) {
      // Within budget - prefer mid to high range (quality indicator)
      const ratio = price / budget;
      if (ratio >= 0.7 && ratio <= 1.0) {
        return 1.0; // Sweet spot
      } else if (ratio >= 0.5) {
        return 0.9;
      } else if (ratio >= 0.3) {
        return 0.8;
      } else {
        return 0.7; // Very cheap might indicate low quality
      }
    } else {
      // Over budget - penalty increases with overage
      const overage = price / budget;
      if (overage <= 1.2) {
        return 0.6; // Slightly over is acceptable
      } else if (overage <= 1.5) {
        return 0.4;
      } else {
        return 0.2; // Significantly over budget
      }
    }
  }

  /**
   * Get segment-specific boost multiplier
   */
  private getSegmentBoost(userSegment: string, flightClass: FlightClass): number {
    const segmentBoosts = SEGMENT_FLIGHT_CLASS_BOOST[userSegment as keyof typeof SEGMENT_FLIGHT_CLASS_BOOST];
    if (!segmentBoosts) return 1.0;
    return segmentBoosts[flightClass] || 1.0;
  }

  // ==========================================================================
  // DIVERSITY (MMR)
  // ==========================================================================

  /**
   * Apply Maximum Marginal Relevance for diversification
   */
  private applyMMR(
    flights: FlightWithVector[],
    userVector: number[],
    limit: number
  ): FlightWithVector[] {
    const lambda = this.config.diversityLambda;
    const selected: FlightWithVector[] = [];
    const remaining = [...flights];

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
          for (const selectedFlight of selected) {
            const sim = this.calculateCosineSimilarity(
              candidate.vector,
              selectedFlight.vector
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
    flight: FlightWithVector,
    userVector: number[],
    userSegment: string,
    tripContext?: TripContext
  ): string[] {
    const reasons: string[] = [];
    const { breakdown } = flight;
    const features = flight.flight;

    // High similarity
    if (breakdown.similarityScore > 0.85) {
      reasons.push('Perfect match for your travel style');
    } else if (breakdown.similarityScore > 0.7) {
      reasons.push('Great match for your preferences');
    }

    // Segment match
    if (breakdown.segmentBoost > 1.2) {
      const cabinClass = features.flightClass.replace(/_/g, ' ').toLowerCase();
      reasons.push(`${cabinClass} class recommended for your travel profile`);
    }

    // Airline quality
    if (features.popularity.airlineRating >= 4.5) {
      reasons.push(`Excellent airline (${features.airline.name})`);
    } else if (features.popularity.airlineRating >= 4.0) {
      reasons.push(`Highly-rated airline`);
    }

    // On-time performance
    if (features.popularity.onTimePerformance >= 0.85) {
      reasons.push('Excellent on-time performance');
    }

    // Direct flight
    if (features.flightType === FlightType.DIRECT) {
      reasons.push('Non-stop flight');
    } else if (features.flightType === FlightType.ONE_STOP && features.duration.layover < 120) {
      reasons.push('Short layover connection');
    }

    // Amenities
    const amenities: string[] = [];
    if (features.amenities.wifi) amenities.push('Wi-Fi');
    if (features.amenities.power) amenities.push('power outlets');
    if (features.amenities.entertainment) amenities.push('entertainment');
    if (amenities.length > 0) {
      reasons.push(`Includes ${amenities.join(', ')}`);
    }

    // Meals
    if (features.amenities.meals > 1) {
      reasons.push('Multiple meals included');
    } else if (features.amenities.meals === 1) {
      reasons.push('Meal included');
    }

    // Flexibility
    if (features.bookingInfo.refundable && features.bookingInfo.changeable) {
      reasons.push('Fully flexible booking');
    } else if (features.bookingInfo.refundable) {
      reasons.push('Refundable ticket');
    } else if (features.bookingInfo.changeable) {
      reasons.push('Changeable booking');
    }

    // Baggage
    if (features.amenities.baggage.checked.quantity >= 2) {
      reasons.push('Generous baggage allowance');
    }

    // Timing
    if (tripContext?.preferredDepartureTime && features.schedule.timeOfDay === tripContext.preferredDepartureTime) {
      reasons.push('Departs at your preferred time');
    }

    // Price value
    if (tripContext?.budgetPerPerson) {
      const ratio = features.price.amount / tripContext.budgetPerPerson;
      if (ratio <= 0.7) {
        reasons.push('Great value for money');
      } else if (ratio <= 1.0) {
        reasons.push('Well-priced for quality');
      }
    }

    // Alliance benefits
    if (features.airline.alliance && features.airline.alliance !== 'NONE') {
      reasons.push(`${features.airline.alliance.replace(/_/g, ' ')} member`);
    }

    // Instant ticketing
    if (features.bookingInfo.instantTicketing) {
      reasons.push('Instant confirmation');
    }

    // Dimension-specific reasons
    const flightVec = flight.vector;

    // Activity level (dim 3) - travel style
    if (userVector[3] < 0.3 && features.flightType === FlightType.DIRECT) {
      reasons.push('Direct flight for relaxed travel');
    } else if (userVector[3] > 0.7 && features.numberOfStops > 0) {
      reasons.push('Adventurous routing option');
    }

    // Budget dimension (dim 2)
    if (userVector[2] > 0.7 && (features.flightClass === FlightClass.BUSINESS || features.flightClass === FlightClass.FIRST_CLASS)) {
      reasons.push('Premium cabin experience');
    }

    // Limit to top 6 reasons
    return reasons.slice(0, 6);
  }

  /**
   * Generate tags for flight
   */
  private generateTags(flight: FlightFeatures, breakdown: any): string[] {
    const tags: string[] = [];

    // Existing tags from metadata
    if (flight.metadata?.tags) {
      tags.push(...flight.metadata.tags);
    }

    // Add score-based tags
    if (breakdown.finalScore > 0.85) {
      tags.push('best-match');
    }

    if (flight.flightType === FlightType.DIRECT) {
      tags.push('non-stop');
    }

    if (flight.duration.total < 180) {
      tags.push('short-haul');
    } else if (flight.duration.total > 600) {
      tags.push('long-haul');
    }

    if (flight.flightClass === FlightClass.BUSINESS || flight.flightClass === FlightClass.FIRST_CLASS) {
      tags.push('premium');
    }

    if (flight.popularity.airlineRating >= 4.5) {
      tags.push('top-rated-airline');
    }

    if (flight.amenities.wifi && flight.amenities.power && flight.amenities.entertainment) {
      tags.push('fully-equipped');
    }

    return [...new Set(tags)]; // Remove duplicates
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
  updateConfig(config: Partial<FlightScoringConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): FlightScoringConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: FlightScoringConfig): { valid: boolean; errors: string[] } {
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

export default FlightScoringService;
