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
import { profileFetcherService } from './profile-fetcher.service';
import CacheService from '../../services/CacheService';
import { getABTestingService } from '../../services/ABTestingService';
import aiKafkaService from '../../services/KafkaService';
import {
  RecommendationOptions,
  RecommendationResponse,
  AccommodationFeatures,
  AccommodationCacheKey,
  ScoredAccommodation,
} from '../types/accommodation-vector.types';
import { parseCityNamesToIATA, isValidIATACode } from '../../shared/utils/city-iata-mapper';

// Configuration
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const VOYAGE_SERVICE_URL = process.env.VOYAGE_SERVICE_URL || 'http://localhost:3003';

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
  private cache = CacheService;

  constructor() {
    this.vectorizer = new AccommodationVectorizerService();
    this.scorer = new AccommodationScoringService();
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

    // Fetch user profile from database and merge with query params
    const dbProfile = await profileFetcherService.getRecommendationProfile(
      options.userId,
      options.userProfile
    );

    // Update options with merged profile (query params override database)
    options.userProfile = dbProfile;

    // Log user profile enrichment data with source indication
    console.log('[AccommodationRecommendation] User profile enrichment received:', {
      budgetMin: options.userProfile.budgetMin,
      budgetMax: options.userProfile.budgetMax,
      currency: options.userProfile.currency,
      travelStyle: options.userProfile.travelStyle,
      comfortLevel: options.userProfile.comfortLevel,
      travelGroupType: options.userProfile.travelGroupType,
      activityLevel: options.userProfile.activityLevel,
      accommodationTypes: options.userProfile.accommodationTypes,
      travelTypes: options.userProfile.travelTypes,
    });

    try {
      // Step 1: Fetch user vector and segment (needed for destination selection)
      const userVectorStart = Date.now();
      const { userVector, userSegment } = await this.fetchUserPreferences(options.userId);
      metrics.userVectorFetchTime = Date.now() - userVectorStart;

      if (!userVector || userVector.length !== 8) {
        // Fallback to popularity-only if user vector not available
        return await this.getFallbackRecommendations(options, metrics);
      }

      // Step 2.5: Determine cities to search (requested + 8 alternatives for buffer)
      let citiesToSearch: string[];
      let isMultiDestination = false;

      if (options.searchParams.cityCode) {
        // Always start with the requested city
        citiesToSearch = [options.searchParams.cityCode];

        // Add 8 alternative destinations from user profile (buffer in case some have no hotels)
        const alternatives = await this.selectAlternativeDestinations(
          options.userProfile.preferredDestinations || [],
          userVector,
          userSegment,
          options.searchParams.cityCode // Exclude current city
        );

        if (alternatives.length > 0) {
          citiesToSearch = [...citiesToSearch, ...alternatives.slice(0, 8)];
          isMultiDestination = true;
        }
      } else {
        // No requested city - suggest 9 destinations from profile (buffer for no results)
        citiesToSearch = await this.selectAlternativeDestinations(
          options.userProfile.preferredDestinations || [],
          userVector,
          userSegment,
          null // No exclusion
        );
        citiesToSearch = citiesToSearch.slice(0, 9);
        isMultiDestination = citiesToSearch.length > 1;
      }

      console.log(`[AccommodationRecommendation] Searching ${citiesToSearch.length} cities:`, citiesToSearch);

      // Step 3: Update cache key to include all cities
      const sortedCities = [...citiesToSearch].sort().join(',');
      const cacheKey = AccommodationCacheKey.forRecommendations(
        options.userId,
        sortedCities,
        options.searchParams.checkInDate
      );

      // Re-check cache with multi-city key
      if (this.cache && isMultiDestination) {
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

      // Step 4: Validate search parameters
      this.validateSearchParams(options.searchParams, options.userProfile);

      // Step 5: Search hotels in all cities (parallel)
      const amadeusStart = Date.now();

      const searchPromises = citiesToSearch.map(city =>
        this.searchHotels(
          { ...options.searchParams, cityCode: city },
          options.filters,
          options.userProfile
        )
          .catch(error => {
            console.error(`[AccommodationRecommendation] Failed to search hotels in ${city}:`, error.message);
            return []; // Graceful failure - continue with other cities
          })
      );

      const searchResults = await Promise.all(searchPromises);
      const hotels = searchResults.flat();

      metrics.amadeusSearchTime = Date.now() - amadeusStart;

      // Log hotels found per city
      const hotelsByCity = new Map<string, number>();
      for (let i = 0; i < citiesToSearch.length; i++) {
        hotelsByCity.set(citiesToSearch[i], searchResults[i]?.length || 0);
      }
      console.log(`[AccommodationRecommendation] Hotels found per city:`, Object.fromEntries(hotelsByCity));

      // Create a Map to preserve hotel-to-city association (hotelId → cityCode)
      // This is needed because the searchedCity field is lost during scoring
      const hotelCityMap = new Map<string, string>();
      for (let i = 0; i < searchResults.length; i++) {
        const city = citiesToSearch[i];
        const cityHotels = searchResults[i] || [];
        for (const hotel of cityHotels) {
          if (hotel.hotelId) {
            hotelCityMap.set(hotel.hotelId, city);
          }
        }
      }
      console.log(`[AccommodationRecommendation] Created hotelCityMap with ${hotelCityMap.size} entries`);

      // Debug: Log sample hotelCityMap entries
      const sampleEntries = Array.from(hotelCityMap.entries()).slice(0, 3);
      console.log('[AccommodationRecommendation] Sample hotelCityMap entries:',
        sampleEntries.map(([id, city]) => ({ hotelId: id, city, idType: typeof id, idLength: id.length }))
      );

      if (hotels.length === 0) {
        console.warn('[AccommodationRecommendation] No hotels found for search:', {
          cityCode: options.searchParams.cityCode,
          checkInDate: options.searchParams.checkInDate,
          checkOutDate: options.searchParams.checkOutDate,
          budgetMin: options.userProfile?.budgetMin,
          budgetMax: options.userProfile?.budgetMax,
          filters: options.filters
        });

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

      // Step 5: Vectorize hotels
      const vectorizationStart = Date.now();

      // City to country mapping (same as in vectorizer)
      const CITY_TO_COUNTRY: Record<string, string> = {
        NYC: 'US', LAX: 'US', MIA: 'US', CHI: 'US', SFO: 'US',
        LON: 'GB', PAR: 'FR', BCN: 'ES', ROM: 'IT', BER: 'DE', AMS: 'NL', VIE: 'AT',
        TOK: 'JP', KYO: 'JP', SEL: 'KR', BKK: 'TH', SIN: 'SG', HKG: 'HK',
        SYD: 'AU', DXB: 'AE', DEL: 'IN', BOM: 'IN',
      };

      const hotelsWithVectors = hotels.map(hotel => {
        // Enrich hotel with cityCode from hotelCityMap (preserve multi-city context)
        const cityCode = hotelCityMap.get(hotel.hotelId) || hotel.location?.cityCode;
        const country = hotel.location?.country || CITY_TO_COUNTRY[cityCode || ''] || 'Unknown';

        const enrichedHotel = {
          ...hotel,
          location: {
            ...hotel.location,
            cityCode,
            city: hotel.location?.city || cityCode, // Fallback to cityCode if city name missing
            country, // Add country from cityCode mapping
          }
        };

        return {
          features: enrichedHotel,
          vector: this.vectorizer.vectorize(enrichedHotel),
        };
      });
      metrics.vectorizationTime = Date.now() - vectorizationStart;

      // Debug: Log hotelId preservation after vectorization
      const sampleHotels = hotelsWithVectors.slice(0, 3);
      console.log('[AccommodationRecommendation] Sample hotels after vectorization:',
        sampleHotels.map(h => ({
          hotelId: h.features.hotelId,
          name: h.features.name,
          city: h.features.location?.city,
          idType: typeof h.features.hotelId,
        }))
      );

      // Step 6: Determine model strategy (US-IA-014 A/B Testing)
      const abTestService = getABTestingService();
      const useMLModel = abTestService.shouldUseMLModel(options.userId);

      // Configure scorer with ML mode if enabled
      if (useMLModel) {
        this.scorer.updateConfig({ useMLModel: true });
      }

      // Step 5.5: Score and rank ALL hotels together
      const scoringStart = Date.now();
      const allScoredHotels = await this.scorer.scoreAccommodations(
        userVector,
        userSegment,
        hotelsWithVectors,
        100, // Get top 100 to choose from
        undefined, // userHistory - TODO: fetch from Kafka
        options.userId // Required for ML mode
      );
      metrics.scoringTime = Date.now() - scoringStart;

      // Reset scorer config to default
      this.scorer.updateConfig({ useMLModel: false });

      // Step 5.6: Select top 1 hotel per city (ensure diversity)
      let finalRecommendations: ScoredAccommodation[];
      const usedCities = new Set<string>();

      if (isMultiDestination && citiesToSearch.length > 1) {
        // Multi-destination mode: select best hotel from each city
        finalRecommendations = [];

        // Debug: Log scored hotels structure
        if (allScoredHotels.length > 0) {
          const sample = allScoredHotels[0];
          console.log('[AccommodationRecommendation] Sample scored hotel structure:', {
            hotelId: sample.accommodation.hotelId,
            name: sample.accommodation.name,
            city: sample.accommodation.location?.city,
            idType: typeof sample.accommodation.hotelId,
            lookupResult: hotelCityMap.get(sample.accommodation.hotelId),
          });
        }

        for (const city of citiesToSearch) {
          // Stop if we already have 3 recommendations
          if (finalRecommendations.length >= 3) {
            console.log(`[AccommodationRecommendation] ✅ Already have 3 recommendations, stopping search`);
            break;
          }

          // Find all hotels from this city using hotelCityMap (preserves city association)
          // Fallback: Also try matching by location.cityCode if hotelId lookup fails
          const cityHotels = allScoredHotels.filter(h => {
            const mappedCity = hotelCityMap.get(h.accommodation.hotelId);
            if (mappedCity === city) return true;

            // Fallback: Try matching by cityCode from location
            if (!mappedCity && h.accommodation.location?.cityCode === city) {
              console.log(`[AccommodationRecommendation] Using cityCode fallback for hotel ${h.accommodation.hotelId}`);
              return true;
            }

            return false;
          });

          if (cityHotels.length > 0) {
            finalRecommendations.push(cityHotels[0]); // Add top hotel from this city
            usedCities.add(city);
            console.log(`[AccommodationRecommendation] ✅ Found ${cityHotels.length} hotels for city ${city}`);
          } else {
            console.warn(`[AccommodationRecommendation] ❌ No hotels found for city ${city} after scoring`);
            // Debug: Show why lookup failed
            console.warn(`[AccommodationRecommendation] Debug for ${city}:`, {
              totalScoredHotels: allScoredHotels.length,
              hotelCityMapSize: hotelCityMap.size,
              sampleScoredHotelIds: allScoredHotels.slice(0, 3).map(h => ({
                id: h.accommodation.hotelId,
                city: hotelCityMap.get(h.accommodation.hotelId) || 'NOT_FOUND',
              })),
            });
          }
        }

        console.log(`[AccommodationRecommendation] Selected ${finalRecommendations.length} hotels from ${usedCities.size} cities`);
      } else {
        // Single destination mode: return top N hotels
        finalRecommendations = allScoredHotels.slice(0, options.limit || 3);
      }

      // Step 6: Build response
      metrics.totalTime = Date.now() - startTime;

      const response: RecommendationResponse = {
        userId: options.userId,
        count: finalRecommendations.length,
        recommendations: finalRecommendations,
        metadata: {
          processingTime: metrics.totalTime,
          strategy: isMultiDestination ? 'multi_destination' : (useMLModel ? 'ml_hybrid' : 'rule_based'),
          cacheHit: false,
          amadeusResponseTime: metrics.amadeusSearchTime,
          scoringTime: metrics.scoringTime,
          citiesSearched: citiesToSearch,
          citiesWithResults: Array.from(usedCities),
        },
      };

      // Step 6.5: Publish A/B test event (US-IA-014)
      try {
        await aiKafkaService.publishModelInference({
          userId: options.userId,
          requestId: `rec-${Date.now()}`,
          modelType: useMLModel ? 'svd_v1.0' : 'rule_based',
          latency: metrics.scoringTime,
          topScore: finalRecommendations[0]?.score || 0,
          fromCache: false,
          timestamp: new Date(),
        });
      } catch (kafkaError) {
        console.warn('[Kafka] Failed to publish model inference event:', kafkaError);
        // Non-critical, continue
      }

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
   * Create default user vector for new users
   *
   * When a user hasn't completed onboarding, we create a neutral 8D vector
   * that allows them to still receive recommendations based on popularity.
   */
  private async createDefaultUserVector(userId: string): Promise<number[]> {
    const defaultVector = [
      0.6,  // Climate: Slightly warm preference
      0.5,  // Culture vs Nature: Balanced
      0.4,  // Budget: Mid-range
      0.5,  // Activity level: Moderate
      0.5,  // Travel group: Mixed
      0.6,  // Urban vs Rural: Slightly urban
      0.5,  // Gastronomy: Everyone likes food
      0.6,  // Popularity: Slightly mainstream
    ];

    try {
      console.log(`[AccommodationRecommendation] Creating default UserVector for ${userId}`);

      await prisma.userVector.create({
        data: {
          userId,
          vector: defaultVector,
          version: 1,
          source: 'default_fallback',
          primarySegment: 'CULTURAL_ENTHUSIAST',
        },
      });

      console.log(`[AccommodationRecommendation] ✅ Default UserVector created for ${userId}`);
    } catch (error: any) {
      // Ignore unique constraint errors (vector already exists)
      if (error.code !== 'P2002') {
        console.error(`[AccommodationRecommendation] Failed to save default vector:`, error);
      }
    }

    return defaultVector;
  }

  /**
   * Check if an error is retryable
   *
   * Retries are allowed for:
   * - Network errors (ETIMEDOUT, ECONNREFUSED, ECONNABORTED, ENOTFOUND)
   * - 5xx server errors
   * - 429 Too Many Requests
   *
   * NOT retried:
   * - 4xx client errors (except 429)
   * - Validation errors
   */
  private isRetryableError(error: any): boolean {
    // Network/timeout errors
    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET'
    ) {
      return true;
    }

    // HTTP status errors
    if (error.response?.status) {
      const status = error.response.status;
      // Retry 5xx and 429
      return status >= 500 || status === 429;
    }

    return false;
  }

  /**
   * Call Voyage service with retry logic
   *
   * Implements exponential backoff:
   * - Attempt 1: immediate
   * - Attempt 2: wait 1s
   * - Attempt 3: wait 2s
   */
  private async callVoyageServiceWithRetry(
    params: any,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AccommodationRecommendation] 📡 Attempt ${attempt}/${maxRetries} to Voyage service`);

        const response = await axios.get(`${VOYAGE_SERVICE_URL}/api/hotels/search`, {
          params,
          headers: { 'X-Internal-Service': 'ai-service' },
          timeout: 10000, // 10s timeout
        });

        console.log(`[AccommodationRecommendation] ✅ Voyage service responded on attempt ${attempt}`);
        return response;
      } catch (error: any) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = this.isRetryableError(error);

        console.error(
          `[AccommodationRecommendation] ❌ Voyage service error (attempt ${attempt}/${maxRetries}):`,
          error.message || error.code
        );

        // Don't retry if not retryable OR if it's the last attempt
        if (!isRetryable || isLastAttempt) {
          throw error;
        }

        // Exponential backoff: 2^(attempt-1) * 1000ms
        const backoffDelay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[AccommodationRecommendation] ⏳ Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError;
  }

  /**
   * Fetch user preferences (vector + segment)
   * NEVER throws errors - creates default vector if needed
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

      // If no UserVector exists, create a default one
      if (!userVector || !userVector.vector || (userVector.vector as number[]).length !== 8) {
        console.log(`[AccommodationRecommendation] No valid UserVector for ${userId}, creating default`);
        const finalVector = await this.createDefaultUserVector(userId);
        return {
          userVector: finalVector,
          userSegment: 'CULTURAL_ENTHUSIAST',
        };
      }

      const vectorArray = userVector.vector as number[];
      console.log(`[AccommodationRecommendation] UserVector retrieved:`, {
        length: vectorArray.length,
        values: vectorArray,
        hasNaN: vectorArray.some(v => isNaN(v)),
        segment: userVector.primarySegment
      });

      return {
        userVector: vectorArray,
        userSegment: userVector.primarySegment || 'CULTURAL_ENTHUSIAST',
      };
    } catch (error) {
      console.error(`[AccommodationRecommendation] Failed to fetch user preferences for ${userId}:`, error);

      // Ultimate fallback: return neutral vector in memory (don't throw!)
      console.warn(`[AccommodationRecommendation] Using in-memory fallback vector for ${userId}`);
      return {
        userVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        userSegment: 'CULTURAL_ENTHUSIAST',
      };
    }
  }

  /**
   * Validate search parameters before making Amadeus API call
   *
   * @param searchParams - Search parameters
   * @param userProfile - User profile data
   */
  private validateSearchParams(
    searchParams: {
      cityCode: string;
      checkInDate: string;
      checkOutDate: string;
      adults: number;
    },
    userProfile?: {
      budgetMin?: number;
      budgetMax?: number;
      currency?: string;
    }
  ): void {
    // Validate dates
    const checkIn = new Date(searchParams.checkInDate);
    const checkOut = new Date(searchParams.checkOutDate);

    if (checkOut <= checkIn) {
      console.warn('[AccommodationRecommendation] Invalid date range:', {
        checkIn: searchParams.checkInDate,
        checkOut: searchParams.checkOutDate
      });
    }

    // Validate budget range if provided
    if (userProfile?.budgetMin !== undefined && userProfile?.budgetMax !== undefined) {
      if (userProfile.budgetMin < 0 || userProfile.budgetMax < 0) {
        console.warn('[AccommodationRecommendation] Invalid budget: negative values', {
          budgetMin: userProfile.budgetMin,
          budgetMax: userProfile.budgetMax
        });
      }

      if (userProfile.budgetMin > userProfile.budgetMax) {
        console.warn('[AccommodationRecommendation] Invalid budget range: min > max', {
          budgetMin: userProfile.budgetMin,
          budgetMax: userProfile.budgetMax
        });
      }
    }

    // Validate adults count
    if (searchParams.adults < 1 || searchParams.adults > 10) {
      console.warn('[AccommodationRecommendation] Unusual adults count:', searchParams.adults);
    }
  }

  /**
   * Search hotels via Amadeus API
   *
   * @param searchParams - Search parameters
   * @param filters - Optional filters
   * @param userProfile - User profile for budget constraints
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
    },
    userProfile?: {
      budgetMin?: number;
      budgetMax?: number;
      currency?: string;
    }
  ): Promise<AccommodationFeatures[]> {
    try {
      // Calculate number of nights
      const checkIn = new Date(searchParams.checkInDate);
      const checkOut = new Date(searchParams.checkOutDate);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

      // Calculate budget per night (user's budget is typically for entire trip)
      let budgetPerNightMin: number | undefined;
      let budgetPerNightMax: number | undefined;

      if (userProfile?.budgetMin) {
        budgetPerNightMin = Math.floor(userProfile.budgetMin / nights);
      }

      if (userProfile?.budgetMax) {
        budgetPerNightMax = Math.floor(userProfile.budgetMax / nights);
      }

      // Apply budget constraints
      // IMPORTANT: Use budget per night, NOT filters.maxPrice (which is often the total budget)
      const maxPrice = budgetPerNightMax || filters?.maxPrice;
      const minPrice = budgetPerNightMin;

      // Build price range
      let priceRange: string | undefined;
      if (maxPrice) {
        priceRange = `${minPrice || 0}-${maxPrice}`;
      }

      // Build search parameters
      const params: any = {
        cityCode: searchParams.cityCode,
        checkInDate: searchParams.checkInDate,
        checkOutDate: searchParams.checkOutDate,
        adults: searchParams.adults,
        children: searchParams.children,
        roomQuantity: searchParams.rooms || 1,
        // Filtres optionnels
        ratings: filters?.minRating ? [filters.minRating] : undefined,
        priceRange: priceRange,
        amenities: filters?.requiredAmenities,
      };

      // Log search constraints for debugging
      console.log('[AccommodationRecommendation] Searching hotels with params:', {
        cityCode: params.cityCode,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        adults: params.adults,
        rooms: params.roomQuantity,
        nights: nights,
        totalBudget: userProfile?.budgetMax,
        budgetPerNight: budgetPerNightMax,
        priceRange: params.priceRange,
        budgetSource: maxPrice ? (filters?.maxPrice ? 'filters' : 'userProfile') : 'none'
      });

      // Call Voyage service with retry logic
      const response = await this.callVoyageServiceWithRetry(params);
      const hotels = response.data.data || [];

      // Log Amadeus response
      console.log('[AccommodationRecommendation] Amadeus response:', {
        status: response.status,
        hotelsFound: hotels.length,
        withBudgetConstraint: !!priceRange
      });

      // If no hotels found with budget constraint, try without budget
      if (hotels.length === 0 && priceRange) {
        console.warn('[AccommodationRecommendation] No hotels found with budget constraint, retrying without budget...');

        const paramsWithoutBudget = { ...params, priceRange: undefined };
        const fallbackResponse = await this.callVoyageServiceWithRetry(paramsWithoutBudget);
        const fallbackHotels = fallbackResponse.data.data || [];

        console.log('[AccommodationRecommendation] Fallback search (no budget):', {
          hotelsFound: fallbackHotels.length
        });

        // Use fallback results if available
        if (fallbackHotels.length > 0) {
          return fallbackHotels.map((hotel: any) =>
            this.vectorizer.transformAmadeusToFeatures(hotel, searchParams.cityCode)
          );
        }
      }

      // Transform Amadeus response to AccommodationFeatures
      return hotels.map((hotel: any) =>
        this.vectorizer.transformAmadeusToFeatures(hotel, searchParams.cityCode)
      );
    } catch (error: any) {
      console.error('[AccommodationRecommendation] Hotel search failed after retries:', error.message);
      throw new Error('Failed to search hotels: ' + (error.message || 'Unknown error'));
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

    // Check Voyage service
    try {
      await axios.get(`${VOYAGE_SERVICE_URL}/health`, { timeout: 2000 });
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

  // ==========================================================================
  // MULTI-DESTINATION SELECTION
  // ==========================================================================

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

    // 4. Deduplicate and exclude current city
    const uniqueCandidates = [...new Set(candidates)].filter(
      city => city !== excludeCity && isValidIATACode(city)
    );

    if (uniqueCandidates.length === 0) {
      // Fallback to default cities if no candidates
      console.warn('[AccommodationRecommendation] No valid destination candidates, using defaults');
      return ['PAR', 'LON', 'BCN'].filter(c => c !== excludeCity);
    }

    // 5. Score each destination using user vector
    const scored = this.scoreDestinations(uniqueCandidates, userVector, segment);

    // 6. Return top scored destinations
    const topDestinations = scored.slice(0, 10).map(d => d.code);

    console.log(`[AccommodationRecommendation] Selected alternative destinations:`, topDestinations.slice(0, 3));

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

export default AccommodationRecommendationService;
