import { Request, Response } from 'express';
import { prisma } from '@dreamscape/db';
import { AuthRequest } from '../middleware/auth';
import type {
  TravelOnboardingProfile,
  CreateOnboardingProfileRequest,
  UpdateOnboardingStepRequest,
  OnboardingProgressResponse,
  OnboardingValidationError,
  BudgetRange,
  PreferredDestinations,
  TripDuration,
  GroupSize,
  RoomPreferences,
  WeatherTolerances,
  LoyaltyProgram,
  OnboardingStepKey
} from '../types/onboarding.types';

// Helper function to send error responses
const sendError = (res: Response, status: number, message: string, errors?: OnboardingValidationError[]): void => {
  res.status(status).json({
    error: message,
    ...(errors && { validationErrors: errors })
  });
};

// Helper function to send success responses
const sendSuccess = (res: Response, data: any, message?: string): void => {
  res.json({
    success: true,
    ...(message && { message }),
    data
  });
};

// Validation helpers
const validateBudgetRange = (budget: any): OnboardingValidationError[] => {
  const errors: OnboardingValidationError[] = [];

  if (budget && typeof budget === 'object') {
    if (typeof budget.min !== 'number' || budget.min < 0) {
      errors.push({
        step: 'budget',
        field: 'globalBudgetRange.min',
        error: 'Minimum budget must be a positive number',
        value: budget.min
      });
    }

    if (typeof budget.max !== 'number' || budget.max < 0) {
      errors.push({
        step: 'budget',
        field: 'globalBudgetRange.max',
        error: 'Maximum budget must be a positive number',
        value: budget.max
      });
    }

    if (budget.min >= budget.max) {
      errors.push({
        step: 'budget',
        field: 'globalBudgetRange',
        error: 'Minimum budget must be less than maximum budget',
        value: budget
      });
    }

    if (!budget.currency || typeof budget.currency !== 'string') {
      errors.push({
        step: 'budget',
        field: 'globalBudgetRange.currency',
        error: 'Currency is required and must be a string',
        value: budget.currency
      });
    }
  }

  return errors;
};

const validateStepData = (step: OnboardingStepKey, data: any): OnboardingValidationError[] => {
  const errors: OnboardingValidationError[] = [];

  switch (step) {
    case 'budget':
      if (data.globalBudgetRange) {
        errors.push(...validateBudgetRange(data.globalBudgetRange));
      }
      break;

    case 'destinations':
      if (data.preferredDestinations && !Array.isArray(data.preferredDestinations.regions)) {
        errors.push({
          step,
          field: 'preferredDestinations.regions',
          error: 'Regions must be an array',
          value: data.preferredDestinations.regions
        });
      }
      break;

    case 'group_travel':
      if (data.travelWithChildren === true && (!data.childrenAges || !Array.isArray(data.childrenAges))) {
        errors.push({
          step,
          field: 'childrenAges',
          error: 'Children ages must be provided when traveling with children',
          value: data.childrenAges
        });
      }
      break;
  }

  return errors;
};

// Get onboarding profile
export const getOnboardingProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const profile = await prisma.travelOnboardingProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            onboardingCompleted: true,
            onboardingCompletedAt: true
          }
        }
      }
    });

    if (!profile) {
      return sendError(res, 404, 'Onboarding profile not found');
    }

    // Transform Json fields back to typed objects
    const transformedProfile: TravelOnboardingProfile = {
      ...profile,
      preferredDestinations: profile.preferredDestinations as PreferredDestinations | undefined,
      globalBudgetRange: profile.globalBudgetRange as BudgetRange | undefined,
      budgetByCategory: profile.budgetByCategory as Record<string, BudgetRange> | undefined,
      preferredTripDuration: profile.preferredTripDuration as TripDuration | undefined,
      roomPreferences: profile.roomPreferences as RoomPreferences | undefined,
      groupSize: profile.groupSize as GroupSize | undefined,
      weatherTolerances: profile.weatherTolerances as WeatherTolerances | undefined,
      loyaltyPrograms: profile.loyaltyPrograms as LoyaltyProgram[] | undefined
    };

    sendSuccess(res, transformedProfile);
  } catch (error) {
    console.error('Error fetching onboarding profile:', error);
    sendError(res, 500, 'Failed to fetch onboarding profile');
  }
};

// Create onboarding profile
export const createOnboardingProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    // Check if profile already exists
    const existingProfile = await prisma.travelOnboardingProfile.findUnique({
      where: { userId }
    });

    if (existingProfile) {
      return sendError(res, 409, 'Onboarding profile already exists');
    }

    const profile = await prisma.travelOnboardingProfile.create({
      data: {
        userId,
        isCompleted: false,
        completedSteps: [],
        version: 1
      },
      include: {
        user: {
          select: {
            onboardingCompleted: true,
            onboardingCompletedAt: true
          }
        }
      }
    });

    sendSuccess(res, profile, 'Onboarding profile created successfully');
  } catch (error: any) {
    if (error.code === 'P2002') {
      return sendError(res, 409, 'Onboarding profile already exists');
    }
    console.error('Error creating onboarding profile:', error);
    sendError(res, 500, 'Failed to create onboarding profile');
  }
};

// Update onboarding step
export const updateOnboardingStep = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { step, data, markCompleted = false } = req.body as UpdateOnboardingStepRequest;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!step || typeof step !== 'string') {
      return sendError(res, 400, 'Step is required');
    }

    if (!data || typeof data !== 'object') {
      return sendError(res, 400, 'Step data is required');
    }

    // Validate step data
    const validationErrors = validateStepData(step, data);
    if (validationErrors.length > 0) {
      return sendError(res, 400, 'Validation failed', validationErrors);
    }

    // Get existing profile
    const existingProfile = await prisma.travelOnboardingProfile.findUnique({
      where: { userId }
    });

    if (!existingProfile) {
      return sendError(res, 404, 'Onboarding profile not found. Create profile first.');
    }

    // Prepare update data
    const updateData: any = {};
    const completedSteps = [...existingProfile.completedSteps];

    // Add step to completed steps if markCompleted and not already there
    if (markCompleted && !completedSteps.includes(step)) {
      completedSteps.push(step);
      updateData.completedSteps = completedSteps;
    }

    // Map step data to database fields
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    });

    // Update profile
    const updatedProfile = await prisma.travelOnboardingProfile.update({
      where: { userId },
      data: updateData,
      include: {
        user: {
          select: {
            onboardingCompleted: true,
            onboardingCompletedAt: true
          }
        }
      }
    });

    sendSuccess(res, updatedProfile, `Step '${step}' updated successfully`);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Onboarding profile not found');
    }
    console.error('Error updating onboarding step:', error);
    sendError(res, 500, 'Failed to update onboarding step');
  }
};

// Get onboarding progress
export const getOnboardingProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const profile = await prisma.travelOnboardingProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            onboardingCompleted: true,
            onboardingCompletedAt: true
          }
        }
      }
    });

    if (!profile) {
      return sendError(res, 404, 'Onboarding profile not found');
    }

    const completedSteps = profile.completedSteps;
    const totalPossibleSteps = [
      'destinations', 'budget', 'travel_types', 'timing',
      'accommodation', 'transport', 'activities', 'group_travel',
      'special_needs', 'comfort_service', 'climate', 'experience', 'loyalty_payment'
    ];

    const progressResponse: OnboardingProgressResponse = {
      userId,
      completedSteps,
      totalSteps: totalPossibleSteps.length,
      progressPercentage: Math.round((completedSteps.length / totalPossibleSteps.length) * 100),
      isCompleted: profile.user.onboardingCompleted || false,
      completedAt: profile.user.onboardingCompletedAt,
      nextRecommendedStep: totalPossibleSteps.find(step => !completedSteps.includes(step))
    };

    sendSuccess(res, progressResponse);
  } catch (error) {
    console.error('Error fetching onboarding progress:', error);
    sendError(res, 500, 'Failed to fetch onboarding progress');
  }
};

// Complete onboarding
export const completeOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const profile = await prisma.travelOnboardingProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      return sendError(res, 404, 'Onboarding profile not found');
    }

    // Required steps for completion
    const requiredSteps = ['destinations', 'budget', 'travel_types', 'accommodation', 'transport'];
    const missingRequiredSteps = requiredSteps.filter(step => !profile.completedSteps.includes(step));

    if (missingRequiredSteps.length > 0) {
      return sendError(res, 400, `Cannot complete onboarding. Missing required steps: ${missingRequiredSteps.join(', ')}`);
    }

    // Mark as completed
    const now = new Date();

    await Promise.all([
      prisma.travelOnboardingProfile.update({
        where: { userId },
        data: {
          isCompleted: true,
          completedAt: now
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: now
        }
      })
    ]);

    // Log completion
    await prisma.analytics.create({
      data: {
        service: 'user',
        event: 'onboarding_completed',
        userId,
        data: {
          completedSteps: profile.completedSteps,
          totalSteps: profile.completedSteps.length,
          completionDate: now.toISOString()
        }
      }
    });

    sendSuccess(res, { completedAt: now }, 'Onboarding completed successfully');
  } catch (error) {
    console.error('Error completing onboarding:', error);
    sendError(res, 500, 'Failed to complete onboarding');
  }
};

// Delete onboarding profile
export const deleteOnboardingProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    await prisma.travelOnboardingProfile.delete({
      where: { userId }
    });

    // Reset user onboarding status
    await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: false,
        onboardingCompletedAt: null
      }
    });

    sendSuccess(res, null, 'Onboarding profile deleted successfully');
  } catch (error: any) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Onboarding profile not found');
    }
    console.error('Error deleting onboarding profile:', error);
    sendError(res, 500, 'Failed to delete onboarding profile');
  }
};