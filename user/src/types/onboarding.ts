// Types TypeScript pour le questionnaire d'onboarding US-CORE-005
// Approche dynamique sans hardcoding des étapes

import type {
  TravelOnboardingProfile as PrismaTravelOnboardingProfile,
  TravelType,
  TravelStyle,
  ComfortLevel,
  BudgetFlexibility,
  DateFlexibility,
  ActivityLevel,
  RiskTolerance
} from '@dreamscape/db';

// Re-export des enums Prisma pour utilisation dans l'application
export type {
  TravelType,
  TravelStyle,
  ComfortLevel,
  BudgetFlexibility,
  DateFlexibility,
  ActivityLevel,
  RiskTolerance
};

// ========== BASE TYPES ==========

export interface BudgetRange {
  min: number;
  max: number;
  currency: string;
}

export interface PreferredDestinations {
  regions?: string[];
  countries?: string[];
  climates?: string[];
  migrated_from?: string;
}

export interface TripDuration {
  short: { min: number; max: number };
  medium: { min: number; max: number };
  long: { min: number; max: number };
}

export interface GroupSize {
  min: number;
  max: number;
  typical: number;
}

export interface RoomPreferences {
  type: string;
  amenities: string[];
  view?: string;
}

export interface WeatherTolerances {
  hot: boolean;
  cold: boolean;
  rain: boolean;
  humidity: boolean;
}

export interface LoyaltyProgram {
  program: string;
  number: string;
  level: string;
}

// ========== DYNAMIC STEP HANDLING ==========

// Pas de hardcoding - on utilise directement les string[] du schéma Prisma
export type OnboardingStepKey = string;

export interface OnboardingStepData<T = any> {
  step: OnboardingStepKey;
  data: T;
  isCompleted: boolean;
  validationErrors?: OnboardingValidationError[];
}

export interface OnboardingProgressResponse {
  userId: string;
  completedSteps: OnboardingStepKey[];
  totalSteps: number;
  progressPercentage: number;
  isCompleted: boolean;
  completedAt?: Date;
  nextRecommendedStep?: OnboardingStepKey;
}

export interface OnboardingValidationError {
  step: OnboardingStepKey;
  field: string;
  error: string;
  value?: any;
}

// ========== API REQUEST/RESPONSE TYPES ==========

export interface CreateOnboardingProfileRequest {
  userId: string;
}

export interface UpdateOnboardingStepRequest {
  step: OnboardingStepKey;
  data: Record<string, any>;
  markCompleted?: boolean;
}

// ========== DOMAIN TYPES ==========

export interface TravelOnboardingProfile extends Omit<PrismaTravelOnboardingProfile,
  'preferredDestinations' |
  'globalBudgetRange' |
  'budgetByCategory' |
  'preferredTripDuration' |
  'roomPreferences' |
  'groupSize' |
  'weatherTolerances' |
  'loyaltyPrograms'
> {
  preferredDestinations?: PreferredDestinations;
  globalBudgetRange?: BudgetRange;
  budgetByCategory?: Record<string, BudgetRange>;
  preferredTripDuration?: TripDuration;
  roomPreferences?: RoomPreferences;
  groupSize?: GroupSize;
  weatherTolerances?: WeatherTolerances;
  loyaltyPrograms?: LoyaltyProgram[];
}

// ========== UTILITY HELPERS ==========

export interface OnboardingStepMeta {
  key: string;
  isCompleted: boolean;
  canComplete: boolean;
  data?: Record<string, any>;
}

// Helpers pour calculer la progression sans hardcoding
export function calculateProgress(completedSteps: string[], allPossibleSteps: string[]): number {
  if (allPossibleSteps.length === 0) return 0;
  return Math.round((completedSteps.length / allPossibleSteps.length) * 100);
}

export function isStepCompleted(step: string, completedSteps: string[]): boolean {
  return completedSteps.includes(step);
}