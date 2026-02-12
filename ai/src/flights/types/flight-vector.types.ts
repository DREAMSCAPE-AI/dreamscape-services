/**
 * Flight Vector Types
 *
 * Defines feature vectors and data structures for flight recommendations.
 * These types ensure compatibility with the existing UserVector 8D system while
 * capturing flight-specific features.
 *
 * @module flights/types
 * @ticket US-IA-004-bis.1
 */

/**
 * 8-Dimensional Feature Vector
 *
 * Compatible with UserVector dimensions for cosine similarity calculation.
 * Each dimension is normalized to [0-1] range.
 */
export type FlightVector = [
  number, // climate: Destination climate preference (cold → tropical)
  number, // cultureNature: Destination type (nature → culture)
  number, // budget: Relative price level [0=budget, 1=luxury/first class]
  number, // activityLevel: Travel style [0=relaxed/direct, 1=adventurous/connections ok]
  number, // groupSize: Suitability for groups [0=solo, 1=large groups]
  number, // urbanRural: Destination urbanism [0=rural, 1=urban]
  number, // gastronomy: Not applicable for flights, used for destination scoring
  number  // popularity: Airline quality + route popularity
];

/**
 * Flight Class
 */
export enum FlightClass {
  ECONOMY = 'ECONOMY',
  PREMIUM_ECONOMY = 'PREMIUM_ECONOMY',
  BUSINESS = 'BUSINESS',
  FIRST_CLASS = 'FIRST_CLASS',
}

/**
 * Flight Type by stops
 */
export enum FlightType {
  DIRECT = 'DIRECT',
  ONE_STOP = 'ONE_STOP',
  TWO_PLUS_STOPS = 'TWO_PLUS_STOPS',
}

/**
 * Airline Alliance
 */
export enum AirlineAlliance {
  STAR_ALLIANCE = 'STAR_ALLIANCE',
  ONEWORLD = 'ONEWORLD',
  SKYTEAM = 'SKYTEAM',
  NONE = 'NONE',
}

/**
 * Raw Flight Features
 *
 * Complete feature set extracted from Amadeus API data.
 */
export interface FlightFeatures {
  // Basic Information
  flightId: string;
  offerReference: string;

  // Airline
  airline: {
    code: string;           // IATA code (e.g., "AF")
    name: string;           // Full name (e.g., "Air France")
    alliance?: AirlineAlliance;
    rating?: number;        // 0-5 stars
    isLowCost: boolean;
  };

  // Route
  route: {
    origin: {
      airportCode: string;  // IATA code (e.g., "CDG")
      airportName: string;
      cityCode: string;
      cityName: string;
      countryCode: string;
      terminal?: string;
    };
    destination: {
      airportCode: string;
      airportName: string;
      cityCode: string;
      cityName: string;
      countryCode: string;
      terminal?: string;
    };
    distance: number;       // km
  };

  // Flight Details
  flightClass: FlightClass;
  flightType: FlightType;
  numberOfStops: number;

  // Segments (for connections)
  segments: Array<{
    departure: {
      airportCode: string;
      dateTime: string;     // ISO 8601
      terminal?: string;
    };
    arrival: {
      airportCode: string;
      dateTime: string;
      terminal?: string;
    };
    airline: string;        // Operating carrier
    flightNumber: string;
    aircraft?: string;      // Aircraft type
    duration: string;       // ISO 8601 duration
  }>;

  // Timing
  duration: {
    total: number;          // Total duration in minutes
    flight: number;         // Actual flight time in minutes
    layover: number;        // Layover time in minutes
  };

  schedule: {
    departureTime: string;  // ISO 8601
    arrivalTime: string;    // ISO 8601
    isOvernight: boolean;   // Arrival next day
    isRedEye: boolean;      // Night flight
    timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  };

  // Pricing
  price: {
    amount: number;
    currency: string;
    perPerson: boolean;
    taxesIncluded: boolean;
    fareType: 'PUBLISHED' | 'NEGOTIATED' | 'CORPORATE';
  };

  // Amenities & Services
  amenities: {
    wifi: boolean;
    power: boolean;
    entertainment: boolean;
    meals: number;          // Number of meals included
    baggage: {
      cabin: {
        allowed: boolean;
                quantity: number;
        weight?: number;    // kg
      };
      checked: {
        quantity: number;
        weight?: number;    // kg
      };
    };
  };

  // Booking Info
  bookingInfo: {
    seatsAvailable: number;
    instantTicketing: boolean;
    refundable: boolean;
    changeable: boolean;
    lastTicketingDate?: string;
  };

  // Ratings & Reviews
  popularity: {
    routePopularity: number;      // 0-1 (how popular is this route)
    airlineRating: number;        // 0-5 stars
    onTimePerformance: number;    // 0-1 (percentage on-time)
    reviewCount: number;
  };

  // Additional Metadata
  metadata?: {
    codeshare: boolean;
    operatedBy?: string;    // If different from marketing carrier
    cabinUpgradeAvailable: boolean;
    tags?: string[];        // ["fastest", "cheapest", "best-value"]
  };
}

/**
 * Vectorization Configuration
 */
export interface FlightVectorizationConfig {
  // Budget dimension weights
  budget: {
    economyRange: [number, number];        // [0, 300]
    premiumEconomyRange: [number, number]; // [300, 600]
    businessRange: [number, number];       // [600, 2000]
    firstClassRange: [number, number];     // [2000+]
    marketAveragePrice: number;            // Dynamic average
    currency: string;
  };

  // Activity level (travel style) weights
  activityLevel: {
    directFlightScore: number;      // High score for direct flights
    oneStopPenalty: number;         // Penalty for 1 stop
    multiStopPenalty: number;       // Penalty for 2+ stops
    shortLayoverBonus: number;      // Bonus for efficient connections
  };

  // Popularity dimension weights
  popularity: {
    airlineRatingWeight: number;    // 0.4
    routePopularityWeight: number;  // 0.3
    onTimeWeight: number;           // 0.2
    reviewCountWeight: number;      // 0.1
  };
}

/**
 * Scored Flight Result
 */
export interface ScoredFlight {
  // Original data
  flight: FlightFeatures;

  // Vector representation
  vector: FlightVector;

  // Scoring results
  score: number;              // Final weighted score [0-1]
  confidence: number;         // Confidence in recommendation [0-1]

  // Score breakdown for explainability
  breakdown: {
    similarityScore: number;  // Cosine similarity with UserVector
    popularityScore: number;  // Airline + route popularity
    qualityScore: number;     // On-time, amenities, comfort
    contextualScore: number;  // Price fit, timing, layover
    segmentBoost: number;     // Segment-specific boost
    finalScore: number;       // Weighted combination
  };

  // Explanation for user
  reasons: string[];          // Human-readable reasons

  // Ranking
  rank: number;               // Position in results (1-indexed)

  // Tags
  tags?: string[];            // ["best-value", "fastest", "most-comfortable"]
}

/**
 * Recommendation Request Options
 */
export interface FlightRecommendationOptions {
  // User context
  userId: string;
  userVector?: number[];      // Optional: pre-calculated vector

  // Search parameters (passed to Amadeus)
  searchParams: {
    origin: string;           // Airport/city code
    destination: string;      // Airport/city code
    departureDate: string;    // YYYY-MM-DD
    returnDate?: string;      // For round-trip
    adults: number;
    children?: number;
    infants?: number;
    travelClass?: FlightClass;
  };

  // Trip context for contextual scoring
  tripContext?: {
    tripPurpose?: 'LEISURE' | 'BUSINESS' | 'FAMILY' | 'ROMANTIC';
    budgetPerPerson?: number;
    flexibleDates?: boolean;
    flexibleAirport?: boolean;
    preferredAirlines?: string[];   // IATA codes
    avoidAirlines?: string[];       // IATA codes
    preferDirectFlights?: boolean;
    maxLayoverTime?: number;        // minutes
  };

  // Filtering
  filters?: {
    flightClasses?: FlightClass[];
    maxStops?: number;
    maxDuration?: number;           // minutes
    maxPrice?: number;
    departureTimeRange?: {
      earliest: string;             // HH:MM
      latest: string;               // HH:MM
    };
    arrivalTimeRange?: {
      earliest: string;
      latest: string;
    };
    airlines?: string[];            // Filter by specific airlines
    alliances?: AirlineAlliance[];
    requiredAmenities?: string[];   // ["wifi", "power", "entertainment"]
  };

  // Scoring configuration
  scoring?: {
    popularityWeight?: number;      // default: 0.25
    similarityWeight?: number;      // default: 0.45
    qualityWeight?: number;         // default: 0.2
    contextualWeight?: number;      // default: 0.1
    applySegmentBoost?: boolean;    // default: true
  };

  // Result configuration
  limit?: number;                   // Max results (default: 20)
  diversityFactor?: number;         // MMR lambda [0-1] (default: 0.6)
  includeExplanations?: boolean;    // default: true
}

/**
 * Recommendation Response
 */
export interface FlightRecommendationResponse {
  userId: string;
  count: number;
  recommendations: ScoredFlight[];

  metadata: {
    processingTime: number;         // milliseconds
    strategy: string;               // "hybrid" | "popularity_fallback" | "hybrid_with_favorites"
    cacheHit: boolean;
    amadeusResponseTime?: number;
    scoringTime?: number;
    favoritesUsed?: {                // Enriched user data used
      destinations: number;
      airlines: number;
    };
  };

  // Search context summary
  context?: {
    totalFlightsFound: number;
    filteredFlights: number;
    averagePrice: number;
    priceRange: { min: number; max: number };
    airlines: string[];
    fastestFlight?: {
      duration: number;             // minutes
      price: number;
    };
    cheapestFlight?: {
      duration: number;
      price: number;
    };
  };

  // Debugging info (dev mode only)
  debug?: {
    userVector: number[];
    userSegment: string;
    vectorizationTime: number;
  };
}

/**
 * Batch Vectorization Result
 */
export interface BatchFlightVectorizationResult {
  vectors: Map<string, FlightVector>;  // flightId -> vector
  processingTime: number;
  itemsProcessed: number;
  errors?: Array<{
    flightId: string;
    error: string;
  }>;
}

/**
 * Interaction Event
 */
export interface FlightInteraction {
  userId: string;
  flightId: string;
  type: 'view' | 'click' | 'book' | 'compare' | 'save';
  timestamp: Date;

  // Context
  searchParams?: {
    origin: string;
    destination: string;
    departureDate: string;
  };

  // Position in recommendations
  rank?: number;
  score?: number;
}

/**
 * Cache Key Generator
 */
export class FlightCacheKey {
  static forSearch(params: {
    origin: string;
    destination: string;
    departureDate: string;
    adults: number;
  }): string {
    return `flight:search:${params.origin}:${params.destination}:${params.departureDate}:${params.adults}`;
  }

  static forVector(flightId: string): string {
    return `flight:vector:${flightId}`;
  }

  static forRecommendations(
    userId: string,
    origin: string,
    destination: string,
    date: string
  ): string {
    return `flight:recs:${userId}:${origin}:${destination}:${date}`;
  }

  static forPopularity(route: string): string {
    return `flight:pop:${route}`;
  }
}

/**
 * Default Vectorization Configuration
 */
export const DEFAULT_FLIGHT_VECTORIZATION_CONFIG: FlightVectorizationConfig = {
  budget: {
    economyRange: [0, 300],
    premiumEconomyRange: [300, 600],
    businessRange: [600, 2000],
    firstClassRange: [2000, 10000],
    marketAveragePrice: 400, // EUR (calculated dynamically)
    currency: 'EUR',
  },
  activityLevel: {
    directFlightScore: 0.9,
    oneStopPenalty: 0.3,
    multiStopPenalty: 0.6,
    shortLayoverBonus: 0.1,
  },
  popularity: {
    airlineRatingWeight: 0.4,
    routePopularityWeight: 0.3,
    onTimeWeight: 0.2,
    reviewCountWeight: 0.1,
  },
};

/**
 * Default Scoring Weights
 */
export const DEFAULT_FLIGHT_SCORING_WEIGHTS = {
  similarity: 0.45,   // 45% cosine similarity with UserVector
  popularity: 0.25,   // 25% airline + route popularity
  quality: 0.2,       // 20% on-time, comfort, amenities
  contextual: 0.1,    // 10% price fit, timing, layover efficiency
};

/**
 * Segment-Specific Flight Class Boosts
 */
export const SEGMENT_FLIGHT_CLASS_BOOST: Record<string, Partial<Record<FlightClass, number>>> = {
  BUDGET_BACKPACKER: {
    [FlightClass.ECONOMY]: 1.3,
    [FlightClass.PREMIUM_ECONOMY]: 0.8,
    [FlightClass.BUSINESS]: 0.5,
    [FlightClass.FIRST_CLASS]: 0.3,
  },
  FAMILY_EXPLORER: {
    [FlightClass.ECONOMY]: 1.2,
    [FlightClass.PREMIUM_ECONOMY]: 1.15,
    [FlightClass.BUSINESS]: 0.9,
    [FlightClass.FIRST_CLASS]: 0.7,
  },
  LUXURY_TRAVELER: {
    [FlightClass.FIRST_CLASS]: 1.4,
    [FlightClass.BUSINESS]: 1.3,
    [FlightClass.PREMIUM_ECONOMY]: 1.1,
    [FlightClass.ECONOMY]: 0.6,
  },
  ADVENTURE_SEEKER: {
    [FlightClass.ECONOMY]: 1.2,
    [FlightClass.PREMIUM_ECONOMY]: 1.0,
    [FlightClass.BUSINESS]: 0.8,
    [FlightClass.FIRST_CLASS]: 0.6,
  },
  CULTURAL_ENTHUSIAST: {
    [FlightClass.ECONOMY]: 1.1,
    [FlightClass.PREMIUM_ECONOMY]: 1.15,
    [FlightClass.BUSINESS]: 1.1,
    [FlightClass.FIRST_CLASS]: 0.9,
  },
  ROMANTIC_COUPLE: {
    [FlightClass.BUSINESS]: 1.3,
    [FlightClass.PREMIUM_ECONOMY]: 1.2,
    [FlightClass.FIRST_CLASS]: 1.25,
    [FlightClass.ECONOMY]: 0.8,
  },
  BUSINESS_TRAVELER: {
    [FlightClass.BUSINESS]: 1.4,
    [FlightClass.PREMIUM_ECONOMY]: 1.2,
    [FlightClass.ECONOMY]: 0.9,
    [FlightClass.FIRST_CLASS]: 1.1,
  },
  WELLNESS_SEEKER: {
    [FlightClass.BUSINESS]: 1.3,
    [FlightClass.PREMIUM_ECONOMY]: 1.2,
    [FlightClass.ECONOMY]: 0.9,
    [FlightClass.FIRST_CLASS]: 1.2,
  },
};
