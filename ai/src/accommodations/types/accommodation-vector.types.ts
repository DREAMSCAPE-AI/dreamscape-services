/**
 * Accommodation Vector Types
 *
 * Defines feature vectors and data structures for accommodation recommendations.
 * These types ensure compatibility with the existing UserVector 8D system while
 * capturing accommodation-specific features.
 *
 * @module accommodations/types
 * @ticket US-IA-003.1
 */

/**
 * 8-Dimensional Feature Vector
 *
 * Compatible with UserVector dimensions for cosine similarity calculation.
 * Each dimension is normalized to [0-1] range.
 */
export type AccommodationVector = [
  number, // climate: Climate-related amenities (pool, AC, heating, etc.)
  number, // cultureNature: Location type (city center vs nature)
  number, // budget: Relative price level [0=budget, 1=luxury]
  number, // activityLevel: Active amenities (gym, spa, sports, etc.)
  number, // groupSize: Capacity and room configurations
  number, // urbanRural: Environment setting [0=rural, 1=urban]
  number, // gastronomy: Dining quality and options
  number  // popularity: Overall quality score (ratings + reviews)
];

/**
 * Accommodation Category
 *
 * Primary categorization of accommodation types.
 * Maps to user segment preferences.
 */
export enum AccommodationCategory {
  HOTEL = 'HOTEL',
  RESORT = 'RESORT',
  APARTMENT = 'APARTMENT',
  HOSTEL = 'HOSTEL',
  BED_AND_BREAKFAST = 'BED_AND_BREAKFAST',
  BOUTIQUE_HOTEL = 'BOUTIQUE_HOTEL',
  VILLA = 'VILLA',
  ECO_LODGE = 'ECO_LODGE',
  BUSINESS_HOTEL = 'BUSINESS_HOTEL',
  WELLNESS_RESORT = 'WELLNESS_RESORT',
  FAMILY_HOTEL = 'FAMILY_HOTEL',
  LUXURY_HOTEL = 'LUXURY_HOTEL',
  BUDGET_HOTEL = 'BUDGET_HOTEL',
}

/**
 * Standard Amenity Categories
 *
 * Normalized amenity classification from Amadeus data.
 * Used for feature extraction and vectorization.
 */
export enum AmenityCategory {
  // Climate-related
  POOL = 'POOL',
  AIR_CONDITIONING = 'AIR_CONDITIONING',
  HEATING = 'HEATING',
  SAUNA = 'SAUNA',
  HOT_TUB = 'HOT_TUB',

  // Activity-related
  GYM = 'GYM',
  SPA = 'SPA',
  SPORTS_FACILITIES = 'SPORTS_FACILITIES',
  WATER_SPORTS = 'WATER_SPORTS',
  WELLNESS_CENTER = 'WELLNESS_CENTER',

  // Gastronomy-related
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  ROOM_SERVICE = 'ROOM_SERVICE',
  BREAKFAST_INCLUDED = 'BREAKFAST_INCLUDED',
  FINE_DINING = 'FINE_DINING',

  // Family-related
  KIDS_CLUB = 'KIDS_CLUB',
  PLAYGROUND = 'PLAYGROUND',
  BABYSITTING = 'BABYSITTING',
  FAMILY_ROOMS = 'FAMILY_ROOMS',

  // Business-related
  BUSINESS_CENTER = 'BUSINESS_CENTER',
  MEETING_ROOMS = 'MEETING_ROOMS',
  CONFERENCE_FACILITIES = 'CONFERENCE_FACILITIES',
  COWORKING_SPACE = 'COWORKING_SPACE',

  // Connectivity
  WIFI = 'WIFI',
  PARKING = 'PARKING',
  AIRPORT_SHUTTLE = 'AIRPORT_SHUTTLE',

  // Luxury
  CONCIERGE = 'CONCIERGE',
  BUTLER_SERVICE = 'BUTLER_SERVICE',
  VIP_LOUNGE = 'VIP_LOUNGE',

  // Romance
  COUPLES_SPA = 'COUPLES_SPA',
  PRIVATE_DINING = 'PRIVATE_DINING',
  ROMANCE_PACKAGE = 'ROMANCE_PACKAGE',

  // Nature/Environment
  GARDEN = 'GARDEN',
  TERRACE = 'TERRACE',
  OUTDOOR_ACTIVITIES = 'OUTDOOR_ACTIVITIES',
  ECO_FRIENDLY = 'ECO_FRIENDLY',
}

/**
 * Location Type Classification
 *
 * Categorizes the accommodation's geographical context.
 * Affects cultureNature and urbanRural dimensions.
 */
export enum LocationType {
  CITY_CENTER = 'CITY_CENTER',
  DOWNTOWN = 'DOWNTOWN',
  HISTORIC_DISTRICT = 'HISTORIC_DISTRICT',
  BUSINESS_DISTRICT = 'BUSINESS_DISTRICT',
  SUBURBAN = 'SUBURBAN',
  BEACH = 'BEACH',
  MOUNTAIN = 'MOUNTAIN',
  COUNTRYSIDE = 'COUNTRYSIDE',
  REMOTE = 'REMOTE',
  NATURE_RESERVE = 'NATURE_RESERVE',
}

/**
 * Raw Accommodation Features
 *
 * Complete feature set extracted from Amadeus API data.
 * This is the input to the vectorization process.
 */
export interface AccommodationFeatures {
  // Basic Information
  hotelId: string;
  name: string;
  chainCode?: string;

  // Location
  location: {
    latitude: number;
    longitude: number;
    address: string;
    cityCode: string;
    locationType: LocationType;
    distanceToCenter?: number; // km
  };

  // Category and Type
  category: AccommodationCategory;
  starRating?: number; // 1-5 stars (official classification)

  // Pricing
  price: {
    amount: number;
    currency: string;
    perNight: boolean;
  };

  // Ratings and Reviews
  ratings?: {
    overall: number; // 0-10 (from Amadeus)
    numberOfReviews: number;
    cleanliness?: number;
    service?: number;
    location?: number;
    facilities?: number;
    valueForMoney?: number;
  };

  // Amenities (normalized)
  amenities: AmenityCategory[];

  // Room Configuration
  rooms?: {
    totalRooms: number;
    maxOccupancy: number;
    hasFamilyRooms: boolean;
    hasSuites: boolean;
    hasConnectingRooms: boolean;
  };

  // Additional Metadata
  metadata?: {
    isNewOpening?: boolean; // Opened in last 12 months
    isRenovated?: boolean; // Renovated in last 24 months
    certifications?: string[]; // Eco, Quality, etc.
    languages?: string[]; // Languages spoken
  };
}

/**
 * Vectorization Configuration
 *
 * Tunable weights for each dimension calculation.
 * Allows A/B testing and optimization.
 */
export interface VectorizationConfig {
  // Climate dimension weights
  climate: {
    pool: number;
    airConditioning: number;
    heating: number;
    sauna: number;
    hotTub: number;
  };

  // Activity level dimension weights
  activityLevel: {
    gym: number;
    spa: number;
    sports: number;
    waterSports: number;
    wellness: number;
  };

  // Gastronomy dimension weights
  gastronomy: {
    restaurant: number;
    fineDining: number;
    bar: number;
    roomService: number;
    breakfastIncluded: number;
  };

  // Group size dimension weights
  groupSize: {
    familyRooms: number;
    suites: number;
    connectingRooms: number;
    maxOccupancy: number;
    kidsClub: number;
  };

  // Popularity dimension weights
  popularity: {
    overallRating: number;
    numberOfReviews: number;
    starRating: number;
    recentRenovation: number;
  };

  // Budget calculation
  budget: {
    marketAveragePrice: number; // Reference price for normalization
    currency: string;
  };
}

/**
 * Scored Accommodation Result
 *
 * Final output of the scoring algorithm, containing the accommodation
 * with its personalized score and explanation.
 */
export interface ScoredAccommodation {
  // Original data
  accommodation: AccommodationFeatures;

  // Vector representation
  vector: AccommodationVector;

  // Scoring results
  score: number; // Final weighted score [0-1]
  confidence: number; // Confidence in recommendation [0-1]

  // Score breakdown for explainability
  breakdown: {
    similarityScore: number; // Cosine similarity with UserVector
    popularityScore: number; // Popularity component
    segmentBoost: number; // Segment-specific boost
    qualityScore: number; // Overall quality score
    finalScore: number; // Weighted combination
  };

  // Explanation for user
  reasons: string[]; // Human-readable reasons for recommendation

  // Ranking
  rank: number; // Position in final results (1-indexed)

  // Diversity tracking (for MMR)
  diversityContribution?: number; // How much this adds to diversity
}

/**
 * Recommendation Request Options
 *
 * Configuration for accommodation recommendation requests.
 */
export interface RecommendationOptions {
  // User context
  userId: string;
  userVector?: number[]; // Optional: provide pre-calculated vector

  // Search parameters (passed to Amadeus)
  searchParams: {
    cityCode: string;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children?: number;
    rooms?: number;
  };

  // Filtering
  filters?: {
    minRating?: number;
    maxPrice?: number;
    requiredAmenities?: AmenityCategory[];
    categories?: AccommodationCategory[];
  };

  // Scoring configuration
  scoring?: {
    popularityWeight?: number; // 0-1 (default: 0.3)
    similarityWeight?: number; // 0-1 (default: 0.5)
    qualityWeight?: number; // 0-1 (default: 0.2)
    applySegmentBoost?: boolean; // default: true
  };

  // Result configuration
  limit?: number; // Max results to return (default: 20)
  diversityFactor?: number; // MMR lambda [0-1] (default: 0.3)
  includeExplanations?: boolean; // Include reasons (default: true)
}

/**
 * Recommendation Response
 *
 * Complete response from the recommendation service.
 */
export interface RecommendationResponse {
  userId: string;
  count: number;
  recommendations: ScoredAccommodation[];

  metadata: {
    processingTime: number; // milliseconds
    strategy: string; // "hybrid" | "similarity_only" | "popularity_fallback"
    cacheHit: boolean;
    amadeusResponseTime?: number;
    scoringTime?: number;
  };

  // Debugging info (only in dev mode)
  debug?: {
    userVector: number[];
    userSegment: string;
    totalCandidates: number;
    filteredCandidates: number;
    vectorizationTime: number;
  };
}

/**
 * Batch Vectorization Result
 *
 * Result of vectorizing multiple accommodations at once.
 * Used for performance optimization.
 */
export interface BatchVectorizationResult {
  vectors: Map<string, AccommodationVector>; // hotelId -> vector
  processingTime: number;
  itemsProcessed: number;
  errors?: Array<{
    hotelId: string;
    error: string;
  }>;
}

/**
 * Interaction Event
 *
 * Tracks user interactions with accommodation recommendations
 * for refinement and learning.
 */
export interface AccommodationInteraction {
  userId: string;
  hotelId: string;
  type: 'view' | 'click' | 'book' | 'like' | 'dislike';
  timestamp: Date;

  // Context
  searchParams?: {
    cityCode: string;
    checkInDate: string;
    checkOutDate: string;
  };

  // Position in recommendations
  rank?: number;
  score?: number;
}

/**
 * Cache Key Generator
 *
 * Generates consistent cache keys for Redis storage.
 */
export class AccommodationCacheKey {
  /**
   * Generate cache key for search results
   */
  static forSearch(params: {
    cityCode: string;
    checkInDate: string;
    adults: number;
  }): string {
    return `acc:search:${params.cityCode}:${params.checkInDate}:${params.adults}`;
  }

  /**
   * Generate cache key for vectorization result
   */
  static forVector(hotelId: string): string {
    return `acc:vector:${hotelId}`;
  }

  /**
   * Generate cache key for recommendations
   */
  static forRecommendations(userId: string, cityCode: string, checkInDate: string): string {
    return `acc:recs:${userId}:${cityCode}:${checkInDate}`;
  }

  /**
   * Generate cache key for popularity scores
   */
  static forPopularity(cityCode: string): string {
    return `acc:pop:${cityCode}`;
  }
}

/**
 * Default Vectorization Configuration
 *
 * Baseline weights optimized for balanced recommendations.
 * Can be overridden per-request or via A/B testing.
 */
export const DEFAULT_VECTORIZATION_CONFIG: VectorizationConfig = {
  climate: {
    pool: 0.3,
    airConditioning: 0.25,
    heating: 0.2,
    sauna: 0.15,
    hotTub: 0.1,
  },
  activityLevel: {
    gym: 0.3,
    spa: 0.3,
    sports: 0.2,
    waterSports: 0.1,
    wellness: 0.1,
  },
  gastronomy: {
    restaurant: 0.25,
    fineDining: 0.3,
    bar: 0.15,
    roomService: 0.15,
    breakfastIncluded: 0.15,
  },
  groupSize: {
    familyRooms: 0.3,
    suites: 0.2,
    connectingRooms: 0.2,
    maxOccupancy: 0.2,
    kidsClub: 0.1,
  },
  popularity: {
    overallRating: 0.4,
    numberOfReviews: 0.3,
    starRating: 0.2,
    recentRenovation: 0.1,
  },
  budget: {
    marketAveragePrice: 150, // EUR per night (will be calculated dynamically)
    currency: 'EUR',
  },
};

/**
 * Scoring Weights
 *
 * Default weights for final score calculation.
 */
export const DEFAULT_SCORING_WEIGHTS = {
  similarity: 0.5,    // 50% cosine similarity with UserVector
  popularity: 0.3,    // 30% popularity/quality score
  quality: 0.2,       // 20% objective quality (ratings, star rating)
};

/**
 * Segment-Specific Boosts
 *
 * Multipliers applied based on user segment and accommodation category match.
 * Values > 1.0 boost the score, < 1.0 penalize.
 */
export const SEGMENT_CATEGORY_BOOST: Record<string, Partial<Record<AccommodationCategory, number>>> = {
  BUDGET_BACKPACKER: {
    [AccommodationCategory.HOSTEL]: 1.3,
    [AccommodationCategory.BUDGET_HOTEL]: 1.2,
    [AccommodationCategory.APARTMENT]: 1.15,
    [AccommodationCategory.LUXURY_HOTEL]: 0.5,
    [AccommodationCategory.RESORT]: 0.6,
  },
  FAMILY_EXPLORER: {
    [AccommodationCategory.FAMILY_HOTEL]: 1.3,
    [AccommodationCategory.APARTMENT]: 1.25,
    [AccommodationCategory.RESORT]: 1.15,
    [AccommodationCategory.HOSTEL]: 0.5,
    [AccommodationCategory.BOUTIQUE_HOTEL]: 0.8,
  },
  LUXURY_TRAVELER: {
    [AccommodationCategory.LUXURY_HOTEL]: 1.4,
    [AccommodationCategory.RESORT]: 1.3,
    [AccommodationCategory.BOUTIQUE_HOTEL]: 1.2,
    [AccommodationCategory.HOSTEL]: 0.3,
    [AccommodationCategory.BUDGET_HOTEL]: 0.4,
  },
  ADVENTURE_SEEKER: {
    [AccommodationCategory.ECO_LODGE]: 1.3,
    [AccommodationCategory.VILLA]: 1.2,
    [AccommodationCategory.RESORT]: 1.1,
    [AccommodationCategory.BUSINESS_HOTEL]: 0.6,
    [AccommodationCategory.LUXURY_HOTEL]: 0.7,
  },
  CULTURAL_ENTHUSIAST: {
    [AccommodationCategory.BOUTIQUE_HOTEL]: 1.3,
    [AccommodationCategory.BED_AND_BREAKFAST]: 1.25,
    [AccommodationCategory.HOTEL]: 1.1,
    [AccommodationCategory.RESORT]: 0.7,
    [AccommodationCategory.HOSTEL]: 0.8,
  },
  ROMANTIC_COUPLE: {
    [AccommodationCategory.BOUTIQUE_HOTEL]: 1.3,
    [AccommodationCategory.RESORT]: 1.25,
    [AccommodationCategory.WELLNESS_RESORT]: 1.2,
    [AccommodationCategory.HOSTEL]: 0.4,
    [AccommodationCategory.FAMILY_HOTEL]: 0.6,
  },
  BUSINESS_TRAVELER: {
    [AccommodationCategory.BUSINESS_HOTEL]: 1.4,
    [AccommodationCategory.HOTEL]: 1.2,
    [AccommodationCategory.APARTMENT]: 1.15,
    [AccommodationCategory.HOSTEL]: 0.5,
    [AccommodationCategory.RESORT]: 0.7,
  },
  WELLNESS_SEEKER: {
    [AccommodationCategory.WELLNESS_RESORT]: 1.4,
    [AccommodationCategory.RESORT]: 1.2,
    [AccommodationCategory.BOUTIQUE_HOTEL]: 1.1,
    [AccommodationCategory.HOSTEL]: 0.5,
    [AccommodationCategory.BUDGET_HOTEL]: 0.6,
  },
};
