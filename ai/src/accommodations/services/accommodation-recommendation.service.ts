/**
 * Accommodation Recommendation Service
 *
 * Main orchestration service that combines:
 * - Hotel search (Amadeus API)
 * - Vectorization (AccommodationVectorizerService)
 * - Scoring (AccommodationScoringService)
 * - Caching (Redis)
 *
 * ## 🔍 WHAT IT DOES
 * Provides end-to-end accommodation recommendations for users, from search
 * to personalized scoring to final ranked results with explanations.
 *
 * ## 💡 WHY WE NEED IT
 * This service orchestrates the complete recommendation pipeline:
 * 1. Fetches user preferences (UserVector + segment)
 * 2. Searches hotels via Amadeus
 * 3. Vectorizes each hotel
 * 4. Scores and ranks hotels
 * 5. Returns top N with reasons
 *
 * ## ⚙️ HOW IT WORKS
 * - Integrates IA-003.1 (vectorization) and IA-003.2 (scoring)
 * - Caches results in Redis for performance
 * - Handles errors gracefully with fallbacks
 * - Monitors performance and logs metrics
 *
 * @module accommodations/services
 * @ticket US-IA-003.3
 */

import { prisma } from '@dreamscape/db';
import axios from 'axios';
import { AccommodationVectorizerService } from './accommodation-vectorizer.service';
import { AccommodationScoringService } from './accommodation-scoring.service';
import {
  RecommendationOptions,
  RecommendationResponse,
  AccommodationFeatures,
  AccommodationCacheKey,
} from '../types/accommodation-vector.types';

// Configuration
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const AMADEUS_SERVICE_URL = process.env.AMADEUS_SERVICE_URL || 'http://localhost:3002';
const REDIS_CLIENT = null; // TODO: Initialize Redis client

/**
 * Performance metrics tracker
 */
interface PerformanceMetrics {
  totalTime: number;
  userVectorFetchTime: number;
  amadeusSearchTime: number;
  vectorizationTime: number;
  scoringTime: number;
  cacheHit: boolean;
}

/**
 * AccommodationRecommendationService
 *
 * Main orchestrator for accommodation recommendations.
 */
export class AccommodationRecommendationService {
  private vectorizer: AccommodationVectorizerService;
  private scorer: AccommodationScoringService;
  private cache: any; // Redis client

  constructor() {
    this.vectorizer = new AccommodationVectorizerService();
    this.scorer = new AccommodationScoringService();
    this.cache = REDIS_CLIENT;
  }

  /**
   * Get personalized accommodation recommendations
   *
   * Main entry point for the API.
   *
   * @param options - Recommendation request options
   * @returns Recommendations with scores and reasons
   */
  async getRecommendations(options: RecommendationOptions): Promise<RecommendationResponse> {
    const startTime = Date.now();
    const metrics: PerformanceMetrics = {
      totalTime: 0,
      userVectorFetchTime: 0,
      amadeusSearchTime: 0,
      vectorizationTime: 0,
      scoringTime: 0,
      cacheHit: false,
    };

    try {
      // Step 1: Check cache
      const cacheKey = AccommodationCacheKey.forRecommendations(
        options.userId,
        options.searchParams.cityCode,
        options.searchParams.checkInDate
      );

      if (this.cache) {
        const cached = await this.getCachedRecommendations(cacheKey);
        if (cached) {
          metrics.cacheHit = true;
          metrics.totalTime = Date.now() - startTime;

          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              processingTime: metrics.totalTime,
              cacheHit: true,
            },
          };
        }
      }

      // Step 2: Fetch user vector and segment
      const userVectorStart = Date.now();
      const { userVector, userSegment } = await this.fetchUserPreferences(options.userId);
      metrics.userVectorFetchTime = Date.now() - userVectorStart;

      if (!userVector || userVector.length !== 8) {
        // Fallback to popularity-only if user vector not available
        return await this.getFallbackRecommendations(options, metrics);
      }

      // Step 3: Search hotels via Amadeus
      const amadeusStart = Date.now();
      const hotels = await this.searchHotels(options.searchParams, options.filters);
      metrics.amadeusSearchTime = Date.now() - amadeusStart;

      if (hotels.length === 0) {
        return {
          userId: options.userId,
          count: 0,
          recommendations: [],
          metadata: {
            processingTime: Date.now() - startTime,
            strategy: 'no_results',
            cacheHit: false,
          },
        };
      }

      // Step 4: Vectorize hotels
      const vectorizationStart = Date.now();
      const hotelsWithVectors = hotels.map(hotel => ({
        features: hotel,
        vector: this.vectorizer.vectorize(hotel),
      }));
      metrics.vectorizationTime = Date.now() - vectorizationStart;

      // Step 5: Score and rank
      const scoringStart = Date.now();
      const scoredHotels = await this.scorer.scoreAccommodations(
        userVector,
        userSegment,
        hotelsWithVectors,
        options.limit || 20
      );
      metrics.scoringTime = Date.now() - scoringStart;

      // Step 6: Build response
      metrics.totalTime = Date.now() - startTime;

      const response: RecommendationResponse = {
        userId: options.userId,
        count: scoredHotels.length,
        recommendations: scoredHotels,
        metadata: {
          processingTime: metrics.totalTime,
          strategy: 'hybrid',
          cacheHit: false,
          amadeusResponseTime: metrics.amadeusSearchTime,
          scoringTime: metrics.scoringTime,
        },
      };

      // Step 7: Cache results
      if (this.cache) {
        await this.cacheRecommendations(cacheKey, response, 3600); // 1 hour TTL
      }

      // Step 8: Log metrics
      await this.logPerformanceMetrics(options.userId, metrics);

      return response;
    } catch (error) {
      console.error('[AccommodationRecommendation] Error:', error);

      // Fallback to popularity-only
      return await this.getFallbackRecommendations(options, metrics);
    }
  }

  /**
   * Fallback to popularity-only recommendations
   *
   * Used when user vector is not available or scoring fails.
   *
   * @param options - Recommendation options
   * @param metrics - Performance metrics
   * @returns Recommendations sorted by popularity
   */
  private async getFallbackRecommendations(
    options: RecommendationOptions,
    metrics: PerformanceMetrics
  ): Promise<RecommendationResponse> {
    console.log('[AccommodationRecommendation] Falling back to popularity-only');

    try {
      const hotels = await this.searchHotels(options.searchParams, options.filters);

      // Sort by rating and review count
      const sortedHotels = hotels
        .map(hotel => ({
          accommodation: hotel,
          vector: this.vectorizer.vectorize(hotel),
          score: this.calculatePopularityOnlyScore(hotel),
          confidence: 0.5,
          breakdown: {
            similarityScore: 0,
            popularityScore: this.calculatePopularityOnlyScore(hotel),
            qualityScore: 0,
            segmentBoost: 1.0,
            finalScore: this.calculatePopularityOnlyScore(hotel),
          },
          reasons: ['Popular among travelers', 'Highly rated'],
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 20)
        .map((hotel, index) => ({
          ...hotel,
          rank: index + 1,
        }));

      return {
        userId: options.userId,
        count: sortedHotels.length,
        recommendations: sortedHotels,
        metadata: {
          processingTime: Date.now() - (metrics.totalTime || 0),
          strategy: 'popularity_fallback',
          cacheHit: false,
        },
      };
    } catch (fallbackError) {
      console.error('[AccommodationRecommendation] Fallback also failed:', fallbackError);

      return {
        userId: options.userId,
        count: 0,
        recommendations: [],
        metadata: {
          processingTime: Date.now(),
          strategy: 'failed',
          cacheHit: false,
        },
      };
    }
  }

  /**
   * Calculate popularity-only score
   *
   * @param hotel - Hotel features
   * @returns Popularity score [0-1]
   */
  private calculatePopularityOnlyScore(hotel: AccommodationFeatures): number {
    let score = 0;

    if (hotel.ratings?.overall) {
      score += ((hotel.ratings.overall - 5) / 5) * 0.6;
    }

    if (hotel.ratings?.numberOfReviews) {
      const reviewScore = Math.min(1, Math.log10(hotel.ratings.numberOfReviews + 1) / 4);
      score += reviewScore * 0.4;
    }

    return Math.max(0, Math.min(1, score));
  }

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  /**
   * Fetch user preferences (vector + segment)
   *
   * @param userId - User ID
   * @returns User vector and primary segment
   */
  private async fetchUserPreferences(
    userId: string
  ): Promise<{ userVector: number[]; userSegment: string }> {
    try {
      // Fetch from UserVector table
      const userVector = await prisma.userVector.findUnique({
        where: { userId },
        select: {
          vector: true,
          primarySegment: true,
        },
      });

      if (!userVector) {
        throw new Error('User vector not found');
      }

      return {
        userVector: userVector.vector as number[],
        userSegment: userVector.primarySegment || 'CULTURAL_ENTHUSIAST', // Default fallback
      };
    } catch (error) {
      console.error(`Failed to fetch user preferences for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Search hotels via Amadeus API
   *
   * @param searchParams - Search parameters
   * @param filters - Optional filters
   * @returns Array of accommodation features
   */
  private async searchHotels(
    searchParams: {
      cityCode: string;
      checkInDate: string;
      checkOutDate: string;
      adults: number;
      children?: number;
      rooms?: number;
    },
    filters?: {
      minRating?: number;
      maxPrice?: number;
      requiredAmenities?: string[];
      categories?: string[];
    }
  ): Promise<AccommodationFeatures[]> {
    try {
      // Call Amadeus service (via voyage service)
      const response = await axios.post(
        `${AMADEUS_SERVICE_URL}/api/v1/hotels/search`,
        {
          ...searchParams,
          ...filters,
        },
        {
          headers: { 'X-Internal-Service': 'ai-service' },
          timeout: 5000,
        }
      );

      const hotels = response.data.hotels || [];

      // Transform Amadeus response to AccommodationFeatures
      return hotels.map((hotel: any) =>
        this.vectorizer['transformAmadeusToFeatures'](hotel, searchParams.cityCode)
      );
    } catch (error: any) {
      console.error('Amadeus search failed:', error.message);
      throw new Error('Failed to search hotels');
    }
  }

  // ==========================================================================
  // CACHING
  // ==========================================================================

  /**
   * Get cached recommendations
   *
   * @param cacheKey - Redis cache key
   * @returns Cached recommendations or null
   */
  private async getCachedRecommendations(
    cacheKey: string
  ): Promise<RecommendationResponse | null> {
    try {
      if (!this.cache) return null;

      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Cache recommendations
   *
   * @param cacheKey - Redis cache key
   * @param response - Recommendation response
   * @param ttl - Time to live (seconds)
   */
  private async cacheRecommendations(
    cacheKey: string,
    response: RecommendationResponse,
    ttl: number
  ): Promise<void> {
    try {
      if (!this.cache) return;

      await this.cache.setex(cacheKey, ttl, JSON.stringify(response));
    } catch (error) {
      console.error('Cache write error:', error);
      // Non-critical, continue
    }
  }

  // ==========================================================================
  // MONITORING
  // ==========================================================================

  /**
   * Log performance metrics
   *
   * @param userId - User ID
   * @param metrics - Performance metrics
   */
  private async logPerformanceMetrics(
    userId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    try {
      // TODO: Send to analytics service
      console.log('[Performance]', {
        userId,
        totalTime: metrics.totalTime,
        breakdown: {
          userVectorFetch: metrics.userVectorFetchTime,
          amadeusSearch: metrics.amadeusSearchTime,
          vectorization: metrics.vectorizationTime,
          scoring: metrics.scoringTime,
        },
        cacheHit: metrics.cacheHit,
      });

      // Alert if performance is degraded
      if (metrics.totalTime > 500) {
        console.warn('[Performance] Slow recommendation request:', metrics);
      }
    } catch (error) {
      console.error('Failed to log metrics:', error);
      // Non-critical
    }
  }

  /**
   * Track user interaction with recommendation
   *
   * Used for future personalization and analytics.
   *
   * @param userId - User ID
   * @param hotelId - Hotel ID
   * @param interactionType - Type of interaction
   */
  async trackInteraction(
    userId: string,
    hotelId: string,
    interactionType: 'view' | 'click' | 'book' | 'like' | 'dislike'
  ): Promise<void> {
    try {
      // TODO: Store in analytics DB
      console.log('[Interaction]', {
        userId,
        hotelId,
        type: interactionType,
        timestamp: new Date().toISOString(),
      });

      // TODO: Update user vector incrementally (learning)
      // Similar to IA-002.3 refineUserProfile
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Update vectorization configuration
   *
   * @param config - Partial vectorization config
   */
  updateVectorizationConfig(config: any): void {
    this.vectorizer.updateConfig(config);
  }

  /**
   * Update scoring configuration
   *
   * @param config - Partial scoring config
   */
  updateScoringConfig(config: any): void {
    this.scorer.updateConfig(config);
  }

  /**
   * Get current service status
   *
   * @returns Service health status
   */
  async getStatus(): Promise<{
    healthy: boolean;
    services: {
      database: boolean;
      amadeus: boolean;
      cache: boolean;
    };
  }> {
    const status = {
      healthy: true,
      services: {
        database: false,
        amadeus: false,
        cache: false,
      },
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      status.services.database = true;
    } catch {
      status.services.database = false;
      status.healthy = false;
    }

    // Check Amadeus service
    try {
      await axios.get(`${AMADEUS_SERVICE_URL}/health`, { timeout: 2000 });
      status.services.amadeus = true;
    } catch {
      status.services.amadeus = false;
      status.healthy = false;
    }

    // Check cache
    if (this.cache) {
      try {
        await this.cache.ping();
        status.services.cache = true;
      } catch {
        status.services.cache = false;
        // Cache is not critical
      }
    }

    return status;
  }
}

export default AccommodationRecommendationService;
