/**
 * Flight Recommendation Service
 *
 * Main orchestration service that combines:
 * - Flight search (Amadeus API via Voyage service)
 * - Vectorization (FlightVectorizerService)
 * - Scoring (FlightScoringService)
 * - Caching (Redis)
 *
 * ## 🔍 WHAT IT DOES
 * Provides end-to-end flight recommendations for users, from search
 * to personalized scoring to final ranked results with explanations.
 *
 * ## 💡 WHY WE NEED IT
 * This service orchestrates the complete recommendation pipeline:
 * 1. Fetches user preferences (UserVector + segment)
 * 2. Searches flights via Amadeus
 * 3. Vectorizes each flight
 * 4. Scores and ranks flights with contextual factors
 * 5. Returns top N with reasons
 *
 * ## ⚙️ HOW IT WORKS
 * - Integrates IA-004-bis.1 (vectorization) and IA-004-bis.2 (scoring)
 * - Caches results in Redis for performance
 * - Handles errors gracefully with fallbacks
 * - Monitors performance and logs metrics
 *
 * @module flights/services
 * @ticket US-IA-004-bis
 */

import { prisma } from '@dreamscape/db';
import axios from 'axios';
import { FlightVectorizerService } from './flight-vectorizer.service';
import { FlightScoringService, TripContext } from './flight-scoring.service';
import {
  FlightRecommendationOptions,
  FlightRecommendationResponse,
  FlightFeatures,
  FlightCacheKey,
} from '../types/flight-vector.types';

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
 * FlightRecommendationService
 *
 * Main orchestrator for flight recommendations.
 */
export class FlightRecommendationService {
  private vectorizer: FlightVectorizerService;
  private scorer: FlightScoringService;
  private cache: any; // Redis client

  constructor() {
    this.vectorizer = new FlightVectorizerService();
    this.scorer = new FlightScoringService();
    this.cache = REDIS_CLIENT;
  }

  /**
   * Get personalized flight recommendations
   *
   * Main entry point for the API.
   *
   * @param options - Recommendation request options
   * @returns Recommendations with scores and reasons
   */
  async getRecommendations(options: FlightRecommendationOptions): Promise<FlightRecommendationResponse> {
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
      const cacheKey = FlightCacheKey.forRecommendations(
        options.userId,
        options.searchParams.origin,
        options.searchParams.destination,
        options.searchParams.departureDate
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

      // Step 3: Search flights via Amadeus (through Voyage service)
      const amadeusStart = Date.now();
      const flights = await this.searchFlights(options.searchParams, options.filters);
      metrics.amadeusSearchTime = Date.now() - amadeusStart;

      if (flights.length === 0) {
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

      // Step 4: Vectorize flights
      const vectorizationStart = Date.now();
      const flightsWithVectors = flights.map(flight => ({
        features: flight,
        vector: this.vectorizer.vectorize(flight),
      }));
      metrics.vectorizationTime = Date.now() - vectorizationStart;

      // Step 5: Score and rank
      const scoringStart = Date.now();
      const scoredFlights = await this.scorer.scoreFlights(
        userVector,
        userSegment,
        flightsWithVectors,
        options.tripContext,
        options.limit || 20
      );
      metrics.scoringTime = Date.now() - scoringStart;

      // Step 6: Build response
      metrics.totalTime = Date.now() - startTime;

      const response: FlightRecommendationResponse = {
        userId: options.userId,
        count: scoredFlights.length,
        recommendations: scoredFlights,
        metadata: {
          processingTime: metrics.totalTime,
          strategy: 'hybrid',
          cacheHit: false,
          amadeusResponseTime: metrics.amadeusSearchTime,
          scoringTime: metrics.scoringTime,
        },
        context: {
          totalFlightsFound: flights.length,
          filteredFlights: scoredFlights.length,
          averagePrice: this.calculateAveragePrice(flights),
          priceRange: this.calculatePriceRange(flights),
          airlines: [...new Set(flights.map(f => f.airline.name))],
          fastestFlight: this.getFastestFlight(flights),
          cheapestFlight: this.getCheapestFlight(flights),
        },
      };

      // Step 7: Cache results
      if (this.cache) {
        await this.cacheRecommendations(cacheKey, response, 1800); // 30 min TTL
      }

      // Step 8: Log metrics
      await this.logPerformanceMetrics(options.userId, metrics);

      return response;
    } catch (error) {
      console.error('[FlightRecommendation] Error:', error);

      // Fallback to popularity-only
      return await this.getFallbackRecommendations(options, metrics);
    }
  }

  /**
   * Fallback to popularity-only recommendations
   */
  private async getFallbackRecommendations(
    options: FlightRecommendationOptions,
    metrics: PerformanceMetrics
  ): Promise<FlightRecommendationResponse> {
    console.log('[FlightRecommendation] Falling back to popularity-only');

    try {
      const flights = await this.searchFlights(options.searchParams, options.filters);

      // Sort by airline rating and on-time performance
      const sortedFlights = flights
        .map(flight => ({
          flight,
          vector: this.vectorizer.vectorize(flight),
          score: this.calculatePopularityOnlyScore(flight),
          confidence: 0.5,
          breakdown: {
            similarityScore: 0,
            popularityScore: this.calculatePopularityOnlyScore(flight),
            qualityScore: 0,
            contextualScore: 0,
            segmentBoost: 1.0,
            finalScore: this.calculatePopularityOnlyScore(flight),
          },
          reasons: ['Highly-rated airline', 'Popular route'],
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 20)
        .map((flight, index) => ({
          ...flight,
          rank: index + 1,
        }));

      return {
        userId: options.userId,
        count: sortedFlights.length,
        recommendations: sortedFlights,
        metadata: {
          processingTime: Date.now() - (metrics.totalTime || 0),
          strategy: 'popularity_fallback',
          cacheHit: false,
        },
        context: {
          totalFlightsFound: flights.length,
          filteredFlights: sortedFlights.length,
          averagePrice: this.calculateAveragePrice(flights),
          priceRange: this.calculatePriceRange(flights),
          airlines: [...new Set(flights.map(f => f.airline.name))],
        },
      };
    } catch (fallbackError) {
      console.error('[FlightRecommendation] Fallback also failed:', fallbackError);

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
  private calculatePopularityOnlyScore(flight: FlightFeatures): number {
    let score = 0;

    // Airline rating (0-5 scale)
    if (flight.popularity.airlineRating > 0) {
      score += (flight.popularity.airlineRating / 5) * 0.5;
    }

    // On-time performance
    score += flight.popularity.onTimePerformance * 0.3;

    // Route popularity
    score += flight.popularity.routePopularity * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate average price
   */
  private calculateAveragePrice(flights: FlightFeatures[]): number {
    const prices = flights.map(f => f.price.amount).filter(p => p > 0);
    if (prices.length === 0) return 0;
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  }

  /**
   * Calculate price range
   */
  private calculatePriceRange(flights: FlightFeatures[]): { min: number; max: number } {
    const prices = flights.map(f => f.price.amount).filter(p => p > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }

  /**
   * Get fastest flight
   */
  private getFastestFlight(flights: FlightFeatures[]): { duration: number; price: number } | undefined {
    if (flights.length === 0) return undefined;

    const fastest = flights.reduce((min, flight) =>
      flight.duration.total < min.duration.total ? flight : min
    );

    return {
      duration: fastest.duration.total,
      price: fastest.price.amount,
    };
  }

  /**
   * Get cheapest flight
   */
  private getCheapestFlight(flights: FlightFeatures[]): { duration: number; price: number } | undefined {
    if (flights.length === 0) return undefined;

    const cheapest = flights.reduce((min, flight) =>
      flight.price.amount < min.price.amount ? flight : min
    );

    return {
      duration: cheapest.duration.total,
      price: cheapest.price.amount,
    };
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
   * Search flights via Amadeus API (through Voyage service)
   */
  private async searchFlights(
    searchParams: FlightRecommendationOptions['searchParams'],
    filters?: FlightRecommendationOptions['filters']
  ): Promise<FlightFeatures[]> {
    try {
      // Build search query
      const query: any = {
        originLocationCode: searchParams.origin,
        destinationLocationCode: searchParams.destination,
        departureDate: searchParams.departureDate,
        adults: searchParams.adults,
      };

      if (searchParams.returnDate) {
        query.returnDate = searchParams.returnDate;
      }

      if (searchParams.children) {
        query.children = searchParams.children;
      }

      if (searchParams.infants) {
        query.infants = searchParams.infants;
      }

      if (searchParams.travelClass) {
        query.travelClass = searchParams.travelClass;
      }

      // Apply filters
      if (filters) {
        if (filters.maxStops !== undefined) query.maxStops = filters.maxStops;
        if (filters.maxDuration) query.maxDuration = filters.maxDuration;
        if (filters.maxPrice) query.maxPrice = filters.maxPrice;
        if (filters.airlines) query.includedAirlineCodes = filters.airlines.join(',');
      }

      // Call Voyage service
      const response = await axios.get(`${VOYAGE_SERVICE_URL}/api/flights/search`, {
        params: query,
        headers: { 'X-Internal-Service': 'ai-service' },
        timeout: 8000, // Flights can take longer than activities
      });

      const flights = response.data.flights || response.data || [];

      // Transform to FlightFeatures format
      return flights.map((flight: any) =>
        this.vectorizer['transformAmadeusToFeatures'](flight)
      );
    } catch (error: any) {
      console.error('Flight search failed:', error.message);
      throw new Error('Failed to search flights');
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
  ): Promise<FlightRecommendationResponse | null> {
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
    response: FlightRecommendationResponse,
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

      if (metrics.totalTime > 1000) {
        console.warn('[Performance] Slow flight recommendation request:', metrics);
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
    flightId: string,
    interactionType: 'view' | 'click' | 'book' | 'compare' | 'save'
  ): Promise<void> {
    try {
      console.log('[Interaction]', {
        userId,
        flightId,
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

export default FlightRecommendationService;
