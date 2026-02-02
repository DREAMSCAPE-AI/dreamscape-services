/**
 * User Segmentation Types
 *
 * Defines the user segments used for cold start recommendations
 * and the associated types for segment assignment.
 *
 * @module segments/types
 */

/**
 * User segment categories
 *
 * Each segment represents a distinct traveler profile with specific
 * characteristics in terms of budget, travel style, group composition,
 * and activity preferences.
 */
export enum UserSegment {
  /**
   * Budget-conscious solo travelers or small groups
   * - Budget: Economic (<50€/day)
   * - Style: Adventure, flexibility
   * - Accommodation: Hostels, budget hotels
   * - Activity Level: High
   */
  BUDGET_BACKPACKER = 'BUDGET_BACKPACKER',

  /**
   * Families with children traveling together
   * - Budget: Medium (80-150€/day)
   * - Style: Family-friendly activities
   * - Accommodation: Apartments, family hotels
   * - Activity Level: Moderate
   */
  FAMILY_EXPLORER = 'FAMILY_EXPLORER',

  /**
   * High-budget travelers seeking premium experiences
   * - Budget: Premium (>200€/day)
   * - Style: Luxury, comfort, exclusive experiences
   * - Accommodation: 4-5 star hotels, luxury resorts
   * - Activity Level: Low to Moderate
   */
  LUXURY_TRAVELER = 'LUXURY_TRAVELER',

  /**
   * Active travelers seeking thrills and nature
   * - Budget: Medium to High
   * - Style: Outdoor activities, sports, off-beaten paths
   * - Accommodation: Variable
   * - Activity Level: Very High
   */
  ADVENTURE_SEEKER = 'ADVENTURE_SEEKER',

  /**
   * Travelers focused on cultural immersion
   * - Budget: Medium to High
   * - Style: Museums, heritage, gastronomy, local culture
   * - Accommodation: City hotels, boutique accommodations
   * - Activity Level: Moderate
   */
  CULTURAL_ENTHUSIAST = 'CULTURAL_ENTHUSIAST',

  /**
   * Couples seeking romantic experiences
   * - Budget: Medium to High
   * - Style: Intimate, romantic settings
   * - Accommodation: Romantic hotels, boutique stays
   * - Activity Level: Low to Moderate
   */
  ROMANTIC_COUPLE = 'ROMANTIC_COUPLE',

  /**
   * Business travelers with leisure time
   * - Budget: High (company-paid)
   * - Style: City breaks, efficient travel, comfort
   * - Accommodation: Business hotels, city center
   * - Activity Level: Low to Moderate
   */
  BUSINESS_LEISURE = 'BUSINESS_LEISURE',

  /**
   * Senior travelers prioritizing comfort
   * - Budget: Medium to High
   * - Style: Slow travel, culture, accessibility
   * - Accommodation: Comfortable hotels
   * - Activity Level: Low
   */
  SENIOR_COMFORT = 'SENIOR_COMFORT',
}

/**
 * Segment assignment with confidence score
 */
export interface SegmentAssignment {
  /**
   * The assigned segment
   */
  segment: UserSegment;

  /**
   * Confidence score [0-1]
   * Higher score means stronger match to segment characteristics
   */
  score: number;

  /**
   * Reasons for this assignment
   */
  reasons: string[];

  /**
   * When this segment was assigned
   */
  assignedAt: Date;
}

/**
 * Dimensions used for segment scoring
 */
export interface SegmentDimensions {
  /**
   * Budget dimension [0-1]
   * 0 = very low budget, 1 = very high budget
   */
  budget: number;

  /**
   * Travel group dimension [0-1]
   * 0 = solo, 0.5 = couple, 0.8 = family, 1 = large group
   */
  group: number;

  /**
   * Activity level dimension [0-1]
   * 0 = very relaxed, 1 = very active
   */
  activity: number;

  /**
   * Comfort/luxury dimension [0-1]
   * 0 = basic, 1 = luxury
   */
  comfort: number;

  /**
   * Age dimension [0-1]
   * 0 = young adult, 0.5 = middle-aged, 1 = senior
   */
  age: number;

  /**
   * Travel style dimension [0-1]
   * 0 = adventure/nature, 1 = culture/urban
   */
  style: number;

  /**
   * Business vs leisure [0-1]
   * 0 = pure leisure, 1 = pure business
   */
  businessMix: number;
}

/**
 * Segment scoring weights
 * Used to calculate segment match score
 */
export interface SegmentWeights {
  budget: number;
  group: number;
  activity: number;
  comfort: number;
  age: number;
  style: number;
  businessMix: number;
}

/**
 * Default weights for segment scoring
 * Total should sum to 1.0
 */
export const DEFAULT_SEGMENT_WEIGHTS: SegmentWeights = {
  budget: 0.25,      // Budget is important
  group: 0.20,       // Group composition matters
  activity: 0.15,    // Activity level
  comfort: 0.15,     // Comfort preferences
  age: 0.10,         // Age factor
  style: 0.10,       // Travel style
  businessMix: 0.05, // Business/leisure mix
};

/**
 * Segment assignment options
 */
export interface SegmentAssignmentOptions {
  /**
   * Maximum number of segments to assign
   * @default 3
   */
  maxSegments?: number;

  /**
   * Minimum score threshold for segment assignment
   * @default 0.3
   */
  minScore?: number;

  /**
   * Custom weights for scoring
   */
  weights?: Partial<SegmentWeights>;

  /**
   * Include reasons in assignment
   * @default true
   */
  includeReasons?: boolean;
}

/**
 * Segment update trigger
 */
export enum SegmentUpdateTrigger {
  /**
   * Initial assignment from onboarding
   */
  ONBOARDING = 'ONBOARDING',

  /**
   * Update based on user interactions
   */
  BEHAVIOR = 'BEHAVIOR',

  /**
   * Manual update/override
   */
  MANUAL = 'MANUAL',

  /**
   * Periodic recalculation
   */
  PERIODIC = 'PERIODIC',
}

/**
 * Segment update event
 */
export interface SegmentUpdateEvent {
  userId: string;
  previousSegments: SegmentAssignment[];
  newSegments: SegmentAssignment[];
  trigger: SegmentUpdateTrigger;
  timestamp: Date;
  metadata?: Record<string, any>;
}
