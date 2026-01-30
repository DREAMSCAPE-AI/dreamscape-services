/**
 * Accommodation Vectorizer Service
 *
 * Transforms raw accommodation features into 8-dimensional feature vectors
 * compatible with UserVector for cosine similarity calculation.
 *
 * ## 🔍 WHAT IT DOES
 * This service takes unstructured hotel data from Amadeus API and converts it
 * into normalized 8D vectors that can be compared with user preference vectors.
 *
 * ## 💡 WHY WE NEED IT
 * To personalize accommodation recommendations, we must represent hotels in the
 * same dimensional space as user preferences. This allows us to calculate
 * similarity scores using cosine similarity.
 *
 * ## ⚙️ HOW IT WORKS
 * 1. Parse amenities from raw strings into categories
 * 2. Calculate dimension scores based on presence/absence of features
 * 3. Normalize each dimension to [0-1] range
 * 4. Apply configurable weights for fine-tuning
 *
 * @module accommodations/services
 * @ticket US-IA-003.1
 */

import {
  AccommodationVector,
  AccommodationFeatures,
  VectorizationConfig,
  DEFAULT_VECTORIZATION_CONFIG,
  LocationType,
  AmenityCategory,
  BatchVectorizationResult,
} from '../types/accommodation-vector.types';

import {
  parseAmenities,
  hasAmenity,
  getAmenityCoverage,
  CLIMATE_AMENITIES,
  ACTIVITY_AMENITIES,
  GASTRONOMY_AMENITIES,
  FAMILY_AMENITIES,
  extractAmadeusAmenities,
} from '../utils/amenity-parser.util';

/**
 * AccommodationVectorizerService
 *
 * Core service for accommodation feature extraction and vectorization.
 */
export class AccommodationVectorizerService {
  private config: VectorizationConfig;

  constructor(config?: Partial<VectorizationConfig>) {
    this.config = {
      ...DEFAULT_VECTORIZATION_CONFIG,
      ...config,
    };
  }

  /**
   * Vectorize a single accommodation
   *
   * Main entry point for transforming accommodation features into a vector.
   *
   * @param features - Structured accommodation features
   * @returns 8D feature vector normalized to [0-1]
   */
  vectorize(features: AccommodationFeatures): AccommodationVector {
    const amenities = new Set(features.amenities);

    return [
      this.calculateClimateDimension(amenities),
      this.calculateCultureNatureDimension(features),
      this.calculateBudgetDimension(features),
      this.calculateActivityDimension(amenities),
      this.calculateGroupSizeDimension(features, amenities),
      this.calculateUrbanRuralDimension(features),
      this.calculateGastronomyDimension(amenities),
      this.calculatePopularityDimension(features),
    ];
  }

  /**
   * Vectorize accommodation from raw Amadeus data
   *
   * Convenience method that handles data transformation from Amadeus format.
   *
   * @param amadeusHotel - Raw hotel object from Amadeus API
   * @param cityCode - City code for context
   * @returns 8D feature vector
   */
  vectorizeFromAmadeus(amadeusHotel: any, cityCode: string): AccommodationVector {
    const features = this.transformAmadeusToFeatures(amadeusHotel, cityCode);
    return this.vectorize(features);
  }

  /**
   * Batch vectorize multiple accommodations
   *
   * Optimized for processing search results (50-200 hotels).
   * Calculates market average dynamically for budget normalization.
   *
   * @param accommodations - Array of accommodation features
   * @returns Map of hotelId to vector, with metadata
   */
  batchVectorize(accommodations: AccommodationFeatures[]): BatchVectorizationResult {
    const startTime = Date.now();
    const vectors = new Map<string, AccommodationVector>();
    const errors: Array<{ hotelId: string; error: string }> = [];

    // Calculate market average price for this batch
    const prices = accommodations
      .map(acc => acc.price.amount)
      .filter(p => p > 0);

    const marketAverage = prices.length > 0
      ? prices.reduce((sum, p) => sum + p, 0) / prices.length
      : this.config.budget.marketAveragePrice;

    // Update config for this batch
    const originalAverage = this.config.budget.marketAveragePrice;
    this.config.budget.marketAveragePrice = marketAverage;

    // Vectorize each accommodation
    for (const accommodation of accommodations) {
      try {
        const vector = this.vectorize(accommodation);
        vectors.set(accommodation.hotelId, vector);
      } catch (error) {
        errors.push({
          hotelId: accommodation.hotelId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Restore original config
    this.config.budget.marketAveragePrice = originalAverage;

    return {
      vectors,
      processingTime: Date.now() - startTime,
      itemsProcessed: vectors.size,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Transform Amadeus hotel data to AccommodationFeatures
   *
   * Handles various Amadeus API response formats.
   *
   * @param amadeusHotel - Raw Amadeus hotel object
   * @param cityCode - City code for context
   * @returns Structured accommodation features
   */
  private transformAmadeusToFeatures(amadeusHotel: any, cityCode: string): AccommodationFeatures {
    const hotel = amadeusHotel.hotel || amadeusHotel;
    const offer = amadeusHotel.offers?.[0];

    // Extract amenities
    const amenities = extractAmadeusAmenities(amadeusHotel);

    // Determine location type
    const locationType = this.inferLocationType(hotel, amenities);

    // Determine accommodation category
    const category = this.inferCategory(hotel, amenities);

    return {
      hotelId: hotel.hotelId || hotel.id,
      name: hotel.name,
      chainCode: hotel.chainCode,

      location: {
        latitude: hotel.latitude || hotel.geoCode?.latitude,
        longitude: hotel.longitude || hotel.geoCode?.longitude,
        address: hotel.address?.lines?.join(', ') || hotel.address,
        cityCode,
        locationType,
        distanceToCenter: hotel.distanceToCenter,
      },

      category,
      starRating: hotel.rating || hotel.stars,

      price: {
        amount: parseFloat(offer?.price?.total || offer?.price?.base || hotel.price || 0),
        currency: offer?.price?.currency || this.config.budget.currency,
        perNight: true,
      },

      ratings: hotel.ratings ? {
        overall: hotel.ratings.overall || hotel.rating,
        numberOfReviews: hotel.ratings.numberOfReviews || hotel.reviews || 0,
        cleanliness: hotel.ratings.cleanliness,
        service: hotel.ratings.service,
        location: hotel.ratings.location,
        facilities: hotel.ratings.facilities,
        valueForMoney: hotel.ratings.valueForMoney,
      } : undefined,

      amenities: Array.from(amenities),

      rooms: hotel.rooms ? {
        totalRooms: hotel.rooms.length,
        maxOccupancy: Math.max(...hotel.rooms.map((r: any) => r.maxOccupancy || 2)),
        hasFamilyRooms: hotel.rooms.some((r: any) => r.type?.includes('FAMILY')),
        hasSuites: hotel.rooms.some((r: any) => r.type?.includes('SUITE')),
        hasConnectingRooms: hotel.rooms.some((r: any) => r.connectingRooms),
      } : undefined,

      metadata: {
        isNewOpening: hotel.openingDate && this.isRecentDate(hotel.openingDate, 12),
        isRenovated: hotel.renovationDate && this.isRecentDate(hotel.renovationDate, 24),
        certifications: hotel.certifications,
        languages: hotel.languages,
      },
    };
  }

  // ============================================================================
  // DIMENSION CALCULATORS
  // ============================================================================

  /**
   * Dimension 0: Climate
   *
   * Measures climate-related amenities (pool, AC, heating, sauna, hot tub).
   * Higher values indicate more climate control and comfort features.
   *
   * @param amenities - Set of amenity categories
   * @returns Normalized score [0-1]
   */
  private calculateClimateDimension(amenities: Set<AmenityCategory>): number {
    const weights = this.config.climate;
    let score = 0;

    if (hasAmenity(amenities, AmenityCategory.POOL)) {
      score += weights.pool;
    }
    if (hasAmenity(amenities, AmenityCategory.AIR_CONDITIONING)) {
      score += weights.airConditioning;
    }
    if (hasAmenity(amenities, AmenityCategory.HEATING)) {
      score += weights.heating;
    }
    if (hasAmenity(amenities, AmenityCategory.SAUNA)) {
      score += weights.sauna;
    }
    if (hasAmenity(amenities, AmenityCategory.HOT_TUB)) {
      score += weights.hotTub;
    }

    // Normalize by sum of weights
    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Dimension 1: Culture vs Nature
   *
   * Measures whether accommodation is culture-oriented (urban, historic)
   * or nature-oriented (beach, mountain, countryside).
   *
   * Scale: 0 = Pure nature, 0.5 = Mixed, 1 = Pure culture
   *
   * @param features - Accommodation features
   * @returns Normalized score [0-1]
   */
  private calculateCultureNatureDimension(features: AccommodationFeatures): number {
    const { locationType } = features.location;
    const { amenities } = features;

    // Location type base score
    const locationScores: Record<LocationType, number> = {
      [LocationType.CITY_CENTER]: 1.0,
      [LocationType.DOWNTOWN]: 0.9,
      [LocationType.HISTORIC_DISTRICT]: 1.0,
      [LocationType.BUSINESS_DISTRICT]: 0.8,
      [LocationType.SUBURBAN]: 0.5,
      [LocationType.BEACH]: 0.2,
      [LocationType.MOUNTAIN]: 0.1,
      [LocationType.COUNTRYSIDE]: 0.2,
      [LocationType.REMOTE]: 0.0,
      [LocationType.NATURE_RESERVE]: 0.0,
    };

    let score = locationScores[locationType] || 0.5;

    // Adjust based on amenities
    const amenitySet = new Set(amenities);
    if (hasAmenity(amenitySet, AmenityCategory.GARDEN)) score -= 0.1;
    if (hasAmenity(amenitySet, AmenityCategory.OUTDOOR_ACTIVITIES)) score -= 0.15;
    if (hasAmenity(amenitySet, AmenityCategory.ECO_FRIENDLY)) score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Dimension 2: Budget
   *
   * Measures relative price level compared to market average.
   *
   * Scale: 0 = Very budget (hostel), 0.5 = Mid-range, 1 = Luxury
   *
   * @param features - Accommodation features
   * @returns Normalized score [0-1]
   */
  private calculateBudgetDimension(features: AccommodationFeatures): number {
    const { amount } = features.price;
    const marketAverage = this.config.budget.marketAveragePrice;

    if (amount === 0 || !marketAverage) {
      // Fallback to star rating
      return features.starRating ? (features.starRating - 1) / 4 : 0.5;
    }

    // Calculate relative position
    // Budget hotels: 0-0.7x average → score 0-0.3
    // Mid-range: 0.7-1.5x average → score 0.3-0.7
    // Upscale: 1.5-3x average → score 0.7-0.9
    // Luxury: >3x average → score 0.9-1.0

    const ratio = amount / marketAverage;

    if (ratio < 0.7) {
      // Budget: linear 0-0.3
      return Math.min(0.3, ratio / 0.7 * 0.3);
    } else if (ratio < 1.5) {
      // Mid-range: linear 0.3-0.7
      return 0.3 + ((ratio - 0.7) / 0.8) * 0.4;
    } else if (ratio < 3.0) {
      // Upscale: linear 0.7-0.9
      return 0.7 + ((ratio - 1.5) / 1.5) * 0.2;
    } else {
      // Luxury: logarithmic 0.9-1.0
      return Math.min(1.0, 0.9 + Math.log10(ratio / 3) * 0.1);
    }
  }

  /**
   * Dimension 3: Activity Level
   *
   * Measures availability of active amenities (gym, spa, sports, wellness).
   * Higher values indicate more opportunities for activities.
   *
   * @param amenities - Set of amenity categories
   * @returns Normalized score [0-1]
   */
  private calculateActivityDimension(amenities: Set<AmenityCategory>): number {
    const weights = this.config.activityLevel;
    let score = 0;

    if (hasAmenity(amenities, AmenityCategory.GYM)) {
      score += weights.gym;
    }
    if (hasAmenity(amenities, AmenityCategory.SPA)) {
      score += weights.spa;
    }
    if (hasAmenity(amenities, AmenityCategory.SPORTS_FACILITIES)) {
      score += weights.sports;
    }
    if (hasAmenity(amenities, AmenityCategory.WATER_SPORTS)) {
      score += weights.waterSports;
    }
    if (hasAmenity(amenities, AmenityCategory.WELLNESS_CENTER)) {
      score += weights.wellness;
    }

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Dimension 4: Group Size
   *
   * Measures suitability for families/large groups vs solo/couple travelers.
   *
   * Scale: 0 = Solo/couple only, 1 = Family/group optimized
   *
   * @param features - Accommodation features
   * @param amenities - Set of amenity categories
   * @returns Normalized score [0-1]
   */
  private calculateGroupSizeDimension(
    features: AccommodationFeatures,
    amenities: Set<AmenityCategory>
  ): number {
    const weights = this.config.groupSize;
    let score = 0;

    // Room configuration
    if (features.rooms) {
      if (features.rooms.hasFamilyRooms) score += weights.familyRooms;
      if (features.rooms.hasSuites) score += weights.suites;
      if (features.rooms.hasConnectingRooms) score += weights.connectingRooms;

      // Max occupancy factor
      const occupancyScore = Math.min(1, features.rooms.maxOccupancy / 6);
      score += occupancyScore * weights.maxOccupancy;
    }

    // Family amenities
    if (hasAmenity(amenities, AmenityCategory.KIDS_CLUB)) score += weights.kidsClub;

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Dimension 5: Urban vs Rural
   *
   * Measures how urban/rural the location is.
   *
   * Scale: 0 = Remote/rural, 0.5 = Suburban, 1 = City center
   *
   * @param features - Accommodation features
   * @returns Normalized score [0-1]
   */
  private calculateUrbanRuralDimension(features: AccommodationFeatures): number {
    const { locationType, distanceToCenter } = features.location;

    // Base score from location type
    const locationScores: Record<LocationType, number> = {
      [LocationType.CITY_CENTER]: 1.0,
      [LocationType.DOWNTOWN]: 0.95,
      [LocationType.HISTORIC_DISTRICT]: 0.9,
      [LocationType.BUSINESS_DISTRICT]: 0.85,
      [LocationType.SUBURBAN]: 0.5,
      [LocationType.BEACH]: 0.3,
      [LocationType.MOUNTAIN]: 0.2,
      [LocationType.COUNTRYSIDE]: 0.15,
      [LocationType.REMOTE]: 0.05,
      [LocationType.NATURE_RESERVE]: 0.0,
    };

    let score = locationScores[locationType] || 0.5;

    // Adjust based on distance to center
    if (distanceToCenter !== undefined) {
      // <1km: +0.1, 1-3km: 0, 3-10km: -0.2, >10km: -0.4
      if (distanceToCenter < 1) {
        score += 0.1;
      } else if (distanceToCenter > 3 && distanceToCenter <= 10) {
        score -= 0.2;
      } else if (distanceToCenter > 10) {
        score -= 0.4;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Dimension 6: Gastronomy
   *
   * Measures quality and variety of dining options.
   *
   * @param amenities - Set of amenity categories
   * @returns Normalized score [0-1]
   */
  private calculateGastronomyDimension(amenities: Set<AmenityCategory>): number {
    const weights = this.config.gastronomy;
    let score = 0;

    if (hasAmenity(amenities, AmenityCategory.RESTAURANT)) {
      score += weights.restaurant;
    }
    if (hasAmenity(amenities, AmenityCategory.FINE_DINING)) {
      score += weights.fineDining;
    }
    if (hasAmenity(amenities, AmenityCategory.BAR)) {
      score += weights.bar;
    }
    if (hasAmenity(amenities, AmenityCategory.ROOM_SERVICE)) {
      score += weights.roomService;
    }
    if (hasAmenity(amenities, AmenityCategory.BREAKFAST_INCLUDED)) {
      score += weights.breakfastIncluded;
    }

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Dimension 7: Popularity
   *
   * Measures overall quality and popularity based on ratings and reviews.
   *
   * @param features - Accommodation features
   * @returns Normalized score [0-1]
   */
  private calculatePopularityDimension(features: AccommodationFeatures): number {
    const weights = this.config.popularity;
    let score = 0;

    // Overall rating (0-10 scale from Amadeus)
    if (features.ratings?.overall) {
      const ratingScore = features.ratings.overall / 10;
      score += ratingScore * weights.overallRating;
    }

    // Number of reviews (logarithmic scale)
    if (features.ratings?.numberOfReviews) {
      const reviewCount = features.ratings.numberOfReviews;
      // 0-10 reviews: 0-0.3, 10-100: 0.3-0.7, 100-1000: 0.7-0.9, >1000: 0.9-1.0
      let reviewScore = 0;
      if (reviewCount < 10) {
        reviewScore = reviewCount / 10 * 0.3;
      } else if (reviewCount < 100) {
        reviewScore = 0.3 + (Math.log10(reviewCount) - 1) * 0.4;
      } else if (reviewCount < 1000) {
        reviewScore = 0.7 + (Math.log10(reviewCount) - 2) * 0.2;
      } else {
        reviewScore = Math.min(1.0, 0.9 + (Math.log10(reviewCount) - 3) * 0.1);
      }
      score += reviewScore * weights.numberOfReviews;
    }

    // Star rating (official classification)
    if (features.starRating) {
      const starScore = (features.starRating - 1) / 4; // 1-5 stars → 0-1
      score += starScore * weights.starRating;
    }

    // Recent renovation bonus
    if (features.metadata?.isRenovated || features.metadata?.isNewOpening) {
      score += 1.0 * weights.recentRenovation;
    }

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Infer location type from hotel data
   */
  private inferLocationType(hotel: any, amenities: Set<AmenityCategory>): LocationType {
    const address = (hotel.address?.lines?.join(' ') || hotel.address || '').toLowerCase();
    const name = (hotel.name || '').toLowerCase();
    const description = (hotel.description || '').toLowerCase();

    const text = `${address} ${name} ${description}`;

    // Check keywords
    if (text.includes('city center') || text.includes('downtown')) {
      return LocationType.CITY_CENTER;
    }
    if (text.includes('historic') || text.includes('old town')) {
      return LocationType.HISTORIC_DISTRICT;
    }
    if (text.includes('business district')) {
      return LocationType.BUSINESS_DISTRICT;
    }
    if (text.includes('beach') || text.includes('seaside')) {
      return LocationType.BEACH;
    }
    if (text.includes('mountain') || text.includes('ski')) {
      return LocationType.MOUNTAIN;
    }
    if (text.includes('countryside') || text.includes('rural')) {
      return LocationType.COUNTRYSIDE;
    }
    if (hasAmenity(amenities, AmenityCategory.ECO_FRIENDLY)) {
      return LocationType.NATURE_RESERVE;
    }

    // Default to suburban if no clear indicators
    return LocationType.SUBURBAN;
  }

  /**
   * Infer accommodation category from hotel data
   */
  private inferCategory(hotel: any, amenities: Set<AmenityCategory>): any {
    const name = (hotel.name || '').toLowerCase();
    const description = (hotel.description || '').toLowerCase();
    const text = `${name} ${description}`;

    // Check for explicit keywords
    if (text.includes('hostel')) return 'HOSTEL';
    if (text.includes('resort')) return 'RESORT';
    if (text.includes('apartment') || text.includes('aparthotel')) return 'APARTMENT';
    if (text.includes('b&b') || text.includes('bed and breakfast')) return 'BED_AND_BREAKFAST';
    if (text.includes('boutique')) return 'BOUTIQUE_HOTEL';
    if (text.includes('villa')) return 'VILLA';
    if (text.includes('eco') || text.includes('lodge')) return 'ECO_LODGE';

    // Infer from star rating and amenities
    const stars = hotel.rating || hotel.stars || 3;

    if (stars >= 5 || hasAmenity(amenities, AmenityCategory.BUTLER_SERVICE)) {
      return 'LUXURY_HOTEL';
    }
    if (stars <= 2) {
      return 'BUDGET_HOTEL';
    }
    if (hasAmenity(amenities, AmenityCategory.WELLNESS_CENTER)) {
      return 'WELLNESS_RESORT';
    }
    if (hasAmenity(amenities, AmenityCategory.KIDS_CLUB)) {
      return 'FAMILY_HOTEL';
    }
    if (hasAmenity(amenities, AmenityCategory.BUSINESS_CENTER)) {
      return 'BUSINESS_HOTEL';
    }

    return 'HOTEL';
  }

  /**
   * Check if date is recent (within N months)
   */
  private isRecentDate(dateString: string, months: number): boolean {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMonths = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return diffMonths <= months;
    } catch {
      return false;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VectorizationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): VectorizationConfig {
    return { ...this.config };
  }
}

export default AccommodationVectorizerService;
