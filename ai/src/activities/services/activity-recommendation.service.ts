/**
 * Activity Recommendation Service
 *
 * Main orchestration service that combines:
 * - Activity search (Amadeus API via Voyage service)
 * - Vectorization (ActivityVectorizerService)
 * - Scoring (ActivityScoringService)
 * - Caching (Redis)
 *
 * ## 🔍 WHAT IT DOES
 * Provides end-to-end activity recommendations for users, from search
 * to personalized scoring to final ranked results with explanations.
 *
 * ## 💡 WHY WE NEED IT
 * This service orchestrates the complete recommendation pipeline:
 * 1. Fetches user preferences (UserVector + segment)
 * 2. Searches activities via Amadeus
 * 3. Vectorizes each activity
 * 4. Scores and ranks activities with contextual factors
 * 5. Returns top N with reasons
 *
 * ## ⚙️ HOW IT WORKS
 * - Integrates IA-004.1 (vectorization) and IA-004.2 (scoring)
 * - Caches results in Redis for performance
 * - Handles errors gracefully with fallbacks
 * - Monitors performance and logs metrics
 *
 * @module activities/services
 * @ticket US-IA-004
 */

import { prisma } from '@dreamscape/db';
import axios from 'axios';
import { ActivityVectorizerService } from './activity-vectorizer.service';
import { ActivityScoringService, TripContext } from './activity-scoring.service';
import {
  ActivityRecommendationOptions,
  ActivityRecommendationResponse,
  ActivityFeatures,
  ActivityCacheKey,
} from '../types/activity-vector.types';

// Configuration
const VOYAGE_SERVICE_URL = process.env.VOYAGE_SERVICE_URL || 'http://localhost:3003';
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
 * ActivityRecommendationService
 *
 * Main orchestrator for activity recommendations.
 */
export class ActivityRecommendationService {
  private vectorizer: ActivityVectorizerService;
  private scorer: ActivityScoringService;
  private cache: any; // Redis client

  constructor() {
    this.vectorizer = new ActivityVectorizerService();
    this.scorer = new ActivityScoringService();
    this.cache = REDIS_CLIENT;
  }

  /**
   * Get personalized activity recommendations
   *
   * Main entry point for the API.
   *
   * @param options - Recommendation request options
   * @returns Recommendations with scores and reasons
   */
  async getRecommendations(options: ActivityRecommendationOptions): Promise<ActivityRecommendationResponse> {
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
      const cacheKey = ActivityCacheKey.forRecommendations(
        options.userId,
        options.searchParams.cityCode || 'location',
        options.searchParams.dates?.startDate
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

      // Step 3: Search activities via Amadeus (through Voyage service)
      const amadeusStart = Date.now();
      const activities = await this.searchActivities(options.searchParams, options.filters);
      metrics.amadeusSearchTime = Date.now() - amadeusStart;

      if (activities.length === 0) {
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

      // Step 4: Vectorize activities
      const vectorizationStart = Date.now();
      const activitiesWithVectors = activities.map(activity => ({
        features: activity,
        vector: this.vectorizer.vectorize(activity),
      }));
      metrics.vectorizationTime = Date.now() - vectorizationStart;

      // Step 5: Score and rank
      const scoringStart = Date.now();
      const scoredActivities = await this.scorer.scoreActivities(
        userVector,
        userSegment,
        activitiesWithVectors,
        options.tripContext,
        options.limit || 20
      );
      metrics.scoringTime = Date.now() - scoringStart;

      // Step 6: Build response
      metrics.totalTime = Date.now() - startTime;

      const response: ActivityRecommendationResponse = {
        userId: options.userId,
        count: scoredActivities.length,
        recommendations: scoredActivities,
        metadata: {
          processingTime: metrics.totalTime,
          strategy: 'hybrid',
          cacheHit: false,
          amadeusResponseTime: metrics.amadeusSearchTime,
          scoringTime: metrics.scoringTime,
        },
        context: {
          totalActivitiesFound: activities.length,
          filteredActivities: scoredActivities.length,
          averagePrice: this.calculateAveragePrice(activities),
          categories: [...new Set(activities.map(a => a.category))],
        },
      };

      // Step 7: Cache results
      if (this.cache) {
        await this.cacheRecommendations(cacheKey, response, 1800); // 30 min TTL (shorter than accommodations)
      }

      // Step 8: Log metrics
      await this.logPerformanceMetrics(options.userId, metrics);

      return response;
    } catch (error) {
      console.error('[ActivityRecommendation] Error:', error);

      // Fallback to popularity-only
      return await this.getFallbackRecommendations(options, metrics);
    }
  }

  /**
   * Fallback to popularity-only recommendations
   */
  private async getFallbackRecommendations(
    options: ActivityRecommendationOptions,
    metrics: PerformanceMetrics
  ): Promise<ActivityRecommendationResponse> {
    console.log('[ActivityRecommendation] Falling back to popularity-only');

    try {
      const activities = await this.searchActivities(options.searchParams, options.filters);

      // Sort by rating and review count
      const sortedActivities = activities
        .map(activity => ({
          activity,
          vector: this.vectorizer.vectorize(activity),
          score: this.calculatePopularityOnlyScore(activity),
          confidence: 0.5,
          breakdown: {
            similarityScore: 0,
            popularityScore: this.calculatePopularityOnlyScore(activity),
            qualityScore: 0,
            contextualScore: 0,
            segmentBoost: 1.0,
            finalScore: this.calculatePopularityOnlyScore(activity),
          },
          reasons: ['Popular among travelers', 'Highly rated'],
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 20)
        .map((activity, index) => ({
          ...activity,
          rank: index + 1,
        }));

      return {
        userId: options.userId,
        count: sortedActivities.length,
        recommendations: sortedActivities,
        metadata: {
          processingTime: Date.now() - (metrics.totalTime || 0),
          strategy: 'popularity_fallback',
          cacheHit: false,
        },
        context: {
          totalActivitiesFound: activities.length,
          filteredActivities: sortedActivities.length,
          averagePrice: this.calculateAveragePrice(activities),
          categories: [...new Set(activities.map(a => a.category))],
        },
      };
    } catch (fallbackError) {
      console.error('[ActivityRecommendation] Fallback also failed:', fallbackError);

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
   */
  private calculatePopularityOnlyScore(activity: ActivityFeatures): number {
    let score = 0;

    if (activity.rating > 0) {
      score += (activity.rating / 5) * 0.6;
    }

    if (activity.reviewCount > 0) {
      const reviewScore = Math.min(1, Math.log10(activity.reviewCount + 1) / 3);
      score += reviewScore * 0.4;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate average price
   */
  private calculateAveragePrice(activities: ActivityFeatures[]): number {
    const prices = activities.map(a => a.price.amount).filter(p => p > 0);
    if (prices.length === 0) return 0;
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  }

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  /**
   * Fetch user preferences (vector + segment)
   */
  private async fetchUserPreferences(
    userId: string
  ): Promise<{ userVector: number[]; userSegment: string }> {
    try {
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
        userSegment: userVector.primarySegment || 'CULTURAL_ENTHUSIAST',
      };
    } catch (error) {
      console.error(`Failed to fetch user preferences for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Search activities via Amadeus API (through Voyage service)
   */
  private async searchActivities(
    searchParams: ActivityRecommendationOptions['searchParams'],
    filters?: ActivityRecommendationOptions['filters']
  ): Promise<ActivityFeatures[]> {
    try {
      // Build search query
      const query: any = {};

      if (searchParams.cityCode) {
        query.cityCode = searchParams.cityCode;
      } else if (searchParams.location) {
        query.latitude = searchParams.location.latitude;
        query.longitude = searchParams.location.longitude;
        query.radius = searchParams.location.radiusKm || 50;
      }

      // Apply filters
      if (filters) {
        if (filters.categories) query.categories = filters.categories;
        if (filters.maxPrice) query.maxPrice = filters.maxPrice;
        if (filters.maxDuration) query.maxDuration = filters.maxDuration;
        if (filters.minRating) query.minRating = filters.minRating;
        if (filters.childFriendly !== undefined) query.childFriendly = filters.childFriendly;
        if (filters.accessible !== undefined) query.accessible = filters.accessible;
      }

      // Call Voyage service
      const response = await axios.get(`${VOYAGE_SERVICE_URL}/api/activities/search`, {
        params: query,
        headers: { 'X-Internal-Service': 'ai-service' },
        timeout: 5000,
      });

      const activities = response.data.activities || response.data || [];

      // Transform to ActivityFeatures format
      return activities.map((activity: any) =>
        this.vectorizer['transformAmadeusToFeatures'](activity)
      );
    } catch (error: any) {
      console.error('Activity search failed:', error.message);
      throw new Error('Failed to search activities');
    }
  }

  // ==========================================================================
  // CACHING
  // ==========================================================================

  /**
   * Get cached recommendations
   */
  private async getCachedRecommendations(
    cacheKey: string
  ): Promise<ActivityRecommendationResponse | null> {
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
   */
  private async cacheRecommendations(
    cacheKey: string,
    response: ActivityRecommendationResponse,
    ttl: number
  ): Promise<void> {
    try {
      if (!this.cache) return;

      await this.cache.setex(cacheKey, ttl, JSON.stringify(response));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  // ==========================================================================
  // MONITORING
  // ==========================================================================

  /**
   * Log performance metrics
   */
  private async logPerformanceMetrics(
    userId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    try {
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

      if (metrics.totalTime > 500) {
        console.warn('[Performance] Slow activity recommendation request:', metrics);
      }
    } catch (error) {
      console.error('Failed to log metrics:', error);
    }
  }

  /**
   * Track user interaction with recommendation
   */
  async trackInteraction(
    userId: string,
    activityId: string,
    interactionType: 'view' | 'click' | 'book' | 'like' | 'dislike' | 'wishlist'
  ): Promise<void> {
    try {
      console.log('[Interaction]', {
        userId,
        activityId,
        type: interactionType,
        timestamp: new Date().toISOString(),
      });

      // TODO: Store in analytics DB and update user vector incrementally
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Update vectorization configuration
   */
  updateVectorizationConfig(config: any): void {
    this.vectorizer.updateConfig(config);
  }

  /**
   * Update scoring configuration
   */
  updateScoringConfig(config: any): void {
    this.scorer.updateConfig(config);
  }

  /**
   * Get current service status
   */
  async getStatus(): Promise<{
    healthy: boolean;
    services: {
      database: boolean;
      voyage: boolean;
      cache: boolean;
    };
  }> {
    const status = {
      healthy: true,
      services: {
        database: false,
        voyage: false,
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

    // Check Voyage service
    try {
      await axios.get(`${VOYAGE_SERVICE_URL}/health`, { timeout: 2000 });
      status.services.voyage = true;
    } catch {
      status.services.voyage = false;
      status.healthy = false;
    }

    // Check cache
    if (this.cache) {
      try {
        await this.cache.ping();
        status.services.cache = true;
      } catch {
        status.services.cache = false;
      }
    }

    return status;
  }
}

export default ActivityRecommendationService;
