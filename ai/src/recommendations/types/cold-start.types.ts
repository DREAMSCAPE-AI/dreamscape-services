/**
 * Cold Start Types
 *
 * Defines types for cold start recommendation strategies
 *
 * @module recommendations/types/cold-start
 */

import { UserSegment } from '../../segments/types/segment.types';
import { FeatureVector } from '../../segments/segment-to-vector.service';

/**
 * Cold start recommendation strategy
 */
export enum ColdStartStrategy {
  /**
   * Pure popularity-based (no personalization)
   */
  POPULARITY_ONLY = 'POPULARITY_ONLY',

  /**
   * Hybrid: popularity + segment profile
   */
  HYBRID_SEGMENT = 'HYBRID_SEGMENT',

  /**
   * Hybrid: popularity + user preferences (if available)
   */
  HYBRID_PREFERENCES = 'HYBRID_PREFERENCES',

  /**
   * Adaptive: chooses strategy based on data availability
   */
  ADAPTIVE = 'ADAPTIVE',
}

/**
 * Cold start recommendation options
 */
export interface ColdStartOptions {
  /**
   * Recommendation strategy to use
   * @default ADAPTIVE
   */
  strategy?: ColdStartStrategy;

  /**
   * Number of recommendations to generate
   * @default 20
   */
  limit?: number;

  /**
   * Weight for popularity component [0-1]
   * @default 0.4
   */
  popularityWeight?: number;

  /**
   * Diversification factor [0-1]
   * Higher = more diverse results
   * @default 0.3
   */
  diversityFactor?: number;

  /**
   * Minimum score threshold
   * @default 0.2
   */
  minScore?: number;

  /**
   * Include explanation/reasoning
   * @default false
   */
  includeReasons?: boolean;

  /**
   * Budget filter
   */
  budgetRange?: {
    min: number;
    max: number;
    currency: string;
  };

  /**
   * Climate preferences
   */
  climatePreferences?: string[];

  /**
   * Exclude already booked destinations
   * @default true
   */
  excludeBooked?: boolean;
}

/**
 * Hybrid scoring options
 */
export interface HybridScoringOptions {
  /**
   * Popularity weight [0-1]
   * @default 0.3
   */
  popularityWeight?: number;

  /**
   * Similarity weight [0-1]
   * @default 0.7
   */
  similarityWeight?: number;

  /**
   * Apply segment boost
   * @default true
   */
  applySegmentBoost?: boolean;

  /**
   * Boost factor for segment-matched items
   * @default 1.2
   */
  segmentBoostFactor?: number;
}

/**
 * Cold start recommendation result
 */
export interface ColdStartRecommendation {
  /**
   * Destination identifier
   */
  destinationId: string;

  /**
   * Destination name
   */
  destinationName: string;

  /**
   * Destination type
   */
  destinationType: string;

  /**
   * Final recommendation score [0-1]
   */
  score: number;

  /**
   * Confidence in this recommendation [0-1]
   */
  confidence: number;

  /**
   * Score breakdown
   */
  breakdown?: {
    popularityScore: number;
    similarityScore?: number;
    segmentScore?: number;
    finalScore: number;
  };

  /**
   * Reasons for recommendation
   */
  reasons: string[];

  /**
   * Strategy used
   */
  strategy: ColdStartStrategy;

  /**
   * Ranking position
   */
  rank: number;
}

/**
 * Filter result for cold start
 */
export interface FilterResult {
  /**
   * Filtered items
   */
  items: any[];

  /**
   * Number of items filtered out
   */
  filteredCount: number;

  /**
   * Filters applied
   */
  filtersApplied: string[];
}

/**
 * Diversification options
 */
export interface DiversificationOptions {
  /**
   * Diversity factor [0-1]
   */
  factor: number;

  /**
   * Minimum distance between items
   */
  minDistance?: number;

  /**
   * Use Maximum Marginal Relevance
   * @default true
   */
  useMMR?: boolean;

  /**
   * Diversity dimensions to consider
   */
  dimensions?: DiversityDimension[];
}

/**
 * Diversity dimensions
 */
export enum DiversityDimension {
  /**
   * Geographic diversity (region, country)
   */
  GEOGRAPHIC = 'GEOGRAPHIC',

  /**
   * Category diversity (beach, city, mountain)
   */
  CATEGORY = 'CATEGORY',

  /**
   * Budget diversity (low, medium, high)
   */
  BUDGET = 'BUDGET',

  /**
   * Activity diversity (culture, adventure, relaxation)
   */
  ACTIVITY = 'ACTIVITY',

  /**
   * Climate diversity (tropical, temperate, cold)
   */
  CLIMATE = 'CLIMATE',
}

/**
 * Cold start context
 */
export interface ColdStartContext {
  /**
   * User ID
   */
  userId: string;

  /**
   * User segment (if available)
   */
  segment?: UserSegment;

  /**
   * User vector (if available)
   */
  userVector?: FeatureVector;

  /**
   * Data completeness [0-1]
   */
  dataCompleteness: number;

  /**
   * Is first-time user
   */
  isFirstTime: boolean;

  /**
   * Previous bookings count
   */
  previousBookings: number;

  /**
   * Onboarding completed
   */
  onboardingCompleted: boolean;
}

/**
 * Fallback strategy configuration
 */
export interface FallbackConfig {
  /**
   * Enable fallback to popularity-only
   * @default true
   */
  enabled: boolean;

  /**
   * Conditions that trigger fallback
   */
  triggers: {
    /**
     * Trigger if confidence below threshold
     */
    lowConfidenceThreshold?: number;

    /**
     * Trigger if not enough personalized results
     */
    minPersonalizedResults?: number;

    /**
     * Trigger on error
     */
    onError?: boolean;
  };
}
