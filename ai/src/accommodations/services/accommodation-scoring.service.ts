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
import {
  DiversityConfig,
  DEFAULT_DIVERSITY_CONFIG,
  DiversityMetrics,
} from '../types/diversity-config.types';
import { MLGrpcClient, getMLClient } from '../../services/MLGrpcClient';

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

  // Destination-level diversity (US-IA-011)
  diversityConfig: DiversityConfig;

  // ML integration (US-IA-013)
  useMLModel: boolean;            // default: false (rule-based only)
  mlHybridWeight: number;         // default: 0.7 (70% ML, 30% rules)

  // Filters
  minSimilarityThreshold: number; // default: 0.2 (aligned with flights)
  minQualityScore: number;        // default: 0.15 (lenient for hotels without ratings)
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
  diversityConfig: DEFAULT_DIVERSITY_CONFIG,
  useMLModel: false, // Default: rule-based only (enable via A/B test)
  mlHybridWeight: 0.7, // 70% ML + 30% rules when useMLModel=true
  minSimilarityThreshold: 0.2, // Aligned with flight scoring for consistency
  minQualityScore: 0.15, // Lowered from 0.2 to allow hotels without detailed ratings
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
    mlScore?: number; // Optional ML-based score (US-IA-009)
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
    limit: number = 20,
    userHistory?: { viewedCountries: Set<string>; viewedCities: Set<string> },
    userId?: string // Required for ML mode
  ): Promise<ScoredAccommodation[]> {
    console.log(`[Scoring] UserVector received:`, {
      length: userVector?.length,
      values: userVector,
      hasNaN: userVector?.some(v => isNaN(v)),
      segment: userSegment
    });

    // US-IA-013: ML-based scoring (if enabled)
    if (this.config.useMLModel && userId) {
      try {
        return await this.scoreWithMLHybrid(
          userId,
          userVector,
          userSegment,
          hotels,
          limit,
          userHistory
        );
      } catch (error) {
        console.warn('[Scoring] ML scoring failed, falling back to rule-based:', error);
        // Fallback to rule-based scoring below
      }
    }

    // Step 1: Calculate scores for all hotels (rule-based)
    const scoredHotels: HotelWithVector[] = [];

    for (const { features, vector } of hotels) {
      try {
        const similarity = this.calculateCosineSimilarity(userVector, vector);

        // Apply filters
        if (similarity < this.config.minSimilarityThreshold) {
          console.log(`[Scoring] Hotel ${features.hotelId} filtered by similarity: ${similarity.toFixed(3)} < ${this.config.minSimilarityThreshold}`);
          continue; // Skip poor matches
        }

        const popularity = this.calculatePopularityScore(features);
        const quality = this.calculateQualityScore(features);

        if (quality < this.config.minQualityScore) {
          console.log(`[Scoring] Hotel ${features.hotelId} filtered by quality: ${quality.toFixed(3)} < ${this.config.minQualityScore} (starRating: ${features.starRating}, hasRatings: ${!!features.ratings})`);
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

        const baseScoreWithSegment = baseScore * segmentBoost;

        // Apply novelty bonus (US-IA-011 - Encourages exploration)
        const noveltyWeight = this.config.diversityConfig.noveltyWeight;
        const noveltyBonus = this.calculateNoveltyScore(features, userHistory);
        let finalScore = Math.min(
          1.0,
          baseScoreWithSegment * (1 - noveltyWeight) + noveltyBonus * noveltyWeight
        );

        // Safety check: if finalScore is NaN, use baseScore
        if (isNaN(finalScore)) {
          console.warn(`[Scoring] NaN finalScore for hotel ${features.hotelId}, using baseScore instead`);
          finalScore = baseScore;
        }

        // Final safety: ensure score is valid
        if (isNaN(finalScore) || finalScore < 0) {
          console.warn(`[Scoring] Invalid finalScore ${finalScore} for hotel ${features.hotelId}, skipping`);
          continue;
        }

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

    console.log(`[Scoring] Scored ${scoredHotels.length} hotels out of ${hotels.length} total (${hotels.length - scoredHotels.length} filtered)`);

    // Step 2: Sort by score (descending)
    scoredHotels.sort((a, b) => b.score - a.score);

    // Step 3: Apply diversification (MMR) with larger pool if diversity is enabled
    // Give MMR more candidates so enforceDestinationDiversity has enough to work with
    const mmrLimit = this.config.diversityConfig.enableDestinationPenalty
      ? Math.min(limit * 3, scoredHotels.length) // 3x pool for diversity
      : limit;

    console.log(`[MMR] Before MMR: ${scoredHotels.length} hotels, mmrLimit: ${mmrLimit}, applyDiversification: ${this.config.applyDiversification}`);

    let diversifiedHotels = this.config.applyDiversification
      ? this.applyMMR(scoredHotels, userVector, mmrLimit)
      : scoredHotels.slice(0, mmrLimit);

    console.log(`[MMR] After MMR: ${diversifiedHotels.length} hotels`);

    // Step 3.5: Enforce destination diversity constraints (US-IA-011)
    let diversityMetrics: DiversityMetrics | undefined;
    if (this.config.diversityConfig.enableDestinationPenalty) {
      const { results, metrics } = this.enforceDestinationDiversity(diversifiedHotels);
      // Take only the requested limit after diversity enforcement
      diversifiedHotels = results.slice(0, limit);
      diversityMetrics = metrics;

      // Log diversity metrics
      console.log('[Diversity]', {
        uniqueCountries: metrics.uniqueCountries,
        uniqueCities: metrics.uniqueCities,
        maxCountOccurrences: metrics.maxCountOccurrences,
        diversityScore: metrics.diversityScore.toFixed(3),
        violations: metrics.constraintViolations,
      });

      // Warn if constraints violated
      if (metrics.constraintViolations.length > 0) {
        console.warn('[Diversity] Constraints violated:', metrics.constraintViolations);
      }
    }

    // Step 4: Convert to ScoredAccommodation with reasons
    const results: ScoredAccommodation[] = diversifiedHotels.map((hotel, index) => ({
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

  /**
   * Score accommodations with ML + rule-based hybrid (US-IA-013)
   *
   * Algorithm:
   * 1. Get ML predictions from gRPC service
   * 2. Calculate rule-based scores for same hotels
   * 3. Hybrid score = mlWeight × ML_score + (1 - mlWeight) × rule_score
   * 4. Apply diversity constraints
   * 5. Return ranked results
   *
   * @param userId - User ID for ML predictions
   * @param userVector - User preference vector (for rule-based fallback)
   * @param userSegment - User segment
   * @param hotels - Candidate hotels
   * @param limit - Top-K results
   * @param userHistory - User history for novelty scoring
   * @returns Hybrid scored recommendations
   */
  private async scoreWithMLHybrid(
    userId: string,
    userVector: number[],
    userSegment: string,
    hotels: Array<{ features: AccommodationFeatures; vector: AccommodationVector }>,
    limit: number,
    userHistory?: { viewedCountries: Set<string>; viewedCities: Set<string> }
  ): Promise<ScoredAccommodation[]> {
    console.log('[Scoring] Using ML hybrid mode');

    // Step 1: Get ML predictions
    const mlClient = getMLClient();
    const mlStartTime = Date.now();

    const mlResponse = await mlClient.getRecommendations({
      userId,
      excludeSeen: [], // TODO: Pass actual viewed/booked items
      topK: limit * 2, // Get more candidates for diversity filtering
      timeout: 300, // 300ms timeout
    });

    const mlLatency = Date.now() - mlStartTime;
    console.log(`[ML] Got ${mlResponse.items.length} predictions in ${mlLatency}ms (cache: ${mlResponse.fromCache})`);

    // Step 2: Build ML score map (item_id -> ML score)
    const mlScores = new Map<string, number>();
    mlResponse.items.forEach((item) => {
      mlScores.set(item.itemId, item.score);
    });

    // Step 3: Calculate rule-based scores for all hotels
    const scoredHotels: HotelWithVector[] = [];

    for (const { features, vector } of hotels) {
      // Rule-based score (simplified - only similarity + popularity)
      const similarity = this.calculateCosineSimilarity(userVector, vector);
      const popularity = this.calculatePopularityScore(features);
      const quality = this.calculateQualityScore(features);

      const ruleScore =
        this.config.weights.similarity * similarity +
        this.config.weights.popularity * popularity +
        this.config.weights.quality * quality;

      // Get ML score (if available)
      const mlScore = mlScores.get(features.hotelId) || 0;

      // Hybrid score: 70% ML + 30% rules (configurable)
      const mlWeight = this.config.mlHybridWeight;
      const hybridScore = mlWeight * mlScore + (1 - mlWeight) * ruleScore;

      // Apply segment boost
      const segmentBoost = this.config.applySegmentBoost
        ? this.getSegmentBoost(userSegment, features.category)
        : 1.0;

      const baseScoreWithSegment = hybridScore * segmentBoost;

      // Apply novelty bonus
      const noveltyWeight = this.config.diversityConfig.noveltyWeight;
      const noveltyBonus = this.calculateNoveltyScore(features, userHistory);
      const finalScore = Math.min(
        1.0,
        baseScoreWithSegment * (1 - noveltyWeight) + noveltyBonus * noveltyWeight
      );

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
          mlScore, // Additional field for ML score
        },
      });
    }

    // Step 4: Sort by hybrid score
    scoredHotels.sort((a, b) => b.score - a.score);

    // Step 5: Apply diversification (MMR)
    let diversifiedHotels = this.config.applyDiversification
      ? this.applyMMR(scoredHotels, userVector, limit)
      : scoredHotels.slice(0, limit);

    // Step 6: Enforce destination diversity
    if (this.config.diversityConfig.enableDestinationPenalty) {
      const { results, metrics } = this.enforceDestinationDiversity(diversifiedHotels);
      diversifiedHotels = results;

      console.log('[Diversity]', {
        uniqueCountries: metrics.uniqueCountries,
        diversityScore: metrics.diversityScore.toFixed(3),
      });
    }

    // Step 7: Convert to ScoredAccommodation
    const results: ScoredAccommodation[] = diversifiedHotels.map((hotel, index) => ({
      accommodation: hotel.hotel,
      vector: hotel.vector,
      score: hotel.score,
      confidence: this.calculateConfidence(hotel.breakdown),
      breakdown: hotel.breakdown,
      reasons: this.generateReasons(hotel, userVector, userSegment),
      rank: index + 1,
    }));

    console.log('[ML Hybrid] Returned ${results.length} recommendations');

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
      console.warn('[Scoring] Vector dimension mismatch:', vec1.length, 'vs', vec2.length);
      return 0;
    }

    // Check for NaN in vectors
    if (vec1.some(v => isNaN(v)) || vec2.some(v => isNaN(v))) {
      console.warn('[Scoring] NaN detected in vectors');
      return 0;
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
    if (norm1Sqrt === 0 || norm2Sqrt === 0 || isNaN(norm1Sqrt) || isNaN(norm2Sqrt)) {
      console.warn('[Scoring] Zero or NaN norm detected:', { norm1Sqrt, norm2Sqrt });
      return 0;
    }

    const similarity = dotProduct / (norm1Sqrt * norm2Sqrt);

    // Check for NaN result
    if (isNaN(similarity)) {
      console.warn('[Scoring] NaN similarity result');
      return 0;
    }

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
        // Normalize overall rating: assume 0-10 scale, but handle 0-5 scale gracefully
        const maxRating = hotel.ratings.overall > 5 ? 10 : 5;
        const ratingScore = Math.max(0, hotel.ratings.overall / maxRating);
        score = 0.6 * starScore + 0.4 * ratingScore;
      } else if (hotel.starRating) {
        score = (hotel.starRating - 1) / 4;
      }
    }

    // Final fallback: If no quality data at all, assign neutral score (0.5)
    // This allows hotels without ratings to pass the quality filter while being
    // ranked lower than hotels with actual quality data
    if (score === 0 && !hotel.starRating && !hotel.ratings) {
      score = 0.5;
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
   * Apply Maximum Marginal Relevance for diversification (Enhanced - US-IA-011)
   * Apply Maximum Marginal Relevance for diversification (Enhanced - US-IA-011)
   *
   * Greedy algorithm that selects hotels balancing relevance and diversity.
   * Enhanced version includes destination-level diversity penalty.
   * Enhanced version includes destination-level diversity penalty.
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
    const diversityConfig = this.config.diversityConfig;
    const selected: HotelWithVector[] = [];
    const remaining = [...hotels];

    console.log(`[MMR] Starting MMR with ${hotels.length} hotels, limit: ${limit}, lambda: ${lambda}`);

    // Track selected countries and cities for destination-level diversity
    const selectedCountries = new Set<string>();
    const selectedCities = new Set<string>();
    const countryCount = new Map<string, number>();
    const cityCount = new Map<string, number>();

    while (selected.length < limit && remaining.length > 0) {
      let bestIndex = -1;
      let bestMMRScore = -Infinity;

      console.log(`[MMR] Iteration ${selected.length + 1}: checking ${remaining.length} remaining hotels`);

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];

        // Relevance component
        const relevance = candidate.score;

        // === DIVERSITY COMPONENTS ===

        // 1. Vector diversity (original MMR)
        let maxVectorSimilarity = 0;
        if (selected.length > 0) {
          for (const selectedHotel of selected) {
            const sim = this.calculateCosineSimilarity(
              candidate.vector,
              selectedHotel.vector
            );
            maxVectorSimilarity = Math.max(maxVectorSimilarity, sim);
          }
        }

        // 2. Destination-level diversity penalty (US-IA-011)
        let destinationPenalty = 0;

        if (diversityConfig.enableDestinationPenalty) {
          const candidateCountry = candidate.hotel.location?.country || '';
          const candidateCity = candidate.hotel.location?.city || '';

          // Pénalité si pays déjà sélectionné
          if (selectedCountries.has(candidateCountry)) {
            destinationPenalty = Math.max(
              destinationPenalty,
              diversityConfig.countryPenaltyValue
            );
          }

          // Pénalité si ville déjà sélectionnée (moins forte)
          if (selectedCities.has(candidateCity)) {
            destinationPenalty = Math.max(
              destinationPenalty,
              diversityConfig.countryPenaltyValue * 0.7  // 70% de la pénalité pays
            );
          }

          // Pénalité si quota pays dépassé (hard constraint preview)
          const currentCountryCount = countryCount.get(candidateCountry) || 0;
          if (currentCountryCount >= diversityConfig.maxSameCountry) {
            destinationPenalty = 1.0;  // Maximum penalty
          }
        }

        // Combined diversity penalty (max des deux)
        const diversityPenalty = Math.max(maxVectorSimilarity, destinationPenalty);

        // Enhanced MMR score
        const mmrScore = lambda * relevance - (1 - lambda) * diversityPenalty;

        if (i === 0) {
          console.log(`[MMR] First candidate: hotelId=${candidate.hotel.hotelId}, relevance=${relevance}, diversityPenalty=${diversityPenalty}, mmrScore=${mmrScore}, bestMMRScore=${bestMMRScore}`);
        }

        if (mmrScore > bestMMRScore) {
          bestMMRScore = mmrScore;
          bestIndex = i;
        }
      }

      console.log(`[MMR] After checking all candidates: bestIndex=${bestIndex}, bestMMRScore=${bestMMRScore}`);

      if (bestIndex >= 0) {
        const selectedHotel = remaining[bestIndex];
        selected.push(selectedHotel);

        // Update tracking sets
        const country = selectedHotel.hotel.location?.country || '';
        const city = selectedHotel.hotel.location?.city || '';

        if (country) {
          selectedCountries.add(country);
          countryCount.set(country, (countryCount.get(country) || 0) + 1);
        }

        if (city) {
          selectedCities.add(city);
          cityCount.set(city, (cityCount.get(city) || 0) + 1);
        }

        remaining.splice(bestIndex, 1);
      } else {
        break;
      }
    }

    return selected;
  }

  /**
   * Calculate novelty bonus for unexplored destinations
   *
   * Encourages exploration of new countries/cities based on user history.
   * TODO US-IA-011.3: Connect to real Kafka user history events
   *
   * @param hotel - Hotel to score
   * @param userHistory - User's viewed/booked destinations (optional)
   * @returns Novelty score [0-1]
   */
  private calculateNoveltyScore(
    hotel: AccommodationFeatures,
    userHistory?: { viewedCountries: Set<string>; viewedCities: Set<string> }
  ): number {
    // If no history available, assume everything is novel (neutral)
    if (!userHistory) {
      return 0.5;
    }

    const country = hotel.location?.country || '';
    const city = hotel.location?.city || '';

    // Fully novel destination (never seen this country)
    if (country && !userHistory.viewedCountries.has(country)) {
      return 1.0;
    }

    // Novel city in known country
    if (city && !userHistory.viewedCities.has(city)) {
      return 0.5;
    }

    // Already explored
    return 0.0;
  }

  /**
   * Enforce destination diversity constraints (post-processing after MMR)
   *
   * Hard constraints:
   * - Maximum N hotels per country (default: 4)
   * - Minimum K distinct countries (default: 5)
   *
   * @param hotels - Hotels after MMR
   * @returns Filtered hotels respecting diversity constraints + metrics
   */
  private enforceDestinationDiversity(
    hotels: HotelWithVector[]
  ): { results: HotelWithVector[]; metrics: DiversityMetrics } {
    console.log(`[Diversity] Input: ${hotels.length} hotels`);

    const diversityConfig = this.config.diversityConfig;
    const countryCount = new Map<string, number>();
    const cityCount = new Map<string, number>();
    const filtered: HotelWithVector[] = [];
    const constraintViolations: string[] = [];

    // Group hotels by country
    const hotelsByCountry = new Map<string, HotelWithVector[]>();
    for (const hotel of hotels) {
      const country = hotel.hotel.location?.country || 'Unknown';
      console.log(`[Diversity] Hotel ${hotel.hotel.hotelId}: country="${country}", city="${hotel.hotel.location?.city}"`);
      if (!hotelsByCountry.has(country)) {
        hotelsByCountry.set(country, []);
      }
      hotelsByCountry.get(country)!.push(hotel);
    }

    const availableCountries = Array.from(hotelsByCountry.keys());
    const targetCountries = Math.max(diversityConfig.minCountries, availableCountries.length);

    console.log(`[Diversity] Countries found: ${availableCountries.join(', ')}, targetCountries: ${targetCountries}, minCountries: ${diversityConfig.minCountries}`);

    // Pass 1: Ensure minCountries by taking at least 1 hotel from each country
    // (up to minCountries different countries)
    const countriesUsed = new Set<string>();
    for (const country of availableCountries) {
      if (countriesUsed.size >= targetCountries) break;

      const countryHotels = hotelsByCountry.get(country)!;
      if (countryHotels.length > 0) {
        const hotel = countryHotels.shift()!; // Take best hotel from this country
        filtered.push(hotel);
        countriesUsed.add(country);
        countryCount.set(country, 1);

        const city = hotel.hotel.location?.city || 'Unknown';
        const cityKey = `${country}:${city}`;
        cityCount.set(cityKey, (cityCount.get(cityKey) || 0) + 1);
      }
    }

    console.log(`[Diversity] After Pass 1: ${filtered.length} hotels, ${countriesUsed.size} countries`);

    // Pass 2: Fill remaining slots respecting maxSameCountry
    for (const country of availableCountries) {
      const countryHotels = hotelsByCountry.get(country)!;
      const currentCount = countryCount.get(country) || 0;

      // Add more hotels from this country up to maxSameCountry
      while (countryHotels.length > 0 && (countryCount.get(country) || 0) < diversityConfig.maxSameCountry) {
        const hotel = countryHotels.shift()!;
        filtered.push(hotel);
        countryCount.set(country, (countryCount.get(country) || 0) + 1);

        const city = hotel.hotel.location?.city || 'Unknown';
        const cityKey = `${country}:${city}`;
        cityCount.set(cityKey, (cityCount.get(cityKey) || 0) + 1);
      }

      // Log violations if we had to skip hotels
      if (countryHotels.length > 0) {
        constraintViolations.push(
          `Skipped ${countryHotels.length} hotels in ${country} (quota ${diversityConfig.maxSameCountry} reached)`
        );
      }
    }

    console.log(`[Diversity] After Pass 2: ${filtered.length} hotels, ${countryCount.size} countries`);

    // Pass 3: Check if we met minCountries
    const uniqueCountries = countryCount.size;
    if (uniqueCountries < diversityConfig.minCountries) {
      constraintViolations.push(
        `Only ${uniqueCountries} countries available (minimum: ${diversityConfig.minCountries})`
      );
    }

    // Calculate diversity metrics
    const maxCountOccurrences = filtered.length > 0
      ? Math.max(...Array.from(countryCount.values()))
      : 0;
    const diversityScore = filtered.length > 0
      ? uniqueCountries / filtered.length
      : 0;

    const metrics: DiversityMetrics = {
      uniqueCountries,
      uniqueCities: cityCount.size,
      maxCountOccurrences,
      diversityScore: Math.min(1, diversityScore),
      constraintViolations,
    };

    return { results: filtered, metrics };
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
