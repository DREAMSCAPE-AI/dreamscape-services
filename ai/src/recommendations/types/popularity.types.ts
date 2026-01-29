/**
 * Popularity Types
 *
 * Defines types for the popularity-based recommendation system
 *
 * @module recommendations/types/popularity
 */

import { UserSegment } from '../../segments/types/segment.types';

/**
 * Popularity scoring weights
 *
 * Controls the importance of each factor in popularity calculation
 * Total should sum to 1.0
 */
export interface PopularityWeights {
  /**
   * Weight for booking count (strong signal)
   * @default 0.40
   */
  bookings: number;

  /**
   * Weight for search count (interest signal)
   * @default 0.15
   */
  searches: number;

  /**
   * Weight for view count (discovery signal)
   * @default 0.10
   */
  views: number;

  /**
   * Weight for quality score (rating + reviews)
   * @default 0.20
   */
  quality: number;

  /**
   * Weight for trend factor (growth rate)
   * @default 0.10
   */
  trend: number;

  /**
   * Weight for seasonal boost
   * @default 0.05
   */
  seasonality: number;
}

/**
 * Default popularity weights
 */
export const DEFAULT_POPULARITY_WEIGHTS: PopularityWeights = {
  bookings: 0.40,
  searches: 0.15,
  views: 0.10,
  quality: 0.20,
  trend: 0.10,
  seasonality: 0.05,
};

/**
 * Popularity metrics for a destination
 */
export interface PopularityMetrics {
  /**
   * Destination identifier
   */
  destinationId: string;

  /**
   * Total number of bookings
   */
  bookingCount: number;

  /**
   * Total number of searches
   */
  searchCount: number;

  /**
   * Total number of views
   */
  viewCount: number;

  /**
   * Average rating [0-5]
   */
  averageRating: number;

  /**
   * Number of reviews
   */
  reviewCount: number;

  /**
   * Recent growth rate (30-day)
   * Positive = growing, Negative = declining
   */
  trendFactor: number;

  /**
   * Current season boost [0-1]
   */
  seasonalityBoost: number;

  /**
   * Last booking timestamp
   */
  lastBookedAt?: Date;

  /**
   * Last updated timestamp
   */
  updatedAt: Date;
}

/**
 * Calculated popularity score
 */
export interface PopularityScore {
  /**
   * Destination identifier
   */
  destinationId: string;

  /**
   * Final popularity score [0-1]
   */
  score: number;

  /**
   * Normalized component scores
   */
  components: {
    bookings: number;
    searches: number;
    views: number;
    quality: number;
    trend: number;
    seasonality: number;
  };

  /**
   * Recency decay factor [0-1]
   */
  recencyFactor: number;

  /**
   * When this score was calculated
   */
  calculatedAt: Date;
}

/**
 * Popular destinations query options
 */
export interface PopularDestinationsOptions {
  /**
   * Number of results to return
   * @default 20
   */
  limit?: number;

  /**
   * Filter by user segment
   */
  segment?: UserSegment;

  /**
   * Filter by destination category
   */
  category?: DestinationCategory;

  /**
   * Filter by region
   */
  region?: string;

  /**
   * Current season for seasonality boost
   */
  season?: Season;

  /**
   * Minimum popularity score threshold
   * @default 0.3
   */
  minScore?: number;

  /**
   * Include detailed breakdown
   * @default false
   */
  includeBreakdown?: boolean;
}

/**
 * Destination categories
 */
export enum DestinationCategory {
  BEACH = 'BEACH',
  CITY = 'CITY',
  MOUNTAIN = 'MOUNTAIN',
  NATURE = 'NATURE',
  CULTURAL = 'CULTURAL',
  ADVENTURE = 'ADVENTURE',
  LUXURY_RESORT = 'LUXURY_RESORT',
  ISLAND = 'ISLAND',
  HISTORICAL = 'HISTORICAL',
  THEME_PARK = 'THEME_PARK',
}

/**
 * Seasons for seasonality calculations
 */
export enum Season {
  SPRING = 'SPRING',
  SUMMER = 'SUMMER',
  FALL = 'FALL',
  WINTER = 'WINTER',
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  /**
   * Destination identifier
   */
  destinationId: string;

  /**
   * Growth rate percentage (30-day)
   */
  growthRate: number;

  /**
   * Booking trend direction
   */
  direction: 'rising' | 'stable' | 'declining';

  /**
   * Bookings in last 30 days
   */
  recent Bookings: number;

  /**
   * Bookings in previous 30 days
   */
  previousBookings: number;

  /**
   * Analysis timestamp
   */
  analyzedAt: Date;
}

/**
 * Quality score calculation
 */
export interface QualityScore {
  /**
   * Raw average rating [0-5]
   */
  averageRating: number;

  /**
   * Number of reviews
   */
  reviewCount: number;

  /**
   * Wilson score lower bound [0-1]
   * Accounts for number of reviews
   */
  wilsonScore: number;

  /**
   * Final normalized quality score [0-1]
   */
  normalizedScore: number;
}

/**
 * Cache metadata
 */
export interface PopularityCacheMetadata {
  /**
   * When cache was last updated
   */
  lastUpdated: Date;

  /**
   * TTL in seconds
   */
  ttl: number;

  /**
   * Number of cached destinations
   */
  itemCount: number;

  /**
   * Cache hit rate percentage
   */
  hitRate?: number;

  /**
   * Version of popularity algorithm
   */
  algorithmVersion: string;
}

/**
 * Popularity refresh job result
 */
export interface PopularityRefreshResult {
  /**
   * Job success status
   */
  success: boolean;

  /**
   * Number of destinations updated
   */
  destinationsUpdated: number;

  /**
   * Job duration in milliseconds
   */
  duration: number;

  /**
   * Top destination after refresh
   */
  topDestination?: {
    id: string;
    name: string;
    score: number;
  };

  /**
   * Average score across all destinations
   */
  averageScore: number;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Job completion timestamp
   */
  completedAt: Date;
}

/**
 * Normalization bounds for metrics
 */
export interface NormalizationBounds {
  /**
   * Minimum value
   */
  min: number;

  /**
   * Maximum value
   */
  max: number;
}

/**
 * Global normalization stats
 */
export interface PopularityStats {
  /**
   * Booking count bounds
   */
  bookings: NormalizationBounds;

  /**
   * Search count bounds
   */
  searches: NormalizationBounds;

  /**
   * View count bounds
   */
  views: NormalizationBounds;

  /**
   * Rating bounds
   */
  ratings: NormalizationBounds;

  /**
   * Total destinations analyzed
   */
  totalDestinations: number;

  /**
   * Stats calculation timestamp
   */
  calculatedAt: Date;
}
