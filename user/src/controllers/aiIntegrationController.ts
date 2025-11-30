import { Request, Response } from 'express';
import { prisma } from '@dreamscape/db';
import type { TravelOnboardingProfile as PrismaTravelOnboardingProfile } from '@dreamscape/db';
import type {
  TravelOnboardingProfile,
  BudgetRange,
  PreferredDestinations,
  TripDuration,
  GroupSize,
  RoomPreferences,
  WeatherTolerances,
  LoyaltyProgram
} from '@types_onboarding';

// Helper function to convert Prisma TravelOnboardingProfile to app TravelOnboardingProfile
const convertPrismaProfile = (prismaProfile: PrismaTravelOnboardingProfile | null): TravelOnboardingProfile | null => {
  if (!prismaProfile) return null;

  return {
    ...prismaProfile,
    preferredDestinations: (prismaProfile.preferredDestinations ?? undefined) as unknown as PreferredDestinations | undefined,
    globalBudgetRange: (prismaProfile.globalBudgetRange ?? undefined) as unknown as BudgetRange | undefined,
    budgetByCategory: (prismaProfile.budgetByCategory ?? undefined) as unknown as Record<string, BudgetRange> | undefined,
    preferredTripDuration: (prismaProfile.preferredTripDuration ?? undefined) as unknown as TripDuration | undefined,
    roomPreferences: (prismaProfile.roomPreferences ?? undefined) as unknown as RoomPreferences | undefined,
    groupSize: (prismaProfile.groupSize ?? undefined) as unknown as GroupSize | undefined,
    weatherTolerances: (prismaProfile.weatherTolerances ?? undefined) as unknown as WeatherTolerances | undefined,
    loyaltyPrograms: (prismaProfile.loyaltyPrograms ?? undefined) as unknown as LoyaltyProgram[] | undefined
  };
};

// Standardized format for AI service consumption
export interface AIUserPreferences {
  userId: string;
  isOnboardingCompleted: boolean;
  onboardingCompletedAt?: Date;
  lastUpdated: Date;

  // Core preferences for AI recommendations
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
      byCategory?: {
        transport?: { min: number; max: number; currency: string };
        accommodation?: { min: number; max: number; currency: string };
        activities?: { min: number; max: number; currency: string };
        food?: { min: number; max: number; currency: string };
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
      typicalDuration?: {
        short: { min: number; max: number };
        medium: { min: number; max: number };
        long: { min: number; max: number };
      };
    };

    accommodation: {
      types: string[];
      comfortLevel: 'basic' | 'standard' | 'premium' | 'luxury' | null;
      serviceLevel?: string;
      privacyPreference?: string;
    };

    transport: {
      preferredAirlines: string[];
      cabinClass?: string;
      modes: string[];
      budgetShare?: number; // percentage of total budget
    };

    activities: {
      types: string[];
      interests: string[];
      activityLevel: 'low' | 'moderate' | 'high' | 'very_high' | null;
    };

    constraints: {
      dietary: string[];
      accessibility: string[];
      health: string[];
      cultural: string[];
      languages: string[];
    };

    experience: {
      level?: string;
      riskTolerance: 'conservative' | 'moderate' | 'adventurous' | null;
      culturalImmersion?: string;
    };

    climate: {
      preferences: string[];
      tolerances?: {
        hot: boolean;
        cold: boolean;
        rain: boolean;
        humidity: boolean;
      };
    };

    loyalty: {
      programs?: Array<{
        program: string;
        level: string;
        priority?: number;
      }>;
      paymentPreferences: string[];
    };
  };

  // Metadata for AI optimization
  metadata: {
    completedSteps: string[];
    profileVersion: number;
    dataQuality: {
      completeness: number; // 0-100%
      confidence: number;   // 0-100%
      lastValidated?: Date;
    };
    migrationInfo?: {
      migratedFromLegacy: boolean;
      legacyDataSources: string[];
    };
  };
}

// Helper function to send error responses
const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
};

// Helper function to send success responses
const sendSuccess = (res: Response, data: any, message?: string): void => {
  res.json({
    success: true,
    ...(message && { message }),
    data,
    timestamp: new Date().toISOString()
  });
};

// Calculate data quality metrics
const calculateDataQuality = (profile: TravelOnboardingProfile): {
  completeness: number;
  confidence: number;
} => {
  const fields = [
    'travelTypes', 'preferredDestinations', 'globalBudgetRange',
    'accommodationTypes', 'preferredAirlines', 'activityTypes',
    'travelGroupTypes', 'comfortLevel'
  ];

  let filledFields = 0;
  const totalFields = fields.length;

  fields.forEach(field => {
    const value = (profile as any)[field];
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && value.length > 0) filledFields++;
      else if (!Array.isArray(value)) filledFields++;
    }
  });

  const completeness = Math.round((filledFields / totalFields) * 100);
  const confidence = profile.isCompleted ?
    Math.min(completeness + 20, 100) : // Boost for completed profiles
    Math.max(completeness - 10, 0);   // Penalty for incomplete

  return { completeness, confidence };
};

// Transform database model to AI format
const transformToAIFormat = (
  user: any,
  profile: TravelOnboardingProfile | null
): AIUserPreferences => {
  const quality = profile ? calculateDataQuality(profile) : { completeness: 0, confidence: 0 };

  return {
    userId: user.id,
    isOnboardingCompleted: user.onboardingCompleted || false,
    onboardingCompletedAt: user.onboardingCompletedAt,
    lastUpdated: profile?.updatedAt || user.updatedAt,

    preferences: {
      destinations: {
        regions: profile?.preferredDestinations?.regions || [],
        countries: profile?.preferredDestinations?.countries || [],
        climates: profile?.preferredDestinations?.climates || []
      },

      budget: {
        globalRange: profile?.globalBudgetRange ? {
          min: profile.globalBudgetRange.min,
          max: profile.globalBudgetRange.max,
          currency: profile.globalBudgetRange.currency
        } : undefined,
        byCategory: profile?.budgetByCategory || undefined,
        flexibility: (profile?.budgetFlexibility?.toLowerCase() as 'strict' | 'flexible' | 'very_flexible') || null
      },

      travel: {
        types: profile?.travelTypes || [],
        purposes: profile?.travelPurposes || [],
        style: (profile?.travelStyle?.toLowerCase() as 'planned' | 'spontaneous' | 'mixed') || null,
        groupTypes: profile?.travelGroupTypes || [],
        travelWithChildren: profile?.travelWithChildren || false,
        childrenAges: profile?.childrenAges || []
      },

      timing: {
        preferredSeasons: profile?.preferredSeasons || [],
        dateFlexibility: (profile?.dateFlexibility?.toLowerCase() as 'flexible' | 'semi_flexible' | 'fixed') || null,
        typicalDuration: profile?.preferredTripDuration || undefined
      },

      accommodation: {
        types: profile?.accommodationTypes || [],
        comfortLevel: (profile?.accommodationLevel?.toLowerCase() as 'basic' | 'standard' | 'premium' | 'luxury') || null,
        serviceLevel: profile?.serviceLevel || undefined,
        privacyPreference: profile?.privacyPreference || undefined
      },

      transport: {
        preferredAirlines: profile?.preferredAirlines || [],
        cabinClass: profile?.cabinClassPreference || undefined,
        modes: profile?.transportModes || [],
        budgetShare: profile?.transportBudgetShare || undefined
      },

      activities: {
        types: profile?.activityTypes || [],
        interests: profile?.interestCategories || [],
        activityLevel: (profile?.activityLevel?.toLowerCase() as 'low' | 'moderate' | 'high' | 'very_high') || null
      },

      constraints: {
        dietary: profile?.dietaryRequirements || [],
        accessibility: profile?.accessibilityNeeds || [],
        health: profile?.healthConsiderations || [],
        cultural: profile?.culturalConsiderations || [],
        languages: profile?.languageBarriers || []
      },

      experience: {
        level: profile?.experienceLevel || undefined,
        riskTolerance: (profile?.riskTolerance?.toLowerCase() as 'conservative' | 'moderate' | 'adventurous') || null,
        culturalImmersion: profile?.culturalImmersion || undefined
      },

      climate: {
        preferences: profile?.climatePreferences || [],
        tolerances: profile?.weatherTolerances || undefined
      },

      loyalty: {
        programs: profile?.loyaltyPrograms?.map(p => ({
          program: p.program,
          level: p.level,
          priority: (p as any).priority
        })) || undefined,
        paymentPreferences: profile?.paymentPreferences || []
      }
    },

    metadata: {
      completedSteps: profile?.completedSteps || [],
      profileVersion: profile?.version || 1,
      dataQuality: quality,
      migrationInfo: (profile as any)?.migratedFromLegacy ? {
        migratedFromLegacy: (profile as any).migratedFromLegacy,
        legacyDataSources: (profile as any).legacyDataSources || []
      } : undefined
    }
  };
};

/**
 * Get user preferences in AI-optimized format
 * For use by AI service for recommendations
 */
export const getUserPreferencesForAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return sendError(res, 400, 'User ID is required');
    }

    // Get user with onboarding profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        travelOnboarding: true,
        settings: true, // Include legacy settings for fallback
        preferences: true // Include legacy preferences for fallback
      }
    });

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Transform to AI format
    const aiPreferences = transformToAIFormat(user, convertPrismaProfile(user.travelOnboarding));

    // Log AI data request for analytics
    await prisma.analytics.create({
      data: {
        service: 'user',
        event: 'ai_preferences_requested',
        userId,
        data: {
          dataQuality: aiPreferences.metadata.dataQuality,
          completedSteps: aiPreferences.metadata.completedSteps.length,
          hasOnboardingProfile: !!user.travelOnboarding,
          requestedAt: new Date().toISOString()
        }
      }
    });

    sendSuccess(res, aiPreferences);
  } catch (error) {
    console.error('Error getting AI preferences:', error);
    sendError(res, 500, 'Failed to get user preferences for AI');
  }
};

/**
 * Get multiple users' preferences for batch AI processing
 */
export const getBatchUserPreferencesForAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return sendError(res, 400, 'User IDs array is required');
    }

    if (userIds.length > 100) {
      return sendError(res, 400, 'Maximum 100 users per batch request');
    }

    // Get users with onboarding profiles
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      include: {
        travelOnboarding: true,
        settings: true,
        preferences: true
      }
    });

    // Transform all users to AI format
    const batchPreferences = users.map(user =>
      transformToAIFormat(user, convertPrismaProfile(user.travelOnboarding))
    );

    // Log batch AI request
    await prisma.analytics.create({
      data: {
        service: 'user',
        event: 'ai_batch_preferences_requested',
        data: {
          requestedUsers: userIds.length,
          foundUsers: users.length,
          avgDataQuality: batchPreferences.reduce((sum, p) => sum + p.metadata.dataQuality.completeness, 0) / batchPreferences.length,
          requestedAt: new Date().toISOString()
        }
      }
    });

    sendSuccess(res, {
      users: batchPreferences,
      meta: {
        requested: userIds.length,
        found: users.length,
        notFound: userIds.filter(id => !users.find(u => u.id === id))
      }
    });
  } catch (error) {
    console.error('Error getting batch AI preferences:', error);
    sendError(res, 500, 'Failed to get batch user preferences for AI');
  }
};

/**
 * Get AI integration health and statistics
 */
export const getAIIntegrationHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get onboarding statistics
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { onboardingCompleted: true } }),
      prisma.travelOnboardingProfile.count(),
      prisma.travelOnboardingProfile.count({ where: { isCompleted: true } }),
      prisma.analytics.count({
        where: {
          event: 'ai_preferences_requested',
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
        }
      })
    ]);

    const [totalUsers, completedUsers, totalProfiles, completedProfiles, aiRequestsLast24h] = stats;

    const healthData = {
      totalUsers,
      onboardingStats: {
        usersWithCompletedOnboarding: completedUsers,
        usersWithOnboardingProfile: totalProfiles,
        profilesCompleted: completedProfiles,
        completionRate: totalUsers > 0 ? Math.round((completedUsers / totalUsers) * 100) : 0
      },
      aiIntegration: {
        requestsLast24h: aiRequestsLast24h,
        dataAvailabilityRate: totalUsers > 0 ? Math.round((totalProfiles / totalUsers) * 100) : 0,
        lastUpdated: new Date().toISOString()
      },
      healthStatus: {
        overall: completedProfiles > 0 ? 'healthy' : 'warning',
        dataQuality: totalProfiles > 0 ? 'good' : 'needs_improvement',
        apiAvailability: 'operational'
      }
    };

    sendSuccess(res, healthData);
  } catch (error) {
    console.error('Error getting AI integration health:', error);
    sendError(res, 500, 'Failed to get AI integration health');
  }
};