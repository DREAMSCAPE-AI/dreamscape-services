/**
 * Profile Fetcher Service
 *
 * Fetches and transforms TravelOnboardingProfile from database for recommendation system.
 * Provides merged profile data combining database values with query parameter overrides.
 *
 * @module accommodations/services
 */

import { prisma } from '@dreamscape/db';
import type { TravelOnboardingProfile as PrismaTravelOnboardingProfile } from '@dreamscape/db';

/**
 * User profile data structure for recommendations
 * Matches RecommendationOptions.userProfile interface
 */
export interface RecommendationUserProfile {
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  travelTypes?: string[];
  accommodationTypes?: string[];
  activityTypes?: string[];
  preferredDestinations?: string[];
  comfortLevel?: string;
  travelStyle?: string;
  travelGroupType?: string;
  activityLevel?: string;
}

/**
 * Budget range from JSON field
 */
interface BudgetRange {
  min: number;
  max: number;
  currency: string;
}

/**
 * Preferred destinations from JSON field
 */
interface PreferredDestinations {
  regions?: string[];
  countries?: string[];
  climates?: string[];
}

/**
 * Profile Fetcher Service
 *
 * Handles fetching TravelOnboardingProfile from database and transforming it
 * into the format expected by the recommendation service.
 */
export class ProfileFetcherService {
  /**
   * Fetch user's TravelOnboardingProfile from database
   *
   * @param userId - User ID to fetch profile for
   * @returns Profile data or null if not found
   */
  async fetchUserProfile(userId: string): Promise<PrismaTravelOnboardingProfile | null> {
    try {
      const profile = await prisma.travelOnboardingProfile.findUnique({
        where: { userId }
      });

      if (profile) {
        console.log(`[ProfileFetcher] Found profile for user ${userId} (completed: ${profile.isCompleted})`);
      } else {
        console.log(`[ProfileFetcher] No profile found for user ${userId}`);
      }

      return profile;
    } catch (error) {
      console.error(`[ProfileFetcher] Error fetching profile for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Transform Prisma TravelOnboardingProfile to RecommendationUserProfile
   *
   * Converts database model with JSON fields to the flat structure expected
   * by the recommendation service.
   *
   * @param profile - Prisma profile from database
   * @returns Transformed profile for recommendations
   */
  transformToRecommendationFormat(
    profile: PrismaTravelOnboardingProfile | null
  ): RecommendationUserProfile {
    if (!profile) {
      return {
        currency: 'USD' // Default currency
      };
    }

    // Parse JSON fields
    const globalBudget = profile.globalBudgetRange as BudgetRange | null;
    const destinations = profile.preferredDestinations as PreferredDestinations | null;

    // Extract budget information
    const budgetMin = globalBudget?.min;
    const budgetMax = globalBudget?.max;
    const currency = globalBudget?.currency || 'USD';

    // Extract travel types (convert enum array to string array)
    const travelTypes = profile.travelTypes?.map(type => type.toString()) || [];

    // Extract accommodation types
    const accommodationTypes = profile.accommodationTypes || [];

    // Extract activity types
    const activityTypes = profile.activityTypes || [];

    // Extract preferred destinations (use countries from JSON)
    const preferredDestinations = destinations?.countries || [];

    // Extract comfort level (convert enum to string)
    const comfortLevel = profile.accommodationLevel?.toString() || profile.comfortLevel?.toString();

    // Extract travel style (convert enum to string)
    const travelStyle = profile.travelStyle?.toString();

    // Extract travel group type (use first group type if multiple)
    const travelGroupType = profile.travelGroupTypes?.[0];

    // Extract activity level (convert enum to string)
    const activityLevel = profile.activityLevel?.toString();

    const transformed: RecommendationUserProfile = {
      budgetMin,
      budgetMax,
      currency,
      travelTypes,
      accommodationTypes,
      activityTypes,
      preferredDestinations,
      comfortLevel,
      travelStyle,
      travelGroupType,
      activityLevel
    };

    console.log('[ProfileFetcher] Transformed profile:', {
      budgetMin,
      budgetMax,
      currency,
      travelTypesCount: travelTypes.length,
      accommodationTypesCount: accommodationTypes.length,
      activityTypesCount: activityTypes.length,
      hasComfortLevel: !!comfortLevel,
      hasTravelStyle: !!travelStyle,
      hasActivityLevel: !!activityLevel
    });

    return transformed;
  }

  /**
   * Merge database profile with query parameters
   *
   * Query parameters take precedence over database values ONLY if they have meaningful values.
   * Empty arrays and undefined values from query params are IGNORED to prevent overwriting DB data.
   *
   * @param dbProfile - Profile from database
   * @param queryProfile - Profile from query parameters
   * @returns Merged profile with query params overriding database ONLY when non-empty
   */
  mergeWithQueryParams(
    dbProfile: RecommendationUserProfile,
    queryProfile?: RecommendationUserProfile
  ): RecommendationUserProfile {
    if (!queryProfile) {
      console.log('[ProfileFetcher] No query params, using DB profile only');
      return dbProfile;
    }

    // Helper: Check if array is non-empty
    const hasValue = (arr: any[] | undefined): boolean => {
      return arr !== undefined && arr !== null && arr.length > 0;
    };

    // Helper: Check if value is non-empty (not undefined, not null, not empty string)
    const isNonEmpty = (val: any): boolean => {
      return val !== undefined && val !== null && val !== '';
    };

    // CRITICAL: Only use query params if they have ACTUAL values
    // Empty arrays [] and undefined should NOT override database values!
    const merged: RecommendationUserProfile = {
      budgetMin: isNonEmpty(queryProfile.budgetMin) ? queryProfile.budgetMin : dbProfile.budgetMin,
      budgetMax: isNonEmpty(queryProfile.budgetMax) ? queryProfile.budgetMax : dbProfile.budgetMax,
      currency: isNonEmpty(queryProfile.currency) ? queryProfile.currency : dbProfile.currency,
      travelTypes: hasValue(queryProfile.travelTypes) ? queryProfile.travelTypes : dbProfile.travelTypes,
      accommodationTypes: hasValue(queryProfile.accommodationTypes) ? queryProfile.accommodationTypes : dbProfile.accommodationTypes,
      activityTypes: hasValue(queryProfile.activityTypes) ? queryProfile.activityTypes : dbProfile.activityTypes,
      preferredDestinations: hasValue(queryProfile.preferredDestinations) ? queryProfile.preferredDestinations : dbProfile.preferredDestinations,
      comfortLevel: isNonEmpty(queryProfile.comfortLevel) ? queryProfile.comfortLevel : dbProfile.comfortLevel,
      travelStyle: isNonEmpty(queryProfile.travelStyle) ? queryProfile.travelStyle : dbProfile.travelStyle,
      travelGroupType: isNonEmpty(queryProfile.travelGroupType) ? queryProfile.travelGroupType : dbProfile.travelGroupType,
      activityLevel: isNonEmpty(queryProfile.activityLevel) ? queryProfile.activityLevel : dbProfile.activityLevel
    };

    // Log merge details for debugging
    const actualOverrides: string[] = [];
    if (isNonEmpty(queryProfile.budgetMin)) actualOverrides.push('budgetMin');
    if (isNonEmpty(queryProfile.budgetMax)) actualOverrides.push('budgetMax');
    if (isNonEmpty(queryProfile.currency)) actualOverrides.push('currency');
    if (hasValue(queryProfile.travelTypes)) actualOverrides.push('travelTypes');
    if (hasValue(queryProfile.accommodationTypes)) actualOverrides.push('accommodationTypes');
    if (hasValue(queryProfile.activityTypes)) actualOverrides.push('activityTypes');
    if (hasValue(queryProfile.preferredDestinations)) actualOverrides.push('preferredDestinations');
    if (isNonEmpty(queryProfile.comfortLevel)) actualOverrides.push('comfortLevel');
    if (isNonEmpty(queryProfile.travelStyle)) actualOverrides.push('travelStyle');
    if (isNonEmpty(queryProfile.travelGroupType)) actualOverrides.push('travelGroupType');
    if (isNonEmpty(queryProfile.activityLevel)) actualOverrides.push('activityLevel');

    console.log('[ProfileFetcher] Merge strategy: DB values preserved, query params override ONLY if non-empty');
    console.log('[ProfileFetcher] Merged profile:', {
      dbFieldsCount: Object.values(dbProfile).filter(v => v !== undefined && v !== null).length,
      queryFieldsReceived: Object.keys(queryProfile).length,
      actualOverrides: actualOverrides.length,
      overriddenFields: actualOverrides
    });
    console.log('[ProfileFetcher] Final merged values:', {
      budgetMin: merged.budgetMin,
      budgetMax: merged.budgetMax,
      currency: merged.currency,
      travelTypesCount: merged.travelTypes?.length || 0,
      accommodationTypesCount: merged.accommodationTypes?.length || 0,
      hasComfortLevel: !!merged.comfortLevel,
      hasTravelStyle: !!merged.travelStyle
    });

    return merged;
  }

  /**
   * Fetch and transform user profile in one call
   *
   * Convenience method that combines fetching, transforming, and merging.
   *
   * @param userId - User ID to fetch profile for
   * @param queryProfile - Optional query parameters to merge
   * @returns Complete profile ready for recommendations
   */
  async getRecommendationProfile(
    userId: string,
    queryProfile?: RecommendationUserProfile
  ): Promise<RecommendationUserProfile> {
    // Fetch from database
    const prismaProfile = await this.fetchUserProfile(userId);

    // Transform to recommendation format
    const dbProfile = this.transformToRecommendationFormat(prismaProfile);

    // Merge with query params
    const mergedProfile = this.mergeWithQueryParams(dbProfile, queryProfile);

    return mergedProfile;
  }
}

// Export singleton instance
export const profileFetcherService = new ProfileFetcherService();
