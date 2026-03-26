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
 * IATA Airline Code Validator and Normalizer
 *
 * Maps common airline names to their 2-letter IATA codes and validates format.
 * Only valid 2-letter uppercase codes are accepted by Amadeus API.
 */
const AIRLINE_NAME_TO_IATA: Record<string, string> = {
  'Air France': 'AF',
  'KLM Royal Dutch Airlines': 'KL',
  'KLM': 'KL',
  'British Airways': 'BA',
  'Lufthansa': 'LH',
  'Emirates': 'EK',
  'Qatar Airways': 'QR',
  'Singapore Airlines': 'SQ',
  'Cathay Pacific': 'CX',
  'Japan Airlines': 'JL',
  'ANA': 'NH',
  'United Airlines': 'UA',
  'American Airlines': 'AA',
  'Delta Air Lines': 'DL',
  'Southwest Airlines': 'WN',
  'Turkish Airlines': 'TK',
  'Etihad Airways': 'EY',
  'Air Canada': 'AC',
  'Qantas': 'QF',
  'Virgin Atlantic': 'VS',
};

/**
 * Validates and normalizes airline codes to IATA format
 *
 * @param airlineCodes - Array of airline codes or names
 * @returns Deduplicated array of valid 2-letter IATA codes
 */
function validateAndNormalizeAirlineCodes(airlineCodes: string[]): string[] {
  const validCodes = new Set<string>();

  for (const code of airlineCodes) {
    if (!code || typeof code !== 'string') continue;

    const trimmed = code.trim();

    // Check if it's a valid 2-character IATA code (2 letters OR 2 digits, not mixed)
    // Valid: AF, KL, 3M, etc. | Invalid: 6X, A3, 1Z, etc.
    if (/^[A-Z]{2}$/i.test(trimmed) || /^[0-9]{2}$/.test(trimmed)) {
      validCodes.add(trimmed.toUpperCase());
      continue;
    }

    // Try to map full airline name to IATA code
    const iataCode = AIRLINE_NAME_TO_IATA[trimmed];
    if (iataCode) {
      validCodes.add(iataCode);
      continue;
    }

    console.warn(`[FlightRecommendation] Invalid airline code ignored: "${code}" (must be 2-letter IATA)`);
  }

  return Array.from(validCodes);
}

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
      // Step 1: Fetch user vector, segment, favorites, and preferences FIRST
      // (needed for destination suggestion)
      // Note: fetchUserPreferences() NEVER throws - it creates a default vector if needed
      const userVectorStart = Date.now();
      const { userVector, userSegment, favorites, preferences } = await this.fetchUserPreferences(options.userId);
      metrics.userVectorFetchTime = Date.now() - userVectorStart;

      // fetchUserPreferences() guarantees a valid 8D vector, so no need to check
      console.log(`[FlightRecommendation] UserVector retrieved: ${userVector.length}D, segment: ${userSegment}`);

      // Step 2: Determine destinations to search
      let destinationsToSearch: string[];
      let isAutoSuggested = false;

      if (options.searchParams.destinations && options.searchParams.destinations.length > 0) {
        // Priority 1: Explicit destinations array provided
        destinationsToSearch = options.searchParams.destinations;
        console.log(`[FlightRecommendation] Using explicit destinations:`, destinationsToSearch);
      } else if (options.searchParams.destination) {
        // Priority 2: Single destination + auto-suggest alternatives
        destinationsToSearch = [options.searchParams.destination];

        // Add 2 alternative destinations based on user profile
        const alternatives = await this.suggestDestinations(
          options.userId,
          options.searchParams.origin,
          userVector,
          userSegment,
          favorites
        );

        // Filter out the requested destination from alternatives and add top 4
        // We search 5 destinations to ensure 3 have results (some may return 0 flights)
        const filteredAlternatives = alternatives.filter(
          dest => dest !== options.searchParams.destination
        ).slice(0, 4);

        if (filteredAlternatives.length > 0) {
          destinationsToSearch = [...destinationsToSearch, ...filteredAlternatives];
          console.log(`[FlightRecommendation] Using requested destination + alternatives:`, destinationsToSearch);
        } else {
          console.log(`[FlightRecommendation] Using single destination:`, options.searchParams.destination);
        }
      } else {
        // Priority 3: Auto-suggest destinations based on user profile
        destinationsToSearch = await this.suggestDestinations(
          options.userId,
          options.searchParams.origin,
          userVector,
          userSegment,
          favorites
        );
        isAutoSuggested = true;
        console.log(`[FlightRecommendation] Auto-suggested destinations:`, destinationsToSearch);
      }

      // Search up to 5 destinations to ensure we get 3 with results (some may return 0 flights)
      destinationsToSearch = destinationsToSearch.slice(0, 5);

      // Step 3: Build cache key based on destinations
      const sortedDests = [...destinationsToSearch].sort().join(',');
      const cacheKey = isAutoSuggested
        ? `flight:${options.userId}:${options.searchParams.origin}:suggested:${options.searchParams.departureDate}`
        : `flight:${options.userId}:${options.searchParams.origin}:${sortedDests}:${options.searchParams.departureDate}`;

      // Check cache
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

      // Step 4: Enrich search filters with user preferences
      const enrichedFilters = {
        ...options.filters,
        // Add preferred airlines to filters if available (validated and deduplicated)
        airlines: preferences?.preferredAirlines?.length
          ? validateAndNormalizeAirlineCodes([
              ...(options.filters?.airlines || []),
              ...preferences.preferredAirlines,
            ])
          : options.filters?.airlines
          ? validateAndNormalizeAirlineCodes(options.filters.airlines)
          : undefined,
        // Add budget constraint if available
        maxPrice: preferences?.budgetRange?.max || options.filters?.maxPrice,
      };

      // Step 5: Search flights for all destinations in parallel (fan-out)
      const amadeusStart = Date.now();

      console.log(`[FlightRecommendation] Searching flights for ${destinationsToSearch.length} destination(s)...`);

      const searchPromises = destinationsToSearch.map(dest =>
        this.searchFlights(
          { ...options.searchParams, destination: dest },
          enrichedFilters
        )
          .then(flights => {
            // Tag each flight with its destination for later filtering
            return flights.map(flight => ({
              ...flight,
              searchedDestination: dest,
            }));
          })
          .catch(error => {
            console.error(`[FlightRecommendation] Failed to search flights to ${dest}:`, error.message);
            return []; // Return empty array on failure, don't fail the entire request
          })
      );

      const searchResults = await Promise.all(searchPromises);

      // Log flights found per destination
      const flightsByDestination = new Map<string, number>();
      for (let i = 0; i < destinationsToSearch.length; i++) {
        flightsByDestination.set(destinationsToSearch[i], searchResults[i]?.length || 0);
      }
      console.log(`[FlightRecommendation] Flights found per destination:`, Object.fromEntries(flightsByDestination));

      // Aggregate all flights from successful searches
      const flights = searchResults.flat();

      metrics.amadeusSearchTime = Date.now() - amadeusStart;

      console.log(`[FlightRecommendation] Found ${flights.length} total flights across ${destinationsToSearch.length} destination(s)`);

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

      // Step 5: Vectorize flights
      const vectorizationStart = Date.now();
      const flightsWithVectors = flights.map(flight => ({
        features: flight,
        vector: this.vectorizer.vectorize(flight),
      }));
      metrics.vectorizationTime = Date.now() - vectorizationStart;

      // Step 5.5: Merge user profile into tripContext (fill in missing fields)
      const mergedTripContext = this.mergeUserProfileToContext(
        options.tripContext,
        userVector,
        preferences
      );

      // Step 6: Score and rank with enriched context
      const scoringStart = Date.now();
      const allScoredFlights = await this.scorer.scoreFlights(
        userVector,
        userSegment,
        flightsWithVectors,
        {
          ...mergedTripContext,
          // Add favorite destinations to boost similar routes
          favoriteDestinations: favorites?.destinations,
          // Add preferred airlines for boosting
          preferredAirlines: preferences?.preferredAirlines,
        },
        100 // Get top 100 to choose from
      );
      metrics.scoringTime = Date.now() - scoringStart;

      // Step 6.5: Select top 1 flight per destination (ensure diversity)
      let finalRecommendations: any[];
      const usedDestinations = new Set<string>();
      const isMultiDestination = destinationsToSearch.length > 1;

      if (isMultiDestination) {
        // Multi-destination mode: select best flight to each destination
        finalRecommendations = [];

        // Debug: Log sample flight structure
        if (allScoredFlights.length > 0) {
          const sample = allScoredFlights[0];
          console.log('[FlightRecommendation] Sample scored flight structure:', {
            hasSearchedDestination: !!(sample.flight as any).searchedDestination,
            searchedDestination: (sample.flight as any).searchedDestination,
            actualDestination: sample.flight.route?.destination,
            arrivalAirport: sample.flight.segments?.[0]?.arrival?.airportCode,
          });
        }

        for (const dest of destinationsToSearch) {
          // Stop when we have 3 destinations with results
          if (finalRecommendations.length >= 3) break;

          // Find all flights to this destination
          const destFlights = allScoredFlights.filter(
            f => (f.flight as any).searchedDestination === dest
          );

          if (destFlights.length > 0) {
            finalRecommendations.push(destFlights[0]); // Add top flight to this destination
            usedDestinations.add(dest);
            console.log(`[FlightRecommendation] ✅ Found ${destFlights.length} flights for destination ${dest}`);
          } else {
            console.warn(`[FlightRecommendation] ❌ No flights found for destination ${dest} after scoring`);
          }
        }

        console.log(`[FlightRecommendation] Selected ${finalRecommendations.length} flights to ${usedDestinations.size} destinations`);
      } else {
        // Single destination mode: return top N flights
        finalRecommendations = allScoredFlights.slice(0, options.limit || 10);
      }

      // Step 7: Build response
      metrics.totalTime = Date.now() - startTime;

      const response: FlightRecommendationResponse = {
        userId: options.userId,
        count: finalRecommendations.length,
        recommendations: finalRecommendations,
        metadata: {
          processingTime: metrics.totalTime,
          strategy: isMultiDestination ? 'multi_destination' : 'hybrid_with_favorites',
          cacheHit: false,
          amadeusResponseTime: metrics.amadeusSearchTime,
          scoringTime: metrics.scoringTime,
          destinationsSearched: isMultiDestination ? destinationsToSearch : undefined,
          destinationsWithResults: isMultiDestination ? Array.from(usedDestinations) : undefined,
          favoritesUsed: favorites ? {
            destinations: favorites.destinations.length,
            airlines: preferences?.preferredAirlines?.length || 0,
          } : undefined,
        },
        context: {
          totalFlightsFound: flights.length,
          filteredFlights: allScoredFlights.length,
          averagePrice: this.calculateAveragePrice(flights),
          priceRange: this.calculatePriceRange(flights),
          airlines: [...new Set(flights.map(f => f.airline.name))],
          fastestFlight: this.getFastestFlight(flights),
          cheapestFlight: this.getCheapestFlight(flights),
        },
      };

      // Step 8: Cache results
      if (this.cache) {
        await this.cacheRecommendations(cacheKey, response, 1800); // 30 min TTL
      }

      // Step 9: Log metrics
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
   * Provides specific error strategies for better frontend handling
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
    } catch (fallbackError: any) {
      console.error('[FlightRecommendation] Fallback also failed:', fallbackError);

      // Determine specific error strategy for frontend
      let strategy = 'failed';
      let errorMessage = 'Failed to fetch flight recommendations';

      // Check for specific error types
      if (fallbackError.code === 'ETIMEDOUT' || fallbackError.message?.includes('timeout')) {
        strategy = 'voyage_timeout';
        errorMessage = 'Flight search service timeout';
      } else if (fallbackError.response?.status === 400) {
        strategy = 'invalid_params';
        errorMessage = 'Invalid flight search parameters';
      } else if (fallbackError.response?.status >= 500) {
        strategy = 'voyage_error';
        errorMessage = 'Flight search service error';
      } else if (fallbackError.message?.includes('Failed to search flights')) {
        strategy = 'amadeus_error';
        errorMessage = fallbackError.message;
      }

      return {
        userId: options.userId,
        count: 0,
        recommendations: [],
        metadata: {
          processingTime: Date.now(),
          strategy,
          error: errorMessage,
          cacheHit: false,
        } as any,
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
      console.log(`[FlightRecommendation] Creating default UserVector for ${userId}`);

      await prisma.userVector.create({
        data: {
          userId,
          vector: defaultVector,
          version: 1,
          source: 'default_fallback',
          primarySegment: 'CULTURAL_ENTHUSIAST',
        },
      });

      console.log(`[FlightRecommendation] ✅ Default UserVector created for ${userId}`);
    } catch (error: any) {
      // Ignore unique constraint errors (vector already exists)
      if (error.code !== 'P2002') {
        console.error(`[FlightRecommendation] Failed to save default vector:`, error);
      }
    }

    return defaultVector;
  }

  /**
   * Merge user profile data into trip context
   *
   * This method fills in missing tripContext fields using data from:
   * - UserVector (8-dimensional preference vector)
   * - UserPreferences (budget, airlines, cabin class)
   *
   * Fallback logic:
   * - If frontend provides a value, use it
   * - Otherwise, derive from UserVector or UserPreferences
   * - This ensures recommendations are always personalized
   *
   * UserVector dimensions:
   * [0] climate: 0=cold → 1=tropical
   * [1] cultureNature: 0=nature → 1=culture
   * [2] budget: 0=economy → 1=luxury
   * [3] activityLevel: 0=relaxed/direct → 1=adventurous/connections ok
   * [4] groupSize: 0=solo → 1=large groups
   * [5] urbanRural: 0=rural → 1=urban
   * [6] gastronomy: (not applicable for flights)
   * [7] popularity: Airline quality + route popularity
   */
  private mergeUserProfileToContext(
    tripContext: any | undefined,
    userVector: number[],
    preferences: any
  ): any {
    // If no tripContext provided, start with empty object
    const context = tripContext || {};

    return {
      ...context,

      // Budget: Use from preferences if not already provided
      budgetPerPerson: context.budgetPerPerson
        || preferences?.budgetRange?.max
        || undefined,

      // Activity level: Derive from userVector[3]
      // [3] = activityLevel: 0=relaxed/direct flights, 1=adventurous/connections ok
      // If activityLevel < 0.5, user prefers direct flights
      preferDirectFlights: context.preferDirectFlights !== undefined
        ? context.preferDirectFlights
        : (userVector[3] !== undefined && userVector[3] < 0.5),

      // Cabin class: Derive from userVector[2] (budget dimension)
      // [2] = budget: 0=economy, 0.5=premium economy, 0.75=business, 1=first class
      // Only set if not already provided
      preferredCabinClass: context.preferredCabinClass
        || preferences?.preferredCabinClass
        || (userVector[2] !== undefined
          ? (userVector[2] >= 0.75 ? 'BUSINESS'
            : userVector[2] >= 0.5 ? 'PREMIUM_ECONOMY'
            : 'ECONOMY')
          : undefined),

      // Keep all other context fields as-is
      tripPurpose: context.tripPurpose,
      maxLayoverTime: context.maxLayoverTime,
      preferredDepartureTime: context.preferredDepartureTime,
      flexibilityLevel: context.flexibilityLevel,
    };
  }

  /**
   * Fetch user preferences from database
   *
   * Retrieves:
   * - UserVector (ML-based 8D preferences)
   * - User segment (FAMILY_EXPLORER, CULTURAL_ENTHUSIAST, etc.)
   * - Favorites (destinations, airlines, hotels, activities)
   * - UserPreferences (preferred airlines, cabin class, budget)
   *
   * These enriched preferences help the AI:
   * - Prioritize favorite destinations and airlines
   * - Respect budget constraints
   * - Match cabin class preferences
   * - Recommend similar places to favorited hotels/activities
   *
   * NEVER throws errors - creates default vector if needed
   */
  private async fetchUserPreferences(
    userId: string
  ): Promise<{
    userVector: number[];
    userSegment: string;
    favorites?: {
      destinations: string[];
      airlines: string[];
      hotels: string[];
      activities: string[];
    };
    preferences?: {
      preferredAirlines: string[];
      preferredCabinClass?: string;
      budgetRange?: { min: number; max: number };
    };
  }> {
    try {
      // Fetch user vector, favorites, and preferences in parallel
      const [userVector, favorites, userPreferences] = await Promise.all([
        // Get user vector and segment
        prisma.userVector.findUnique({
          where: { userId },
          select: {
            vector: true,
            primarySegment: true,
          },
        }),

        // Get user favorites
        prisma.favorite.findMany({
          where: { userId },
          select: {
            entityType: true,
            entityId: true,
            entityData: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50, // Limit to recent favorites
        }),

        // Get user preferences
        prisma.userPreferences.findUnique({
          where: { userId },
          select: {
            preferredAirlines: true,
            preferredCabinClass: true,
            budgetRange: true,
          },
        }),
      ]);

      // If no UserVector exists, create a default one
      let finalVector: number[];
      let finalSegment: string;

      if (!userVector || !userVector.vector || (userVector.vector as number[]).length !== 8) {
        console.log(`[FlightRecommendation] No valid UserVector for ${userId}, creating default`);
        finalVector = await this.createDefaultUserVector(userId);
        finalSegment = 'CULTURAL_ENTHUSIAST';
      } else {
        finalVector = userVector.vector as number[];
        finalSegment = userVector.primarySegment || 'CULTURAL_ENTHUSIAST';
      }

      // Process favorites by type
      type FavoriteItem = { entityType: string; entityId: string; entityData: any };

      const processedFavorites = {
        destinations: favorites
          .filter((f: FavoriteItem) => f.entityType === 'DESTINATION')
          .map((f: FavoriteItem) => f.entityId),

        airlines: validateAndNormalizeAirlineCodes([
          // From favorite flights
          ...favorites
            .filter((f: FavoriteItem) => f.entityType === 'FLIGHT')
            .map((f: FavoriteItem) => {
              const flightData = f.entityData as any;
              return flightData?.airline || flightData?.carrierCode;
            })
            .filter(Boolean) as string[],
        ]),

        hotels: favorites
          .filter((f: FavoriteItem) => f.entityType === 'HOTEL')
          .map((f: FavoriteItem) => f.entityId),

        activities: favorites
          .filter((f: FavoriteItem) => f.entityType === 'ACTIVITY')
          .map((f: FavoriteItem) => f.entityId),
      };

      // Process preferences (merge with favorites)
      const processedPreferences = {
        preferredAirlines: validateAndNormalizeAirlineCodes([
          ...(userPreferences?.preferredAirlines || []),
          ...processedFavorites.airlines,
        ]),
        preferredCabinClass: userPreferences?.preferredCabinClass || undefined,
        budgetRange: userPreferences?.budgetRange
          ? (userPreferences.budgetRange as { min: number; max: number })
          : undefined,
      };

      console.log(`[FlightRecommendation] Fetched enriched preferences for user ${userId}:`, {
        hasVector: true,
        segment: finalSegment,
        favoritesCount: favorites.length,
        favoriteDestinations: processedFavorites.destinations.length,
        favoriteAirlines: processedPreferences.preferredAirlines.length,
        hasPreferences: !!userPreferences,
        budgetRange: processedPreferences.budgetRange,
      });

      return {
        userVector: finalVector,
        userSegment: finalSegment,
        favorites: processedFavorites,
        preferences: processedPreferences,
      };
    } catch (error) {
      console.error(`[FlightRecommendation] Failed to fetch user preferences for ${userId}:`, error);

      // Ultimate fallback: return neutral vector in memory (don't throw!)
      console.warn(`[FlightRecommendation] Using in-memory fallback vector for ${userId}`);
      return {
        userVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        userSegment: 'CULTURAL_ENTHUSIAST',
        favorites: {
          destinations: [],
          airlines: [],
          hotels: [],
          activities: [],
        },
        preferences: {
          preferredAirlines: [],
        },
      };
    }
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
    query: any,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[FlightRecommendation] 📡 Attempt ${attempt}/${maxRetries} to Voyage service`);

        const response = await axios.get(`${VOYAGE_SERVICE_URL}/api/flights/search`, {
          params: query,
          headers: { 'X-Internal-Service': 'ai-service' },
          timeout: 10000, // Increased to 10s for flights
        });

        console.log(`[FlightRecommendation] ✅ Voyage service responded on attempt ${attempt}`);
        return response;
      } catch (error: any) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = this.isRetryableError(error);

        console.error(
          `[FlightRecommendation] ❌ Voyage service error (attempt ${attempt}/${maxRetries}):`,
          error.message || error.code
        );

        // Don't retry if not retryable OR if it's the last attempt
        if (!isRetryable || isLastAttempt) {
          throw error;
        }

        // Exponential backoff: 2^(attempt-1) * 1000ms
        const backoffDelay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[FlightRecommendation] ⏳ Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError;
  }

  /**
   * Get destination suggestions based on user segment
   * Returns IATA codes for destinations that match the user's travel segment
   */
  private getDestinationsForSegment(segment: string): string[] {
    const destinationsBySegment: Record<string, string[]> = {
      'CULTURAL_ENTHUSIAST': ['ROM', 'PAR', 'BCN', 'ATH', 'CAI', 'IST', 'KYO', 'DEL'],
      'ADVENTURE_SEEKER': ['DXB', 'SIN', 'SYD', 'YVR', 'NRT', 'BKK', 'QUI', 'CPT'],
      'BUSINESS_TRAVELER': ['LHR', 'FRA', 'JFK', 'SIN', 'HKG', 'DXB', 'CDG', 'ZRH'],
      'BEACH_LOVER': ['MIA', 'CUN', 'SYD', 'BKK', 'HNL', 'MLE', 'PUJ', 'OGG'],
      'FAMILY_TRAVELER': ['MCO', 'LAX', 'BCN', 'ROM', 'LIS', 'DXB', 'CDG', 'LHR'],
      'LUXURY_TRAVELER': ['DXB', 'SIN', 'MLE', 'SEZ', 'BOB', 'PPT', 'NAN', 'AUH'],
      'BUDGET_BACKPACKER': ['BKK', 'HAN', 'DEL', 'GYE', 'BOG', 'MEX', 'LIS', 'BUD'],
      'WELLNESS_SEEKER': ['UBD', 'CMB', 'KTM', 'SYD', 'SIN', 'BKK', 'RIX', 'CPH'],
      'ROMANTIC_COUPLE': ['PAR', 'VCE', 'SAV', 'BOB', 'MLE', 'SEZ', 'PPT', 'HNL'],
    };

    return destinationsBySegment[segment] || ['LON', 'PAR', 'NYC', 'BCN', 'ROM', 'DXB'];
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Score destinations based on user vector similarity
   * Returns destinations sorted by score (highest first)
   */
  private async scoreDestinations(
    destinations: string[],
    userVector: number[]
  ): Promise<Array<{ code: string; score: number }>> {
    // For now, we'll use a simple scoring based on destination characteristics
    // In the future, this could use a DestinationVectorizerService
    const scored = destinations.map(dest => {
      // Simple heuristic: give higher scores to culturally rich destinations
      // This is a placeholder - a real implementation would vectorize destinations
      let score = 0.5; // Base score

      // Boost based on user vector dimensions
      // userVector[1] = culture vs nature (higher = more culture)
      // userVector[6] = gastronomy
      // userVector[7] = popularity

      const culturalDestinations = ['ROM', 'PAR', 'ATH', 'CAI', 'IST', 'KYO', 'DEL', 'BCN'];
      const popularDestinations = ['NYC', 'LON', 'PAR', 'DXB', 'SIN', 'HKG', 'LHR', 'CDG'];

      if (culturalDestinations.includes(dest)) {
        score += userVector[1] * 0.3; // Boost cultural destinations for culture lovers
      }

      if (popularDestinations.includes(dest)) {
        score += userVector[7] * 0.2; // Boost popular destinations
      }

      // Add some randomness to avoid always suggesting the same destinations
      score += Math.random() * 0.1;

      return { code: dest, score };
    });

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Suggest destinations intelligently based on user profile
   * Returns 3-5 destination IATA codes
   */
  private async suggestDestinations(
    userId: string,
    origin: string,
    userVector: number[],
    segment: string,
    favorites?: {
      destinations: string[];
      airlines: string[];
      hotels: string[];
      activities: string[];
    }
  ): Promise<string[]> {
    console.log(`[FlightRecommendation] Suggesting destinations for segment: ${segment}`);

    // 1. Extract favorite destinations from structured favorites
    const favoriteDestinations = (favorites?.destinations || []).slice(0, 3);

    console.log(`[FlightRecommendation] Found ${favoriteDestinations.length} favorite destinations`);

    // 2. Get segment-based suggestions
    const segmentDestinations = this.getDestinationsForSegment(segment);

    // 3. Combine and deduplicate
    const candidateDestinations = [
      ...new Set([...favoriteDestinations, ...segmentDestinations])
    ].filter(dest => dest !== origin); // Don't suggest the origin as a destination

    console.log(`[FlightRecommendation] ${candidateDestinations.length} candidate destinations`);

    // 4. Score destinations using user vector
    const scored = await this.scoreDestinations(candidateDestinations, userVector);

    // 5. Return top 5 destinations
    const suggested = scored.slice(0, 5).map(d => d.code);

    console.log(`[FlightRecommendation] Suggested destinations:`, suggested);

    return suggested;
  }

  /**
   * Validate IATA code (3 uppercase letters)
   */
  private validateIATACode(code: string, fieldName: string): void {
    const iataRegex = /^[A-Z]{3}$/;
    if (!code || !iataRegex.test(code)) {
      throw new Error(`Invalid ${fieldName}: ${code}. Must be a 3-letter IATA code (e.g., PAR, NYC).`);
    }
  }

  /**
   * Validate search parameters before sending to Amadeus
   */
  private validateSearchParams(searchParams: FlightRecommendationOptions['searchParams'], destination: string): void {
    // Validate origin
    this.validateIATACode(searchParams.origin, 'origin');

    // Validate destination
    this.validateIATACode(destination, 'destination');

    // Validate dates
    const departureDate = new Date(searchParams.departureDate);
    if (isNaN(departureDate.getTime())) {
      throw new Error(`Invalid departureDate: ${searchParams.departureDate}. Must be YYYY-MM-DD format.`);
    }

    // Check date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (departureDate < today) {
      throw new Error(`departureDate cannot be in the past: ${searchParams.departureDate}`);
    }

    // Validate passengers
    if (!searchParams.adults || searchParams.adults < 1) {
      throw new Error('At least 1 adult passenger is required.');
    }
  }

  /**
   * Clean query object by removing undefined, null, and empty string values
   */
  private cleanQueryObject(query: any): any {
    return Object.entries(query)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  }

  /**
   * Search flights via Amadeus API (through Voyage service)
   * Uses retry logic with exponential backoff for resilience
   */
  private async searchFlights(
    searchParams: FlightRecommendationOptions['searchParams'],
    filters?: FlightRecommendationOptions['filters']
  ): Promise<FlightFeatures[]> {
    try {
      // Ensure destination is provided (required for single search)
      if (!searchParams.destination) {
        throw new Error('destination is required for searchFlights');
      }

      // Validate parameters
      this.validateSearchParams(searchParams, searchParams.destination);

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
        // Normalize to uppercase for Amadeus API (ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST)
        query.travelClass = searchParams.travelClass.toUpperCase();
      }

      // Apply filters with proper validation
      if (filters) {
        if (filters.maxStops !== undefined) query.maxStops = filters.maxStops;
        if (filters.maxDuration) query.maxDuration = filters.maxDuration;
        if (filters.maxPrice) query.maxPrice = filters.maxPrice;

        // Validate and add airline codes (final safety check)
        if ((filters.airlines?.length ?? 0) > 0) {
          const validatedAirlines = validateAndNormalizeAirlineCodes(filters.airlines!);
          if (validatedAirlines.length > 0) {
            query.includedAirlineCodes = validatedAirlines.join(',');
            console.log(`[FlightRecommendation] Cleaned airline codes: ${query.includedAirlineCodes}`);
          }
        }
      }

      // Clean query object (remove undefined/null/empty values)
      const cleanedQuery = this.cleanQueryObject(query);

      console.log('[FlightRecommendation] Searching flights with query:', JSON.stringify(cleanedQuery));

      // Call Voyage service with retry logic
      const response = await this.callVoyageServiceWithRetry(cleanedQuery);

      const flights = response.data.data || [];

      // Transform to FlightFeatures format
      return flights.map((flight: any) =>
        this.vectorizer['transformAmadeusToFeatures'](flight)
      );
    } catch (error: any) {
      console.error('[FlightRecommendation] Flight search failed after retries:', error.message);
      throw new Error('Failed to search flights: ' + (error.message || 'Unknown error'));
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
