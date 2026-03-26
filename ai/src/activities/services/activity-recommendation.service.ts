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

// Expanded city coordinates mapping (IATA codes + common name aliases)
const CITY_COORDINATES: Record<string, { latitude: number; longitude: number; radiusKm: number }> = {
  // Original supported cities
  'NYC': { latitude: 40.7128, longitude: -74.0060, radiusKm: 50 },
  'PAR': { latitude: 48.8566, longitude: 2.3522, radiusKm: 50 },
  'LON': { latitude: 51.5074, longitude: -0.1278, radiusKm: 50 },
  'TYO': { latitude: 35.6762, longitude: 139.6503, radiusKm: 50 },
  'DXB': { latitude: 25.2048, longitude: 55.2708, radiusKm: 50 },
  'BKK': { latitude: 13.7563, longitude: 100.5018, radiusKm: 50 },
  'SIN': { latitude: 1.3521, longitude: 103.8198, radiusKm: 30 },
  'HKG': { latitude: 22.3193, longitude: 114.1694, radiusKm: 30 },
  'LAX': { latitude: 34.0522, longitude: -118.2437, radiusKm: 50 },
  'SFO': { latitude: 37.7749, longitude: -122.4194, radiusKm: 50 },

  // Europe
  'BCN': { latitude: 41.3874, longitude: 2.1686, radiusKm: 50 },     // Barcelona
  'ROM': { latitude: 41.9028, longitude: 12.4964, radiusKm: 50 },   // Rome
  'FCO': { latitude: 41.9028, longitude: 12.4964, radiusKm: 50 },   // Rome (airport code)
  'AMS': { latitude: 52.3676, longitude: 4.9041, radiusKm: 30 },    // Amsterdam
  'BER': { latitude: 52.5200, longitude: 13.4050, radiusKm: 50 },   // Berlin
  'MAD': { latitude: 40.4168, longitude: -3.7038, radiusKm: 50 },   // Madrid
  'LIS': { latitude: 38.7223, longitude: -9.1393, radiusKm: 40 },   // Lisbon
  'PRG': { latitude: 50.0755, longitude: 14.4378, radiusKm: 30 },   // Prague
  'VIE': { latitude: 48.2082, longitude: 16.3738, radiusKm: 40 },   // Vienna
  'ZRH': { latitude: 47.3769, longitude: 8.5417, radiusKm: 30 },    // Zurich
  'CPH': { latitude: 55.6761, longitude: 12.5683, radiusKm: 30 },   // Copenhagen
  'ATH': { latitude: 37.9838, longitude: 23.7275, radiusKm: 40 },   // Athens
  'DUB': { latitude: 53.3498, longitude: -6.2603, radiusKm: 30 },   // Dublin
  'EDI': { latitude: 55.9533, longitude: -3.1883, radiusKm: 30 },   // Edinburgh
  'MUC': { latitude: 48.1351, longitude: 11.5820, radiusKm: 40 },   // Munich
  'MAN': { latitude: 53.4808, longitude: -2.2426, radiusKm: 40 },   // Manchester
  'BRU': { latitude: 50.8503, longitude: 4.3517, radiusKm: 30 },    // Brussels
  'OSL': { latitude: 59.9139, longitude: 10.7522, radiusKm: 30 },   // Oslo
  'STO': { latitude: 59.3293, longitude: 18.0686, radiusKm: 30 },   // Stockholm
  'HEL': { latitude: 60.1695, longitude: 24.9354, radiusKm: 30 },   // Helsinki

  // Americas
  'MIA': { latitude: 25.7617, longitude: -80.1918, radiusKm: 50 },  // Miami
  'CHI': { latitude: 41.8781, longitude: -87.6298, radiusKm: 50 },  // Chicago
  'ORD': { latitude: 41.8781, longitude: -87.6298, radiusKm: 50 },  // Chicago (airport)
  'YTO': { latitude: 43.6532, longitude: -79.3832, radiusKm: 50 },  // Toronto
  'YYZ': { latitude: 43.6532, longitude: -79.3832, radiusKm: 50 },  // Toronto (airport)
  'MEX': { latitude: 19.4326, longitude: -99.1332, radiusKm: 50 },  // Mexico City
  'GRU': { latitude: -23.5505, longitude: -46.6333, radiusKm: 50 }, // São Paulo
  'BUE': { latitude: -34.6037, longitude: -58.3816, radiusKm: 50 }, // Buenos Aires
  'EZE': { latitude: -34.6037, longitude: -58.3816, radiusKm: 50 }, // Buenos Aires (airport)
  'LIM': { latitude: -12.0464, longitude: -77.0428, radiusKm: 40 }, // Lima
  'BOG': { latitude: 4.7110, longitude: -74.0721, radiusKm: 40 },   // Bogotá
  'SCL': { latitude: -33.4489, longitude: -70.6693, radiusKm: 40 }, // Santiago
  'RIO': { latitude: -22.9068, longitude: -43.1729, radiusKm: 50 }, // Rio de Janeiro
  'GIG': { latitude: -22.9068, longitude: -43.1729, radiusKm: 50 }, // Rio (airport)
  'SEA': { latitude: 47.6062, longitude: -122.3321, radiusKm: 50 }, // Seattle
  'BOS': { latitude: 42.3601, longitude: -71.0589, radiusKm: 40 },  // Boston
  'WAS': { latitude: 38.9072, longitude: -77.0369, radiusKm: 50 },  // Washington DC
  'IAD': { latitude: 38.9072, longitude: -77.0369, radiusKm: 50 },  // Washington DC (airport)
  'LAS': { latitude: 36.1699, longitude: -115.1398, radiusKm: 40 }, // Las Vegas

  // Asia-Pacific
  'SYD': { latitude: -33.8688, longitude: 151.2093, radiusKm: 50 }, // Sydney
  'MEL': { latitude: -37.8136, longitude: 144.9631, radiusKm: 50 }, // Melbourne
  'SEL': { latitude: 37.5665, longitude: 126.9780, radiusKm: 50 },  // Seoul
  'ICN': { latitude: 37.5665, longitude: 126.9780, radiusKm: 50 },  // Seoul (airport)
  'SHA': { latitude: 31.2304, longitude: 121.4737, radiusKm: 50 },  // Shanghai
  'PVG': { latitude: 31.2304, longitude: 121.4737, radiusKm: 50 },  // Shanghai (airport)
  'BEJ': { latitude: 39.9042, longitude: 116.4074, radiusKm: 50 },  // Beijing
  'PEK': { latitude: 39.9042, longitude: 116.4074, radiusKm: 50 },  // Beijing (airport)
  'DEL': { latitude: 28.7041, longitude: 77.1025, radiusKm: 50 },   // Delhi
  'BOM': { latitude: 19.0760, longitude: 72.8777, radiusKm: 50 },   // Mumbai
  'BLR': { latitude: 12.9716, longitude: 77.5946, radiusKm: 40 },   // Bangalore
  'KUL': { latitude: 3.1390, longitude: 101.6869, radiusKm: 40 },   // Kuala Lumpur
  'MNL': { latitude: 14.5995, longitude: 120.9842, radiusKm: 40 },  // Manila
  'JKT': { latitude: -6.2088, longitude: 106.8456, radiusKm: 50 },  // Jakarta
  'CGK': { latitude: -6.2088, longitude: 106.8456, radiusKm: 50 },  // Jakarta (airport)
  'HAN': { latitude: 21.0285, longitude: 105.8542, radiusKm: 40 },  // Hanoi
  'SGN': { latitude: 10.8231, longitude: 106.6297, radiusKm: 40 },  // Ho Chi Minh City
  'OSA': { latitude: 34.6937, longitude: 135.5023, radiusKm: 40 },  // Osaka
  'KIX': { latitude: 34.6937, longitude: 135.5023, radiusKm: 40 },  // Osaka (airport)

  // Middle East & Africa
  'CAI': { latitude: 30.0444, longitude: 31.2357, radiusKm: 50 },   // Cairo
  'JNB': { latitude: -26.2041, longitude: 28.0473, radiusKm: 50 },  // Johannesburg
  'IST': { latitude: 41.0082, longitude: 28.9784, radiusKm: 50 },   // Istanbul
  'DOH': { latitude: 25.2854, longitude: 51.5310, radiusKm: 40 },   // Doha
  'AUH': { latitude: 24.4539, longitude: 54.3773, radiusKm: 40 },   // Abu Dhabi
  'RUH': { latitude: 24.7136, longitude: 46.6753, radiusKm: 40 },   // Riyadh
  'TLV': { latitude: 32.0853, longitude: 34.7818, radiusKm: 30 },   // Tel Aviv
  'AMM': { latitude: 31.9454, longitude: 35.9284, radiusKm: 30 },   // Amman
  'BEY': { latitude: 33.8886, longitude: 35.4955, radiusKm: 30 },   // Beirut
  'CPT': { latitude: -33.9249, longitude: 18.4241, radiusKm: 40 },  // Cape Town
  'NBO': { latitude: -1.2921, longitude: 36.8219, radiusKm: 40 },   // Nairobi

  // Common name aliases (for user convenience)
  'PARIS': { latitude: 48.8566, longitude: 2.3522, radiusKm: 50 },
  'LONDON': { latitude: 51.5074, longitude: -0.1278, radiusKm: 50 },
  'TOKYO': { latitude: 35.6762, longitude: 139.6503, radiusKm: 50 },
  'NEW YORK': { latitude: 40.7128, longitude: -74.0060, radiusKm: 50 },
  'NEW_YORK': { latitude: 40.7128, longitude: -74.0060, radiusKm: 50 },
  'BARCELONA': { latitude: 41.3874, longitude: 2.1686, radiusKm: 50 },
  'ROME': { latitude: 41.9028, longitude: 12.4964, radiusKm: 50 },
  'AMSTERDAM': { latitude: 52.3676, longitude: 4.9041, radiusKm: 30 },
  'BERLIN': { latitude: 52.5200, longitude: 13.4050, radiusKm: 50 },
  'MADRID': { latitude: 40.4168, longitude: -3.7038, radiusKm: 50 },
  'DUBAI': { latitude: 25.2048, longitude: 55.2708, radiusKm: 50 },
  'SINGAPORE': { latitude: 1.3521, longitude: 103.8198, radiusKm: 30 },
  'BANGKOK': { latitude: 13.7563, longitude: 100.5018, radiusKm: 50 },
  'HONG KONG': { latitude: 22.3193, longitude: 114.1694, radiusKm: 30 },
  'HONG_KONG': { latitude: 22.3193, longitude: 114.1694, radiusKm: 30 },
  'SYDNEY': { latitude: -33.8688, longitude: 151.2093, radiusKm: 50 },
  'MELBOURNE': { latitude: -37.8136, longitude: 144.9631, radiusKm: 50 },
  'LOS ANGELES': { latitude: 34.0522, longitude: -118.2437, radiusKm: 50 },
  'LOS_ANGELES': { latitude: 34.0522, longitude: -118.2437, radiusKm: 50 },
  'SAN FRANCISCO': { latitude: 37.7749, longitude: -122.4194, radiusKm: 50 },
  'SAN_FRANCISCO': { latitude: 37.7749, longitude: -122.4194, radiusKm: 50 },
};

import { prisma } from '@dreamscape/db';
import axios from 'axios';
import { ActivityVectorizerService } from './activity-vectorizer.service';
import { ActivityScoringService, TripContext } from './activity-scoring.service';
import {
  ActivityRecommendationOptions,
  ActivityRecommendationResponse,
  ActivityFeatures,
  ActivityCacheKey,
  ScoredActivity,
} from '../types/activity-vector.types';
import { parseCityNamesToIATA, isValidIATACode } from '../../shared/utils/city-iata-mapper';

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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const metrics: PerformanceMetrics = {
      totalTime: 0,
      userVectorFetchTime: 0,
      amadeusSearchTime: 0,
      vectorizationTime: 0,
      scoringTime: 0,
      cacheHit: false,
    };

    console.log(`[${requestId}] 🚀 Starting activity recommendation request`, {
      userId: options.userId,
      cityCode: options.searchParams.cityCode,
      location: options.searchParams.location,
      dates: options.searchParams.dates,
    });

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
          console.log(`[${requestId}] ✅ Cache hit`);
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
      console.log(`[${requestId}] 📊 Fetching user preferences`);
      const userVectorStart = Date.now();
      const { userVector, userSegment } = await this.fetchUserPreferences(options.userId);
      metrics.userVectorFetchTime = Date.now() - userVectorStart;
      console.log(`[${requestId}] ✅ User vector retrieved`, {
        segment: userSegment,
        dimensions: userVector.length,
      });

      // Note: fetchUserPreferences() now guarantees a valid 8D vector, so no need to check

      // Step 2.5: Determine cities to search (requested + 2 alternatives)
      let citiesToSearch: string[];
      let isMultiDestination = false;

      // Get user profile for preferredDestinations
      const userProfile = await this.getUserProfile(options.userId);

      if (options.searchParams.cityCode) {
        // Always start with the requested city
        citiesToSearch = [options.searchParams.cityCode];

        // Add 2 alternative destinations from user profile
        const alternatives = await this.selectAlternativeDestinations(
          userProfile?.preferredDestinations || [],
          userVector,
          userSegment,
          options.searchParams.cityCode // Exclude current city
        );

        if (alternatives.length > 0) {
          citiesToSearch = [...citiesToSearch, ...alternatives.slice(0, 2)];
          isMultiDestination = true;
        }
      } else {
        // No requested city - suggest 3 destinations from profile
        citiesToSearch = await this.selectAlternativeDestinations(
          userProfile?.preferredDestinations || [],
          userVector,
          userSegment,
          null // No exclusion
        );
        citiesToSearch = citiesToSearch.slice(0, 3);
        isMultiDestination = citiesToSearch.length > 1;
      }

      console.log(`[${requestId}] 🌍 Searching ${citiesToSearch.length} cities:`, citiesToSearch);

      // Step 3: Search activities in all cities (parallel)
      console.log(`[${requestId}] 🔍 Searching activities via Voyage service`);
      const amadeusStart = Date.now();

      const searchPromises = citiesToSearch.map(city =>
        this.searchActivities(
          { ...options.searchParams, cityCode: city },
          options.filters
        )
          .then(activities => {
            // Tag each activity with its search city for later filtering
            return activities.map(activity => ({
              ...activity,
              searchedCity: city,
            }));
          })
          .catch(error => {
            console.error(`[${requestId}] ❌ Failed to search activities in ${city}:`, error.message);
            return []; // Graceful failure - continue with other cities
          })
      );

      const searchResults = await Promise.all(searchPromises);
      const activities = searchResults.flat();

      metrics.amadeusSearchTime = Date.now() - amadeusStart;

      // Log activities found per city
      const activitiesByCity = new Map<string, number>();
      for (let i = 0; i < citiesToSearch.length; i++) {
        activitiesByCity.set(citiesToSearch[i], searchResults[i]?.length || 0);
      }
      console.log(`[${requestId}] 📊 Activities found per city:`, Object.fromEntries(activitiesByCity));
      console.log(`[${requestId}] ✅ Activities found: ${activities.length}`);

      if (activities.length === 0) {
        console.log(`[${requestId}] ⚠️ No activities found`);
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
      console.log(`[${requestId}] 🧮 Vectorizing ${activities.length} activities`);
      const vectorizationStart = Date.now();
      const activitiesWithVectors = activities.map(activity => ({
        features: activity,
        vector: this.vectorizer.vectorize(activity),
      }));
      metrics.vectorizationTime = Date.now() - vectorizationStart;

      // Step 5: Score and rank ALL activities together
      console.log(`[${requestId}] 🎯 Scoring activities`);
      const scoringStart = Date.now();
      const allScoredActivities = await this.scorer.scoreActivities(
        userVector,
        userSegment,
        activitiesWithVectors,
        options.tripContext,
        100 // Get top 100 to choose from
      );
      metrics.scoringTime = Date.now() - scoringStart;

      // Step 5.5: Select top 1 activity per city (ensure diversity)
      let finalRecommendations: ScoredActivity[];
      const usedCities = new Set<string>();

      if (isMultiDestination && citiesToSearch.length > 1) {
        // Multi-destination mode: select best activity from each city
        finalRecommendations = [];

        for (const city of citiesToSearch) {
          // Find all activities from this city
          const cityActivities = allScoredActivities.filter(
            a => (a.activity as any).searchedCity === city
          );

          if (cityActivities.length > 0) {
            finalRecommendations.push(cityActivities[0]); // Add top activity from this city
            usedCities.add(city);
          }
        }

        console.log(`[${requestId}] ✅ Selected ${finalRecommendations.length} activities from ${usedCities.size} cities`);
      } else {
        // Single destination mode: return top N activities
        finalRecommendations = allScoredActivities.slice(0, options.limit || 10);
      }

      // Step 6: Build response
      metrics.totalTime = Date.now() - startTime;

      const response: ActivityRecommendationResponse = {
        userId: options.userId,
        count: finalRecommendations.length,
        recommendations: finalRecommendations,
        metadata: {
          processingTime: metrics.totalTime,
          strategy: isMultiDestination ? 'multi_destination' : 'hybrid',
          cacheHit: false,
          amadeusResponseTime: metrics.amadeusSearchTime,
          scoringTime: metrics.scoringTime,
          citiesSearched: citiesToSearch,
          citiesWithResults: Array.from(usedCities),
        },
        context: {
          totalActivitiesFound: activities.length,
          filteredActivities: finalRecommendations.length,
          averagePrice: this.calculateAveragePrice(activities),
          categories: [...new Set(activities.map(a => a.category))],
        },
      };

      // Step 7: Cache results
      if (this.cache) {
        await this.cacheRecommendations(cacheKey, response, 1800); // 30 min TTL (shorter than accommodations)
      }

      // Step 8: Log metrics
      console.log(`[${requestId}] ✅ Recommendation pipeline completed in ${metrics.totalTime}ms`, {
        userVectorFetch: metrics.userVectorFetchTime,
        amadeusSearch: metrics.amadeusSearchTime,
        vectorization: metrics.vectorizationTime,
        scoring: metrics.scoringTime,
      });

      return response;
    } catch (error: any) {
      console.error(`[${requestId}] ❌ Recommendation pipeline failed:`, {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });

      // Fallback to popularity-only
      return await this.getFallbackRecommendations(options, metrics);
    }
  }

  /**
   * Fallback to popularity-only recommendations
   *
   * Handles errors gracefully with specific strategies.
   */
  private async getFallbackRecommendations(
    options: ActivityRecommendationOptions,
    metrics: PerformanceMetrics
  ): Promise<ActivityRecommendationResponse> {
    console.log('[ActivityRecommendation] Falling back to popularity-only');

    try {
      const activities = await this.searchActivities(options.searchParams, options.filters);

      if (activities.length === 0) {
        console.warn('[ActivityRecommendation] Fallback returned 0 activities');
        return this.buildEmptyResponse(options.userId, 'no_results');
      }

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
    } catch (fallbackError: any) {
      console.error('[ActivityRecommendation] Fallback also failed:', fallbackError);

      // Check error type for specific handling
      if (fallbackError.message?.includes('Unsupported city code')) {
        return this.buildErrorResponse(options.userId, 'invalid_city_code', fallbackError.message);
      }

      if (fallbackError.code === 'ECONNABORTED' || fallbackError.code === 'ETIMEDOUT' || fallbackError.code === 'ECONNREFUSED') {
        return this.buildErrorResponse(options.userId, 'voyage_timeout', 'Activity search service timeout or unavailable');
      }

      if (fallbackError.response?.status === 400) {
        return this.buildErrorResponse(options.userId, 'invalid_params', 'Invalid search parameters');
      }

      if (fallbackError.response?.status >= 500) {
        return this.buildErrorResponse(options.userId, 'voyage_error', 'Activity search service error');
      }

      return this.buildErrorResponse(options.userId, 'failed', fallbackError.message || 'Unknown error occurred');
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
   *
   * NEVER throws - always returns a valid vector.
   * Creates a default UserVector if none exists.
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

      // Validate existing vector
      if (userVector && Array.isArray(userVector.vector) && userVector.vector.length === 8) {
        return {
          userVector: userVector.vector as number[],
          userSegment: userVector.primarySegment || 'CULTURAL_ENTHUSIAST',
        };
      }

      // Create default vector if missing
      console.warn(`[ActivityRecommendation] No valid UserVector for ${userId}, creating default`);
      const defaultVector = await this.createDefaultUserVector(userId);

      return {
        userVector: defaultVector,
        userSegment: 'CULTURAL_ENTHUSIAST',
      };

    } catch (error) {
      console.error(`[ActivityRecommendation] DB error for ${userId}:`, error);

      // Ultimate fallback: neutral vector (no DB dependency)
      return {
        userVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        userSegment: 'CULTURAL_ENTHUSIAST',
      };
    }
  }

  /**
   * Create default UserVector based on neutral preferences
   *
   * Used when user hasn't completed onboarding.
   * Generates a balanced 8D vector representing neutral travel preferences.
   */
  private async createDefaultUserVector(userId: string): Promise<number[]> {
    const defaultVector = [
      0.6,  // [0] Climate: Slightly warm preference
      0.5,  // [1] Culture vs Nature: Balanced
      0.4,  // [2] Budget: Mid-range
      0.5,  // [3] Activity level: Moderate
      0.5,  // [4] Travel group: Mixed
      0.6,  // [5] Urban vs Rural: Slightly urban
      0.5,  // [6] Gastronomy: Everyone likes food
      0.6,  // [7] Popularity: Slightly mainstream
    ];

    try {
      await prisma.userVector.create({
        data: {
          userId,
          vector: defaultVector,
          version: 1,
          source: 'default_fallback',
          primarySegment: 'CULTURAL_ENTHUSIAST',
        },
      });
      console.log(`✅ [ActivityRecommendation] Created default UserVector for ${userId}`);
    } catch (error) {
      console.error(`⚠️ [ActivityRecommendation] Failed to save default UserVector:`, error);
      // Continue anyway with the vector (DB might have constraints/unique issues)
    }

    return defaultVector;
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
        // Convert cityCode to coordinates for Voyage service
        console.log(`🔍 [ActivityRecommendation] Converting cityCode: ${searchParams.cityCode}`);

        // Try exact match first
        let coords = CITY_COORDINATES[searchParams.cityCode];

        // Try uppercase if not found
        if (!coords) {
          coords = CITY_COORDINATES[searchParams.cityCode.toUpperCase()];
        }

        if (coords) {
          console.log(`✅ [ActivityRecommendation] Found coords for ${searchParams.cityCode}:`, coords);
          query.latitude = coords.latitude;
          query.longitude = coords.longitude;
          query.radius = coords.radiusKm;
        } else {
          // cityCode not supported - fail with clear error
          const supportedCities = Object.keys(CITY_COORDINATES).slice(0, 20).join(', ');
          console.error(`❌ [ActivityRecommendation] CityCode "${searchParams.cityCode}" not supported`);
          throw new Error(`Unsupported city code: ${searchParams.cityCode}. Supported cities include: ${supportedCities}...`);
        }
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

      // Call Voyage service with retry logic
      console.log(`📡 [ActivityRecommendation] Calling Voyage service with:`, query);
      const response = await this.callVoyageServiceWithRetry(query);

      const activities = response.data.data || response.data.activities || response.data || [];
      console.log(`✅ [ActivityRecommendation] Received ${activities.length} activities from Voyage`);

      // Transform to ActivityFeatures format
      return activities.map((activity: any) =>
        this.vectorizer['transformAmadeusToFeatures'](activity)
      );
    } catch (error: any) {
      console.error('❌ [ActivityRecommendation] Activity search failed:', error.message);
      throw error;
    }
  }

  /**
   * Call Voyage service with retry logic and exponential backoff
   */
  private async callVoyageServiceWithRetry(
    query: any,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 [ActivityRecommendation] Attempt ${attempt}/${maxRetries} to Voyage service`);

        const response = await axios.get(`${VOYAGE_SERVICE_URL}/api/activities/search`, {
          params: query,
          headers: { 'X-Internal-Service': 'ai-service' },
          timeout: 10000, // Increased to 10s
        });

        console.log(`✅ [ActivityRecommendation] Voyage service responded successfully on attempt ${attempt}`);
        return response;

      } catch (error: any) {
        lastError = error;

        const isLastAttempt = attempt === maxRetries;
        const isRetryable = this.isRetryableError(error);

        console.error(`❌ [ActivityRecommendation] Voyage service error (attempt ${attempt}/${maxRetries}):`, {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          retryable: isRetryable,
        });

        if (!isRetryable || isLastAttempt) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoffDelay = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ [ActivityRecommendation] Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP 5xx errors (server errors)
    if (error.response?.status >= 500) {
      return true;
    }

    // HTTP 429 (rate limiting)
    if (error.response?.status === 429) {
      return true;
    }

    // Axios timeout
    if (error.code === 'ECONNABORTED') {
      return true;
    }

    return false;
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
  // RESPONSE BUILDERS
  // ==========================================================================

  /**
   * Build empty response (no activities found)
   */
  private buildEmptyResponse(userId: string, strategy: string): ActivityRecommendationResponse {
    return {
      userId,
      count: 0,
      recommendations: [],
      metadata: {
        processingTime: 0,
        strategy,
        cacheHit: false,
      },
    };
  }

  /**
   * Build error response with detailed message
   */
  private buildErrorResponse(userId: string, strategy: string, errorMessage: string): ActivityRecommendationResponse {
    return {
      userId,
      count: 0,
      recommendations: [],
      metadata: {
        processingTime: 0,
        strategy,
        cacheHit: false,
      },
    };
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

  // ==========================================================================
  // MULTI-DESTINATION SELECTION
  // ==========================================================================

  /**
   * Get user profile with preferredDestinations
   */
  private async getUserProfile(userId: string): Promise<{ preferredDestinations: string[] } | null> {
    try {
      const profile = await prisma.travelOnboardingProfile.findUnique({
        where: { userId },
        select: { preferredDestinations: true },
      });

      if (!profile) return null;

      // Extract destinations array from the profile structure
      const destinations = (profile.preferredDestinations as any)?.destinations || [];

      return { preferredDestinations: destinations };
    } catch (error) {
      console.error('[ActivityRecommendation] Failed to fetch user profile:', error);
      return null;
    }
  }

  /**
   * Select alternative destinations from user profile
   *
   * Uses user vector and segment to intelligently select destinations
   * that match user preferences.
   *
   * @param preferredDestinations - User's preferred destinations from profile
   * @param userVector - User preference vector (8D)
   * @param segment - User's primary segment
   * @param excludeCity - City to exclude from suggestions (current destination)
   * @returns Array of IATA city codes
   */
  private async selectAlternativeDestinations(
    preferredDestinations: string[],
    userVector: number[],
    segment: string,
    excludeCity: string | null
  ): Promise<string[]> {
    // 1. Parse city names to IATA codes from preferred destinations
    const preferredCityCodes = parseCityNamesToIATA(preferredDestinations);

    // 2. Get segment-based suggestions (fallback if preferred destinations empty)
    const segmentCities = this.getCitiesForSegment(segment);

    // 3. Combine preferred destinations + segment suggestions
    const candidates = [
      ...preferredCityCodes,
      ...segmentCities
    ];

    // 4. Deduplicate, exclude current city, and filter by supported cities
    const uniqueCandidates = [...new Set(candidates)].filter(
      city => city !== excludeCity && isValidIATACode(city) && CITY_COORDINATES[city]
    );

    if (uniqueCandidates.length === 0) {
      // Fallback to default cities if no candidates
      console.warn('[ActivityRecommendation] No valid destination candidates, using defaults');
      const defaults = ['PAR', 'LON', 'BCN'].filter(c => c !== excludeCity && CITY_COORDINATES[c]);
      return defaults;
    }

    // 5. Score each destination using user vector
    const scored = this.scoreDestinations(uniqueCandidates, userVector, segment);

    // 6. Return top scored destinations
    const topDestinations = scored.slice(0, 10).map(d => d.code);

    console.log(`[ActivityRecommendation] Selected alternative destinations:`, topDestinations.slice(0, 3));

    return topDestinations;
  }

  /**
   * Score destinations based on user vector and segment
   *
   * @param cities - Array of IATA city codes
   * @param userVector - User preference vector
   * @param segment - User segment
   * @returns Scored destinations sorted by score (highest first)
   */
  private scoreDestinations(
    cities: string[],
    userVector: number[],
    segment: string
  ): Array<{ code: string; score: number }> {
    const culturalCities = ['PAR', 'ROM', 'BCN', 'ATH', 'PRG', 'VIE', 'FLR', 'IST'];
    const beachCities = ['MIA', 'CUN', 'MLE', 'HNL', 'PUJ', 'BOB', 'PPT', 'NAN'];
    const adventureCities = ['DXB', 'SYD', 'YVR', 'CPT', 'QUI', 'CHC', 'NRT'];
    const businessCities = ['LHR', 'FRA', 'JFK', 'SIN', 'HKG', 'DXB', 'CDG', 'ZRH'];
    const familyCities = ['MCO', 'LAX', 'BCN', 'ROM', 'DXB', 'CDG', 'LHR'];

    return cities.map(city => {
      let score = 0.5; // Base score

      // Boost based on segment match
      if (segment === 'CULTURAL_ENTHUSIAST' && culturalCities.includes(city)) {
        score += userVector[1] * 0.3; // Culture dimension (index 1)
      } else if (segment === 'BEACH_LOVER' && beachCities.includes(city)) {
        score += userVector[0] * 0.3; // Beach/relaxation dimension (index 0)
      } else if (segment === 'ADVENTURE_SEEKER' && adventureCities.includes(city)) {
        score += userVector[2] * 0.3; // Adventure dimension (index 2)
      } else if (segment === 'BUSINESS_TRAVELER' && businessCities.includes(city)) {
        score += userVector[7] * 0.3; // Business/efficiency dimension
      } else if (segment === 'FAMILY_TRAVELER' && familyCities.includes(city)) {
        score += userVector[3] * 0.3; // Family-friendly dimension
      }

      // Add small randomness for variety
      score += Math.random() * 0.15;

      return { code: city, score };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Get destination suggestions based on user segment
   *
   * @param segment - User's travel segment
   * @returns Array of IATA city codes matching the segment
   */
  private getCitiesForSegment(segment: string): string[] {
    const cityBySegment: Record<string, string[]> = {
      'CULTURAL_ENTHUSIAST': ['PAR', 'ROM', 'BCN', 'ATH', 'PRG', 'VIE', 'FLR', 'IST', 'CAI', 'DEL'],
      'BEACH_LOVER': ['MIA', 'CUN', 'MLE', 'HNL', 'PUJ', 'BOB', 'PPT', 'NAN', 'BKK', 'DPS'],
      'ADVENTURE_SEEKER': ['DXB', 'SYD', 'YVR', 'CPT', 'QUI', 'CHC', 'NRT', 'BKK', 'GYE', 'BOG'],
      'BUSINESS_TRAVELER': ['LHR', 'FRA', 'JFK', 'SIN', 'HKG', 'DXB', 'CDG', 'ZRH', 'MUC', 'BRU'],
      'FAMILY_TRAVELER': ['MCO', 'LAX', 'BCN', 'ROM', 'DXB', 'CDG', 'LHR', 'LIS', 'MAD', 'BER'],
      'LUXURY_TRAVELER': ['DXB', 'SIN', 'MLE', 'SEZ', 'BOB', 'PPT', 'NAN', 'AUH', 'MIA', 'GVA'],
      'BUDGET_BACKPACKER': ['BKK', 'HAN', 'DEL', 'GYE', 'BOG', 'MEX', 'LIS', 'BUD', 'PNH', 'SGN'],
      'WELLNESS_SEEKER': ['UBD', 'CMB', 'KTM', 'SYD', 'SIN', 'BKK', 'RIX', 'CPH', 'REK', 'SEZ'],
      'ROMANTIC_COUPLE': ['PAR', 'VCE', 'SAV', 'BOB', 'MLE', 'SEZ', 'PPT', 'HNL', 'FLR', 'SAN'],
    };

    // Return segment-specific cities or default popular destinations
    return cityBySegment[segment] || ['PAR', 'LON', 'NYC', 'BCN', 'ROM', 'DXB', 'TYO', 'SYD'];
  }
}

export default ActivityRecommendationService;
