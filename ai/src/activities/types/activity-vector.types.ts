/**
 * Activity Vector Types
 *
 * Defines feature vectors and data structures for activity recommendations.
 * These types ensure compatibility with the existing UserVector 8D system while
 * capturing activity-specific features.
 *
 * @module activities/types
 * @ticket US-IA-004.1
 */

/**
 * 8-Dimensional Feature Vector
 *
 * Compatible with UserVector dimensions for cosine similarity calculation.
 * Each dimension is normalized to [0-1] range.
 */
export type ActivityVector = [
  number, // climate: Weather-dependent activities (outdoor vs indoor)
  number, // cultureNature: Cultural activities vs nature/adventure
  number, // budget: Relative price level [0=free/budget, 1=luxury]
  number, // activityLevel: Physical intensity [0=relaxed, 1=high intensity]
  number, // groupSize: Suitability for groups [0=solo/couple, 1=large groups]
  number, // urbanRural: Urban cultural vs rural nature [0=rural, 1=urban]
  number, // gastronomy: Food/culinary focus [0=none, 1=food-centric]
  number  // popularity: Overall quality score (ratings + bookings)
];

/**
 * Activity Category
 *
 * Primary categorization from Amadeus API.
 * Maps to user preferences and segments.
 */
export enum ActivityCategory {
  // Cultural
  MUSEUM = 'MUSEUM',
  HISTORICAL_SITE = 'HISTORICAL_SITE',
  ART_GALLERY = 'ART_GALLERY',
  CULTURAL_TOUR = 'CULTURAL_TOUR',
  ARCHITECTURE_TOUR = 'ARCHITECTURE_TOUR',

  // Entertainment
  SHOW = 'SHOW',
  CONCERT = 'CONCERT',
  THEATER = 'THEATER',
  NIGHTLIFE = 'NIGHTLIFE',
  FESTIVAL = 'FESTIVAL',

  // Adventure & Sports
  HIKING = 'HIKING',
  CLIMBING = 'CLIMBING',
  WATER_SPORTS = 'WATER_SPORTS',
  EXTREME_SPORTS = 'EXTREME_SPORTS',
  SKIING = 'SKIING',
  DIVING = 'DIVING',

  // Nature
  WILDLIFE = 'WILDLIFE',
  NATURE_TOUR = 'NATURE_TOUR',
  SAFARI = 'SAFARI',
  BEACH = 'BEACH',
  NATIONAL_PARK = 'NATIONAL_PARK',

  // Wellness & Relaxation
  SPA = 'SPA',
  YOGA = 'YOGA',
  WELLNESS = 'WELLNESS',
  MEDITATION = 'MEDITATION',

  // Gastronomy
  FOOD_TOUR = 'FOOD_TOUR',
  WINE_TASTING = 'WINE_TASTING',
  COOKING_CLASS = 'COOKING_CLASS',
  CULINARY_EXPERIENCE = 'CULINARY_EXPERIENCE',

  // General Tours
  CITY_TOUR = 'CITY_TOUR',
  BUS_TOUR = 'BUS_TOUR',
  WALKING_TOUR = 'WALKING_TOUR',
  BIKE_TOUR = 'BIKE_TOUR',
  BOAT_TOUR = 'BOAT_TOUR',

  // Family
  THEME_PARK = 'THEME_PARK',
  AQUARIUM = 'AQUARIUM',
  ZOO = 'ZOO',
  FAMILY_ACTIVITY = 'FAMILY_ACTIVITY',

  // Shopping
  SHOPPING_TOUR = 'SHOPPING_TOUR',
  MARKET_VISIT = 'MARKET_VISIT',

  // Photography
  PHOTOGRAPHY_TOUR = 'PHOTOGRAPHY_TOUR',

  // Other
  WORKSHOP = 'WORKSHOP',
  TOUR = 'TOUR', // Generic tour
  OTHER = 'OTHER',
}

/**
 * Activity Intensity Level
 *
 * Physical exertion required for the activity.
 */
export enum ActivityIntensity {
  LOW = 'LOW',           // Minimal physical activity (museums, shows)
  MODERATE = 'MODERATE', // Some walking or light activity
  HIGH = 'HIGH',         // Active participation (hiking, sports)
  VERY_HIGH = 'VERY_HIGH', // Intense physical exertion (climbing, extreme sports)
}

/**
 * Raw Activity Features
 *
 * Complete feature set extracted from Amadeus API data.
 * This is the input to the vectorization process.
 */
export interface ActivityFeatures {
  // Basic Information
  activityId: string;
  name: string;
  description: string;

  // Location
  location: {
    name: string;
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    cityCode?: string;
    countryCode?: string;
  };

  // Category and Type
  category: ActivityCategory;
  subCategories?: string[];

  // Intensity and Duration
  intensity: ActivityIntensity;
  duration: {
    value: number;    // Duration in minutes
    formatted: string; // "2 hours", "Half day", etc.
    isFlexible: boolean;
  };

  // Group Information
  groupSize: {
    min: number;
    max: number;
    typical: number; // Most common group size
  };

  // Pricing
  price: {
    amount: number;
    currency: string;
    perPerson: boolean;
    discountsAvailable: boolean;
  };

  // Ratings and Reviews
  rating: number; // 0-5 (from Amadeus or reviews)
  reviewCount: number;

  // Booking Information
  bookingInfo: {
    instantConfirmation: boolean;
    freeCancellation: boolean;
    cancellationPolicy?: string;
    minimumNotice?: string; // "24 hours", "1 week", etc.
  };

  // Media
  images: string[];
  videoUrl?: string;

  // Availability and Timing
  availability: {
    daysOfWeek?: string[]; // ["MON", "TUE", "WED"]
    timeSlots?: string[];  // ["09:00", "14:00", "18:00"]
    seasonal?: boolean;    // Only available certain seasons
    weatherDependent?: boolean;
  };

  // Features and Amenities
  features: {
    guidedTour: boolean;
    audioGuide: boolean;
    transportation: boolean;
    mealIncluded: boolean;
    equipmentProvided: boolean;
    accessible: boolean; // Wheelchair accessible
    childFriendly: boolean;
    petFriendly: boolean;
  };

  // Requirements
  requirements?: {
    minAge?: number;
    maxAge?: number;
    fitnessLevel?: string;
    languages?: string[];
    specialRequirements?: string[];
  };

  // Additional Metadata
  metadata?: {
    isPopular?: boolean;      // Trending or highly booked
    isNewListing?: boolean;   // Listed in last 3 months
    hostedBy?: string;        // Tour operator/provider
    certifications?: string[];
    tags?: string[];          // ["romantic", "instagram-worthy", etc.]
  };
}

/**
 * Vectorization Configuration
 *
 * Tunable weights for each dimension calculation.
 * Allows A/B testing and optimization.
 */
export interface ActivityVectorizationConfig {
  // Climate dimension weights
  climate: {
    outdoorWeight: number;      // Outdoor activities score higher
    weatherDependentWeight: number;
    seasonalWeight: number;
  };

  // Activity level dimension weights
  activityLevel: {
    lowIntensity: number;      // Maps to LOW intensity
    moderateIntensity: number; // Maps to MODERATE intensity
    highIntensity: number;     // Maps to HIGH intensity
    veryHighIntensity: number; // Maps to VERY_HIGH intensity
  };

  // Gastronomy dimension weights
  gastronomy: {
    foodTourWeight: number;
    culinaryExperienceWeight: number;
    mealIncludedBonus: number;
  };

  // Group size dimension weights
  groupSize: {
    soloWeight: number;         // Max 1-2 people
    coupleWeight: number;       // Max 2-4 people
    smallGroupWeight: number;   // Max 5-10 people
    largeGroupWeight: number;   // Max 10+ people
    childFriendlyBonus: number;
  };

  // Popularity dimension weights
  popularity: {
    ratingWeight: number;
    reviewCountWeight: number;
    bookingPopularityWeight: number;
    instantConfirmationBonus: number;
  };

  // Budget calculation
  budget: {
    marketAveragePrice: number; // Reference price for normalization
    currency: string;
  };
}

/**
 * Scored Activity Result
 *
 * Final output of the scoring algorithm, containing the activity
 * with its personalized score and explanation.
 */
export interface ScoredActivity {
  // Original data
  activity: ActivityFeatures;

  // Vector representation
  vector: ActivityVector;

  // Scoring results
  score: number; // Final weighted score [0-1]
  confidence: number; // Confidence in recommendation [0-1]

  // Score breakdown for explainability
  breakdown: {
    similarityScore: number;   // Cosine similarity with UserVector
    popularityScore: number;   // Popularity component
    qualityScore: number;      // Overall quality score
    contextualScore: number;   // Contextual factors (duration, budget match)
    segmentBoost: number;      // Segment-specific boost
    finalScore: number;        // Weighted combination
  };

  // Explanation for user
  reasons: string[]; // Human-readable reasons for recommendation

  // Ranking
  rank: number; // Position in final results (1-indexed)

  // Diversity tracking (for MMR)
  diversityContribution?: number;
}

/**
 * Recommendation Request Options
 *
 * Configuration for activity recommendation requests.
 */
export interface ActivityRecommendationOptions {
  // User context
  userId: string;
  userVector?: number[]; // Optional: provide pre-calculated vector

  // Search parameters
  searchParams: {
    cityCode?: string;
    location?: {
      latitude: number;
      longitude: number;
      radiusKm?: number; // Search radius (default: 50km)
    };
    dates?: {
      startDate: string;
      endDate: string;
    };
  };

  // Trip context (for personalization)
  tripContext?: {
    stayDuration: number;     // Total days in destination
    travelCompanions: string; // "solo", "couple", "family", "friends"
    budgetPerActivity?: number;
    timeAvailable?: number;   // Minutes available for activities
  };

  // Filtering
  filters?: {
    categories?: ActivityCategory[];
    intensityLevels?: ActivityIntensity[];
    minRating?: number;
    maxPrice?: number;
    maxDuration?: number;     // Max duration in minutes
    requiresFeatures?: string[]; // ["guidedTour", "transportation", etc.]
    onlyAvailableNow?: boolean;
    childFriendly?: boolean;
    accessible?: boolean;
  };

  // Scoring configuration
  scoring?: {
    popularityWeight?: number;   // 0-1 (default: 0.25)
    similarityWeight?: number;   // 0-1 (default: 0.5)
    qualityWeight?: number;      // 0-1 (default: 0.15)
    contextualWeight?: number;   // 0-1 (default: 0.1)
    applySegmentBoost?: boolean; // default: true
  };

  // Result configuration
  limit?: number;               // Max results to return (default: 20)
  diversityFactor?: number;     // MMR lambda [0-1] (default: 0.7)
  includeExplanations?: boolean; // Include reasons (default: true)
}

/**
 * Recommendation Response
 *
 * Complete response from the recommendation service.
 */
export interface ActivityRecommendationResponse {
  userId: string;
  count: number;
  recommendations: ScoredActivity[];

  metadata: {
    processingTime: number; // milliseconds
    strategy: string; // "hybrid" | "similarity_only" | "popularity_fallback"
    cacheHit: boolean;
    amadeusResponseTime?: number;
    scoringTime?: number;
  };

  // Context summary
  context?: {
    totalActivitiesFound: number;
    filteredActivities: number;
    averagePrice: number;
    categories: string[];
  };

  // Debugging info (only in dev mode)
  debug?: {
    userVector: number[];
    userSegment: string;
    vectorizationTime: number;
  };
}

/**
 * Batch Vectorization Result
 */
export interface BatchActivityVectorizationResult {
  vectors: Map<string, ActivityVector>; // activityId -> vector
  processingTime: number;
  itemsProcessed: number;
  errors?: Array<{
    activityId: string;
    error: string;
  }>;
}

/**
 * Interaction Event
 *
 * Tracks user interactions with activity recommendations
 * for refinement and learning.
 */
export interface ActivityInteraction {
  userId: string;
  activityId: string;
  type: 'view' | 'click' | 'book' | 'like' | 'dislike' | 'wishlist';
  timestamp: Date;

  // Context
  searchParams?: {
    cityCode: string;
    dates?: {
      startDate: string;
      endDate: string;
    };
  };

  // Position in recommendations
  rank?: number;
  score?: number;
}

/**
 * Cache Key Generator
 */
export class ActivityCacheKey {
  static forSearch(params: {
    cityCode?: string;
    location?: string;
    dates?: string;
  }): string {
    const loc = params.cityCode || params.location || 'global';
    const date = params.dates || 'anytime';
    return `act:search:${loc}:${date}`;
  }

  static forVector(activityId: string): string {
    return `act:vector:${activityId}`;
  }

  static forRecommendations(userId: string, cityCode: string, date?: string): string {
    const dateStr = date || 'anytime';
    return `act:recs:${userId}:${cityCode}:${dateStr}`;
  }

  static forPopularity(cityCode: string): string {
    return `act:pop:${cityCode}`;
  }
}

/**
 * Default Vectorization Configuration
 *
 * Baseline weights optimized for balanced recommendations.
 */
export const DEFAULT_ACTIVITY_VECTORIZATION_CONFIG: ActivityVectorizationConfig = {
  climate: {
    outdoorWeight: 0.6,
    weatherDependentWeight: 0.3,
    seasonalWeight: 0.1,
  },
  activityLevel: {
    lowIntensity: 0.1,
    moderateIntensity: 0.3,
    highIntensity: 0.4,
    veryHighIntensity: 0.2,
  },
  gastronomy: {
    foodTourWeight: 0.5,
    culinaryExperienceWeight: 0.4,
    mealIncludedBonus: 0.1,
  },
  groupSize: {
    soloWeight: 0.2,
    coupleWeight: 0.3,
    smallGroupWeight: 0.3,
    largeGroupWeight: 0.2,
    childFriendlyBonus: 0.1,
  },
  popularity: {
    ratingWeight: 0.4,
    reviewCountWeight: 0.3,
    bookingPopularityWeight: 0.2,
    instantConfirmationBonus: 0.1,
  },
  budget: {
    marketAveragePrice: 50, // EUR per activity (calculated dynamically)
    currency: 'EUR',
  },
};

/**
 * Default Scoring Weights
 */
export const DEFAULT_ACTIVITY_SCORING_WEIGHTS = {
  similarity: 0.5,    // 50% cosine similarity with UserVector
  popularity: 0.25,   // 25% popularity score
  quality: 0.15,      // 15% objective quality (ratings)
  contextual: 0.1,    // 10% contextual factors (duration, budget match)
};

/**
 * Segment-Specific Category Boosts
 *
 * Multipliers applied based on user segment and activity category match.
 */
export const SEGMENT_ACTIVITY_BOOST: Record<string, Partial<Record<ActivityCategory, number>>> = {
  BUDGET_BACKPACKER: {
    [ActivityCategory.WALKING_TOUR]: 1.3,
    [ActivityCategory.MARKET_VISIT]: 1.25,
    [ActivityCategory.HIKING]: 1.2,
    [ActivityCategory.SHOW]: 0.7,
    [ActivityCategory.FINE_DINING]: 0.5,
  },
  FAMILY_EXPLORER: {
    [ActivityCategory.FAMILY_ACTIVITY]: 1.4,
    [ActivityCategory.THEME_PARK]: 1.35,
    [ActivityCategory.ZOO]: 1.3,
    [ActivityCategory.AQUARIUM]: 1.3,
    [ActivityCategory.MUSEUM]: 1.15,
    [ActivityCategory.NIGHTLIFE]: 0.4,
    [ActivityCategory.EXTREME_SPORTS]: 0.5,
  },
  LUXURY_TRAVELER: {
    [ActivityCategory.CULINARY_EXPERIENCE]: 1.4,
    [ActivityCategory.WINE_TASTING]: 1.35,
    [ActivityCategory.SPA]: 1.3,
    [ActivityCategory.THEATER]: 1.25,
    [ActivityCategory.BUS_TOUR]: 0.6,
    [ActivityCategory.MARKET_VISIT]: 0.7,
  },
  ADVENTURE_SEEKER: {
    [ActivityCategory.EXTREME_SPORTS]: 1.4,
    [ActivityCategory.CLIMBING]: 1.35,
    [ActivityCategory.DIVING]: 1.3,
    [ActivityCategory.WATER_SPORTS]: 1.3,
    [ActivityCategory.HIKING]: 1.25,
    [ActivityCategory.SAFARI]: 1.2,
    [ActivityCategory.MUSEUM]: 0.6,
    [ActivityCategory.SHOW]: 0.7,
  },
  CULTURAL_ENTHUSIAST: {
    [ActivityCategory.MUSEUM]: 1.4,
    [ActivityCategory.HISTORICAL_SITE]: 1.35,
    [ActivityCategory.ART_GALLERY]: 1.3,
    [ActivityCategory.CULTURAL_TOUR]: 1.3,
    [ActivityCategory.ARCHITECTURE_TOUR]: 1.25,
    [ActivityCategory.THEATER]: 1.2,
    [ActivityCategory.CONCERT]: 1.15,
    [ActivityCategory.EXTREME_SPORTS]: 0.5,
    [ActivityCategory.THEME_PARK]: 0.6,
  },
  ROMANTIC_COUPLE: {
    [ActivityCategory.CULINARY_EXPERIENCE]: 1.35,
    [ActivityCategory.WINE_TASTING]: 1.3,
    [ActivityCategory.SPA]: 1.3,
    [ActivityCategory.BOAT_TOUR]: 1.25,
    [ActivityCategory.SHOW]: 1.2,
    [ActivityCategory.PHOTOGRAPHY_TOUR]: 1.15,
    [ActivityCategory.FAMILY_ACTIVITY]: 0.4,
    [ActivityCategory.THEME_PARK]: 0.5,
  },
  BUSINESS_TRAVELER: {
    [ActivityCategory.CITY_TOUR]: 1.3,
    [ActivityCategory.MUSEUM]: 1.2,
    [ActivityCategory.CULINARY_EXPERIENCE]: 1.15,
    [ActivityCategory.WELLNESS]: 1.1,
    [ActivityCategory.EXTREME_SPORTS]: 0.6,
    [ActivityCategory.FAMILY_ACTIVITY]: 0.5,
  },
  WELLNESS_SEEKER: {
    [ActivityCategory.SPA]: 1.4,
    [ActivityCategory.YOGA]: 1.35,
    [ActivityCategory.WELLNESS]: 1.35,
    [ActivityCategory.MEDITATION]: 1.3,
    [ActivityCategory.NATURE_TOUR]: 1.2,
    [ActivityCategory.HIKING]: 1.15,
    [ActivityCategory.NIGHTLIFE]: 0.5,
    [ActivityCategory.EXTREME_SPORTS]: 0.6,
  },
};
