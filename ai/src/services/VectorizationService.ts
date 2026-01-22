/**
 * IA-001.2: Vectorization Service
 * Converts user preferences and travel onboarding data into feature vectors
 * for ML-based recommendation scoring
 */

import { PrismaClient, TravelOnboardingProfile, UserSettings, UserPreferences } from '@dreamscape/db';

const prisma = new PrismaClient();

/**
 * Feature vector dimensions (8D for MVP)
 * Index 0: Climate preference (0=cold, 1=tropical)
 * Index 1: Culture vs Nature (0=nature, 1=culture/museums)
 * Index 2: Budget level (0=budget, 1=luxury)
 * Index 3: Activity level (0=relaxation, 1=adventure)
 * Index 4: Travel group (0=solo, 1=family/group)
 * Index 5: Urban vs Rural (0=countryside, 1=city)
 * Index 6: Gastronomy importance (0=basic, 1=gourmet)
 * Index 7: Popularity preference (0=off-beaten-path, 1=mainstream)
 */
export const VECTOR_DIMENSIONS = 8;

/**
 * Normalize a value to [0, 1] range
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Calculate average from array of values
 */
function average(values: number[]): number {
  if (values.length === 0) return 0.5; // Default middle value
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export class VectorizationService {
  /**
   * Generate a user vector from TravelOnboardingProfile
   */
  async generateUserVector(userId: string): Promise<number[]> {
    // Fetch all user data
    const [onboarding, settings, preferences] = await Promise.all([
      prisma.travelOnboardingProfile.findUnique({ where: { userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.userPreferences.findUnique({ where: { userId } }),
    ]);

    // Generate vector from available data
    const vector: number[] = new Array(VECTOR_DIMENSIONS).fill(0.5); // Default to neutral

    // [0] Climate preference
    if (onboarding?.climatePreferences && onboarding.climatePreferences.length > 0) {
      vector[0] = this.calculateClimateScore(onboarding.climatePreferences);
    }

    // [1] Culture vs Nature
    if (onboarding?.travelTypes && onboarding.travelTypes.length > 0) {
      vector[1] = this.calculateCultureScore(onboarding.travelTypes, onboarding.activityTypes);
    }

    // [2] Budget level
    if (onboarding?.globalBudgetRange) {
      const budgetData = onboarding.globalBudgetRange as any;
      vector[2] = this.calculateBudgetScore(budgetData);
    } else if (preferences?.budgetRange) {
      const budgetData = preferences.budgetRange as any;
      vector[2] = this.calculateBudgetScore(budgetData);
    }

    // [3] Activity level
    if (onboarding?.activityLevel) {
      vector[3] = this.mapActivityLevel(onboarding.activityLevel);
    }

    // [4] Travel group
    if (onboarding?.travelGroupTypes && onboarding.travelGroupTypes.length > 0) {
      vector[4] = this.calculateGroupScore(onboarding.travelGroupTypes, onboarding.travelWithChildren);
    }

    // [5] Urban vs Rural
    if (settings?.preferredDestinations && settings.preferredDestinations.length > 0) {
      vector[5] = this.calculateUrbanScore(settings.preferredDestinations);
    }

    // [6] Gastronomy importance
    if (onboarding?.activityTypes && onboarding.activityTypes.length > 0) {
      vector[6] = this.calculateGastronomyScore(onboarding.activityTypes, onboarding.travelTypes);
    }

    // [7] Popularity preference
    if (onboarding?.riskTolerance) {
      vector[7] = this.mapRiskToPopularity(onboarding.riskTolerance);
    }

    return vector;
  }

  /**
   * Calculate climate score from preferences
   * tropical/hot -> 1.0, temperate -> 0.5, cold -> 0.0
   */
  private calculateClimateScore(climates: string[]): number {
    const climateScores: Record<string, number> = {
      tropical: 1.0,
      hot: 0.9,
      arid: 0.85,
      humid: 0.75,
      temperate: 0.5,
      cold: 0.2,
    };

    const scores = climates.map(c => climateScores[c.toLowerCase()] ?? 0.5);
    return average(scores);
  }

  /**
   * Calculate culture vs nature score
   * CULTURAL -> 1.0, NATURE -> 0.0
   */
  private calculateCultureScore(travelTypes: any[], activityTypes?: string[]): number {
    const culturalTypes = ['CULTURAL', 'HISTORICAL', 'URBAN', 'SHOPPING', 'NIGHTLIFE'];
    const natureTypes = ['NATURE', 'BEACH', 'MOUNTAIN', 'ADVENTURE'];

    const culturalCount = travelTypes.filter(t => culturalTypes.includes(t)).length;
    const natureCount = travelTypes.filter(t => natureTypes.includes(t)).length;

    // Boost from activity types
    if (activityTypes) {
      const cultureActivities = ['museums', 'art', 'history', 'shopping', 'nightlife'];
      const natureActivities = ['nature', 'hiking', 'beach', 'outdoor'];

      cultureActivities.forEach(act => {
        if (activityTypes.some(a => a.toLowerCase().includes(act))) {
          culturalCount += 0.5;
        }
      });

      natureActivities.forEach(act => {
        if (activityTypes.some(a => a.toLowerCase().includes(act))) {
          natureCount += 0.5;
        }
      });
    }

    const total = culturalCount + natureCount;
    if (total === 0) return 0.5;

    return culturalCount / total;
  }

  /**
   * Calculate budget score
   * Budget: 0-1000 -> 0.0-0.3, Mid: 1000-3000 -> 0.3-0.7, Premium: 3000+ -> 0.7-1.0
   */
  private calculateBudgetScore(budgetData: { min?: number; max?: number }): number {
    if (!budgetData.max) return 0.5;

    const max = budgetData.max;

    if (max <= 1000) return normalize(max, 0, 1000) * 0.3;
    if (max <= 3000) return 0.3 + normalize(max, 1000, 3000) * 0.4;
    return 0.7 + Math.min(0.3, normalize(max, 3000, 10000) * 0.3);
  }

  /**
   * Map ActivityLevel enum to score
   */
  private mapActivityLevel(level: string): number {
    const mapping: Record<string, number> = {
      LOW: 0.1,
      MODERATE: 0.4,
      HIGH: 0.7,
      VERY_HIGH: 0.95,
    };
    return mapping[level] ?? 0.5;
  }

  /**
   * Calculate group score
   * solo -> 0.0, couple -> 0.3, family -> 0.7, friends/group -> 0.9
   */
  private calculateGroupScore(groupTypes: string[], withChildren: boolean): number {
    if (groupTypes.includes('solo')) return 0.1;
    if (groupTypes.includes('couple')) return 0.3;
    if (groupTypes.includes('family') || withChildren) return 0.75;
    if (groupTypes.includes('friends') || groupTypes.includes('business_group')) return 0.85;

    return 0.5;
  }

  /**
   * Calculate urban preference score
   */
  private calculateUrbanScore(destinations: string[]): number {
    // Simple heuristic: if destinations contain city names, score higher
    const urbanKeywords = ['city', 'urban', 'capitale', 'metropolis', 'downtown'];
    const ruralKeywords = ['countryside', 'rural', 'village', 'nature', 'mountain'];

    let urbanScore = 0;
    let ruralScore = 0;

    destinations.forEach(dest => {
      const lower = dest.toLowerCase();
      if (urbanKeywords.some(k => lower.includes(k))) urbanScore++;
      if (ruralKeywords.some(k => lower.includes(k))) ruralScore++;
    });

    const total = urbanScore + ruralScore;
    if (total === 0) return 0.6; // Slight urban bias by default

    return urbanScore / total;
  }

  /**
   * Calculate gastronomy importance
   */
  private calculateGastronomyScore(activityTypes: string[], travelTypes: any[]): number {
    const foodActivities = ['food', 'culinary', 'gastronomy', 'restaurant', 'cooking'];
    const foodTravelTypes = ['CULINARY'];

    let score = 0;

    activityTypes.forEach(act => {
      if (foodActivities.some(f => act.toLowerCase().includes(f))) {
        score += 0.2;
      }
    });

    if (travelTypes.includes('CULINARY')) {
      score += 0.4;
    }

    return Math.min(1.0, score || 0.3); // Baseline 0.3 (everyone likes food!)
  }

  /**
   * Map risk tolerance to popularity preference
   * CONSERVATIVE -> high popularity (mainstream)
   * ADVENTUROUS -> low popularity (off-beaten-path)
   */
  private mapRiskToPopularity(risk: string): number {
    const mapping: Record<string, number> = {
      CONSERVATIVE: 0.9,
      MODERATE: 0.6,
      ADVENTUROUS: 0.2,
    };
    return mapping[risk] ?? 0.6;
  }

  /**
   * Save or update user vector in database
   */
  async saveUserVector(userId: string, source: string = 'onboarding'): Promise<void> {
    const vector = await this.generateUserVector(userId);

    await prisma.userVector.upsert({
      where: { userId },
      create: {
        userId,
        vector,
        version: 1,
        source,
      },
      update: {
        vector,
        updatedAt: new Date(),
        source,
      },
    });
  }

  /**
   * Get existing user vector or generate new one
   */
  async getUserVector(userId: string): Promise<number[]> {
    const existing = await prisma.userVector.findUnique({
      where: { userId },
    });

    if (existing) {
      // Update usage stats
      await prisma.userVector.update({
        where: { userId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      return existing.vector as number[];
    }

    // Generate and save new vector
    const vector = await this.generateUserVector(userId);
    await this.saveUserVector(userId);

    return vector;
  }
}

export default new VectorizationService();
