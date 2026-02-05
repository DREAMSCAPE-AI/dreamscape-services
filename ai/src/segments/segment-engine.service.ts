/**
 * Segment Engine Service
 *
 * Assigns user segments based on onboarding preferences and behavior.
 * Calculates segment scores using multi-dimensional scoring algorithm.
 *
 * @module segments/segment-engine
 */

import {
  UserSegment,
  SegmentAssignment,
  SegmentDimensions,
  SegmentWeights,
  DEFAULT_SEGMENT_WEIGHTS,
  SegmentAssignmentOptions,
} from './types/segment.types';
import { SEGMENT_PROFILES, SegmentProfile } from './types/segment-profile.types';

// Import AI user preferences interface (this would come from user service)
interface AIUserPreferences {
  userId: string;
  isOnboardingCompleted: boolean;
  preferences: {
    destinations: {
      regions?: string[];
      countries?: string[];
      climates?: string[];
    };
    budget: {
      globalRange?: {
        min: number;
        max: number;
        currency: string;
      };
      flexibility: 'strict' | 'flexible' | 'very_flexible' | null;
    };
    travel: {
      types: string[];
      purposes: string[];
      style: 'planned' | 'spontaneous' | 'mixed' | null;
      groupTypes: string[];
      travelWithChildren: boolean;
      childrenAges: number[];
    };
    timing: {
      preferredSeasons: string[];
      dateFlexibility: 'flexible' | 'semi_flexible' | 'fixed' | null;
    };
    accommodation: {
      types: string[];
      comfortLevel: 'basic' | 'standard' | 'premium' | 'luxury' | null;
    };
    transport: {
      preferredAirlines: string[];
      cabinClass?: string;
      modes: string[];
    };
    activities: {
      types: string[];
      interests: string[];
      activityLevel: 'low' | 'moderate' | 'high' | 'very_high' | null;
    };
    experience: {
      level?: string;
      riskTolerance: 'conservative' | 'moderate' | 'adventurous' | null;
    };
    climate: {
      preferences: string[];
    };
  };
  metadata: {
    completedSteps: string[];
    dataQuality: {
      completeness: number;
      confidence: number;
    };
  };
}

/**
 * Segment Engine Service
 */
export class SegmentEngineService {
  /**
   * Assign segment(s) to a user based on their preferences
   *
   * @param profile - User's AI preferences from onboarding
   * @param options - Segment assignment options
   * @returns Array of segment assignments with scores
   */
  async assignSegment(
    profile: AIUserPreferences,
    options: SegmentAssignmentOptions = {}
  ): Promise<SegmentAssignment[]> {
    const {
      maxSegments = 3,
      minScore = 0.3,
      weights = DEFAULT_SEGMENT_WEIGHTS,
      includeReasons = true,
    } = options;

    // Calculate dimensions from profile
    const dimensions = this.calculateDimensions(profile);

    // Calculate scores for all segments
    const segmentScores = this.calculateSegmentScores(dimensions, weights);

    // Sort by score descending
    const sortedSegments = Array.from(segmentScores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score >= minScore)
      .slice(0, maxSegments);

    // Create segment assignments
    const assignments: SegmentAssignment[] = sortedSegments.map(([segment, score]) => {
      const reasons = includeReasons
        ? this.generateReasons(segment, dimensions, profile)
        : [];

      return {
        segment,
        score,
        reasons,
        assignedAt: new Date(),
      };
    });

    return assignments;
  }

  /**
   * Update segment based on user behavior/interactions
   *
   * @param userId - User ID
   * @param interactions - User interaction data
   * @returns Updated segment assignments
   */
  async updateSegmentFromBehavior(
    userId: string,
    interactions: any[]
  ): Promise<SegmentAssignment[]> {
    // TODO: Implement behavior-based segment refinement
    // This would analyze:
    // - Destinations clicked/viewed
    // - Booking patterns
    // - Price ranges of selected items
    // - Activity types engaged with
    // And adjust segment scores accordingly

    throw new Error('Behavior-based segment update not yet implemented');
  }

  /**
   * Get segment profile for a given segment
   *
   * @param segment - User segment enum
   * @returns Segment profile with characteristics
   */
  getSegmentProfile(segment: UserSegment): SegmentProfile {
    return SEGMENT_PROFILES[segment];
  }

  /**
   * Calculate dimension values from user preferences
   *
   * @param profile - User preferences
   * @returns Normalized dimension values [0-1]
   */
  private calculateDimensions(profile: AIUserPreferences): SegmentDimensions {
    return {
      budget: this.calculateBudgetDimension(profile.preferences.budget),
      group: this.calculateGroupDimension(profile.preferences.travel),
      activity: this.calculateActivityDimension(profile.preferences.activities),
      comfort: this.calculateComfortDimension(profile.preferences.accommodation),
      age: this.calculateAgeDimension(profile.preferences), // Estimated from other factors
      style: this.calculateStyleDimension(profile.preferences),
      businessMix: this.calculateBusinessMixDimension(profile.preferences.travel),
    };
  }

  /**
   * Calculate segment scores for all segments
   *
   * @param userDimensions - User's dimension values
   * @param weights - Scoring weights
   * @returns Map of segment to score
   */
  private calculateSegmentScores(
    userDimensions: SegmentDimensions,
    weights: Partial<SegmentWeights>
  ): Map<UserSegment, number> {
    const finalWeights = { ...DEFAULT_SEGMENT_WEIGHTS, ...weights };
    const scores = new Map<UserSegment, number>();

    // For each segment, calculate similarity score
    for (const [segmentKey, segmentProfile] of Object.entries(SEGMENT_PROFILES)) {
      const segment = segmentKey as UserSegment;
      const segmentDimensions = segmentProfile.dimensions;

      // Calculate weighted distance (inverted to get similarity)
      let totalDistance = 0;
      let totalWeight = 0;

      for (const [dim, weight] of Object.entries(finalWeights)) {
        const dimKey = dim as keyof SegmentDimensions;
        const userValue = userDimensions[dimKey];
        const segmentValue = segmentDimensions[dimKey];

        // Euclidean distance for this dimension
        const distance = Math.abs(userValue - segmentValue);
        totalDistance += distance * weight;
        totalWeight += weight;
      }

      // Normalize and convert to similarity [0-1]
      const avgDistance = totalDistance / totalWeight;
      const similarity = 1 - avgDistance; // Closer = higher score

      scores.set(segment, Math.max(0, similarity));
    }

    return scores;
  }

  /**
   * Calculate budget dimension [0-1]
   * 0 = very low budget (<30€/day)
   * 0.5 = medium budget (~100€/day)
   * 1 = very high budget (>300€/day)
   */
  private calculateBudgetDimension(budget: AIUserPreferences['preferences']['budget']): number {
    if (!budget.globalRange) return 0.5; // Default medium

    const { min, max } = budget.globalRange;
    const avgBudget = (min + max) / 2;

    // Logarithmic scaling for budget
    // 20€ -> 0.1, 50€ -> 0.3, 100€ -> 0.5, 200€ -> 0.75, 400€ -> 0.95
    const logBudget = Math.log10(avgBudget);
    const normalized = (logBudget - Math.log10(20)) / (Math.log10(500) - Math.log10(20));

    return Math.max(0, Math.min(1, normalized));
  }

  /**
   * Calculate group dimension [0-1]
   * 0 = solo, 0.5 = couple, 0.9 = family with children, 0.7 = group
   */
  private calculateGroupDimension(travel: AIUserPreferences['preferences']['travel']): number {
    const { groupTypes, travelWithChildren, childrenAges } = travel;

    if (travelWithChildren || childrenAges.length > 0) {
      return 0.9; // Family
    }

    if (groupTypes.includes('SOLO')) {
      return 0.1;
    }

    if (groupTypes.includes('COUPLE')) {
      return 0.5;
    }

    if (groupTypes.includes('FAMILY')) {
      return 0.85;
    }

    if (groupTypes.includes('FRIENDS') || groupTypes.includes('GROUP')) {
      return 0.7;
    }

    return 0.3; // Default
  }

  /**
   * Calculate activity dimension [0-1]
   * 0 = very relaxed, 1 = very active
   */
  private calculateActivityDimension(
    activities: AIUserPreferences['preferences']['activities']
  ): number {
    const { activityLevel } = activities;

    const mapping: Record<string, number> = {
      low: 0.2,
      moderate: 0.5,
      high: 0.8,
      very_high: 0.95,
    };

    return mapping[activityLevel || 'moderate'] || 0.5;
  }

  /**
   * Calculate comfort dimension [0-1]
   * 0 = basic, 1 = luxury
   */
  private calculateComfortDimension(
    accommodation: AIUserPreferences['preferences']['accommodation']
  ): number {
    const { comfortLevel } = accommodation;

    const mapping: Record<string, number> = {
      basic: 0.2,
      standard: 0.5,
      premium: 0.75,
      luxury: 0.95,
    };

    return mapping[comfortLevel || 'standard'] || 0.5;
  }

  /**
   * Calculate age dimension [0-1]
   * Estimated from other preferences (no direct age data)
   * 0 = young adult, 0.5 = middle-aged, 1 = senior
   */
  private calculateAgeDimension(preferences: AIUserPreferences['preferences']): number {
    let ageScore = 0.4; // Default middle-aged

    // Indicators of younger travelers
    if (preferences.activities.activityLevel === 'very_high') ageScore -= 0.2;
    if (preferences.budget.globalRange && preferences.budget.globalRange.max < 80) ageScore -= 0.15;
    if (preferences.accommodation.types.includes('HOSTEL')) ageScore -= 0.2;
    if (preferences.experience.riskTolerance === 'adventurous') ageScore -= 0.1;

    // Indicators of older travelers
    if (preferences.accommodation.comfortLevel === 'luxury') ageScore += 0.15;
    if (preferences.activities.activityLevel === 'low') ageScore += 0.2;
    if (preferences.travel.types.includes('CRUISE')) ageScore += 0.25;
    if (preferences.accommodation.types.includes('CRUISE')) ageScore += 0.2;

    return Math.max(0, Math.min(1, ageScore));
  }

  /**
   * Calculate style dimension [0-1]
   * 0 = adventure/nature focused, 1 = culture/urban focused
   */
  private calculateStyleDimension(preferences: AIUserPreferences['preferences']): number {
    const { travel, activities } = preferences;

    let styleScore = 0.5; // Default balanced

    // Culture indicators
    if (travel.types.includes('CULTURAL')) styleScore += 0.2;
    if (activities.interests.includes('MUSEUMS')) styleScore += 0.15;
    if (activities.interests.includes('GASTRONOMY')) styleScore += 0.1;
    if (activities.interests.includes('SHOPPING')) styleScore += 0.1;
    if (activities.interests.includes('ARCHITECTURE')) styleScore += 0.1;

    // Nature/Adventure indicators
    if (travel.types.includes('ADVENTURE')) styleScore -= 0.2;
    if (travel.types.includes('NATURE')) styleScore -= 0.15;
    if (activities.interests.includes('HIKING')) styleScore -= 0.15;
    if (activities.interests.includes('OUTDOOR')) styleScore -= 0.15;
    if (activities.interests.includes('WILDLIFE')) styleScore -= 0.1;

    return Math.max(0, Math.min(1, styleScore));
  }

  /**
   * Calculate business mix dimension [0-1]
   * 0 = pure leisure, 1 = pure business
   */
  private calculateBusinessMixDimension(
    travel: AIUserPreferences['preferences']['travel']
  ): number {
    const { types, purposes } = travel;

    if (types.includes('BUSINESS')) return 0.7;
    if (purposes.includes('BUSINESS')) return 0.6;
    if (types.includes('BLEISURE')) return 0.5;

    return 0.0; // Pure leisure
  }

  /**
   * Generate reasons for segment assignment
   *
   * @param segment - Assigned segment
   * @param dimensions - User dimensions
   * @param profile - Full user profile
   * @returns Array of reason strings
   */
  private generateReasons(
    segment: UserSegment,
    dimensions: SegmentDimensions,
    profile: AIUserPreferences
  ): string[] {
    const reasons: string[] = [];
    const segmentProfile = SEGMENT_PROFILES[segment];

    // Budget match
    if (Math.abs(dimensions.budget - segmentProfile.dimensions.budget) < 0.15) {
      const budgetLevel =
        dimensions.budget < 0.3 ? 'budget-conscious' :
        dimensions.budget < 0.6 ? 'moderate budget' :
        dimensions.budget < 0.8 ? 'premium budget' : 'luxury budget';
      reasons.push(`${budgetLevel} aligns with segment`);
    }

    // Group composition
    if (Math.abs(dimensions.group - segmentProfile.dimensions.group) < 0.2) {
      if (profile.preferences.travel.travelWithChildren) {
        reasons.push('traveling with children');
      } else if (profile.preferences.travel.groupTypes.includes('COUPLE')) {
        reasons.push('couple travel preference');
      } else if (profile.preferences.travel.groupTypes.includes('SOLO')) {
        reasons.push('solo travel preference');
      }
    }

    // Activity level
    if (Math.abs(dimensions.activity - segmentProfile.dimensions.activity) < 0.15) {
      const activityDesc = profile.preferences.activities.activityLevel;
      reasons.push(`${activityDesc} activity level match`);
    }

    // Comfort preferences
    if (Math.abs(dimensions.comfort - segmentProfile.dimensions.comfort) < 0.15) {
      const comfortDesc = profile.preferences.accommodation.comfortLevel;
      reasons.push(`${comfortDesc} comfort preference`);
    }

    // Travel style
    if (dimensions.style > 0.6 && segmentProfile.dimensions.style > 0.6) {
      reasons.push('cultural/urban focus');
    } else if (dimensions.style < 0.4 && segmentProfile.dimensions.style < 0.4) {
      reasons.push('adventure/nature focus');
    }

    // Business travel
    if (dimensions.businessMix > 0.5 && segment === UserSegment.BUSINESS_LEISURE) {
      reasons.push('business travel component');
    }

    // Specific segment characteristics
    switch (segment) {
      case UserSegment.BUDGET_BACKPACKER:
        if (profile.preferences.accommodation.types.includes('HOSTEL')) {
          reasons.push('hostel accommodation preference');
        }
        break;

      case UserSegment.FAMILY_EXPLORER:
        if (profile.preferences.travel.childrenAges.length > 0) {
          reasons.push(`traveling with ${profile.preferences.travel.childrenAges.length} child(ren)`);
        }
        break;

      case UserSegment.LUXURY_TRAVELER:
        if (profile.preferences.accommodation.comfortLevel === 'luxury') {
          reasons.push('luxury accommodation preference');
        }
        break;

      case UserSegment.ADVENTURE_SEEKER:
        if (profile.preferences.experience.riskTolerance === 'adventurous') {
          reasons.push('high risk tolerance for adventure');
        }
        break;

      case UserSegment.ROMANTIC_COUPLE:
        if (
          profile.preferences.travel.groupTypes.includes('COUPLE') &&
          profile.preferences.accommodation.comfortLevel !== 'basic'
        ) {
          reasons.push('romantic couple travel style');
        }
        break;
    }

    return reasons.slice(0, 4); // Limit to top 4 reasons
  }
}
