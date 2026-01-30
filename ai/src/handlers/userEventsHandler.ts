/**
 * User Events Handler for AI Service
 * DR-388: Handles user-related events for AI recommendations
 */

import {
  type MessageHandler,
  type UserPreferencesUpdatedPayload,
  type UserProfileUpdatedPayload,
} from '@dreamscape/kafka';

/**
 * Handle user preferences updated event
 * Updates ML model with new preferences for personalized recommendations
 */
export const handleUserPreferencesUpdated: MessageHandler<UserPreferencesUpdatedPayload> = async ({
  event,
  message,
}) => {
  const { userId, preferences, updatedAt } = event.payload;

  console.log(`[AI] User ${userId} preferences updated at ${updatedAt}`);

  try {
    // Update user profile in ML model
    if (preferences.travelPreferences) {
      await updateTravelPreferences(userId, preferences.travelPreferences);
    }

    // Update language preference for content personalization
    if (preferences.language) {
      await updateLanguagePreference(userId, preferences.language);
    }

    // Update currency for pricing recommendations
    if (preferences.currency) {
      await updateCurrencyPreference(userId, preferences.currency);
    }

    // Trigger recommendation recalculation
    await recalculateRecommendations(userId);

    console.log(`✅ [AI] Updated preferences for user ${userId}`);
  } catch (error) {
    console.error(`❌ [AI] Failed to process preferences update for ${userId}:`, error);
    throw error;
  }
};

/**
 * Handle user profile updated event
 * Updates user segmentation based on demographic data
 */
export const handleUserProfileUpdated: MessageHandler<UserProfileUpdatedPayload> = async ({
  event,
  message,
}) => {
  const { userId, profile, updatedAt } = event.payload;

  console.log(`[AI] User ${userId} profile updated at ${updatedAt}`);

  try {
    // Update user segmentation (age group, nationality)
    if (profile.dateOfBirth) {
      const ageGroup = calculateAgeGroup(profile.dateOfBirth);
      await updateUserSegment(userId, 'age_group', ageGroup);
    }

    if (profile.nationality) {
      await updateUserSegment(userId, 'nationality', profile.nationality);
    }

    // Update user vector in ML model
    await updateUserVector(userId, {
      nationality: profile.nationality,
      ageGroup: profile.dateOfBirth ? calculateAgeGroup(profile.dateOfBirth) : undefined,
    });

    console.log(`✅ [AI] Updated profile segments for user ${userId}`);
  } catch (error) {
    console.error(`❌ [AI] Failed to process profile update for ${userId}:`, error);
    throw error;
  }
};

// ============================================================================
// Helper Functions (Placeholder implementations)
// ============================================================================

async function updateTravelPreferences(userId: string, preferences: any) {
  // TODO: Update ML model with travel preferences
  // - Seat preference (window, aisle, middle)
  // - Meal preference (vegetarian, vegan, etc.)
  // - Class preference (economy, business, first)
  console.log(`[AI] Updating travel preferences for ${userId}:`, preferences);
}

async function updateLanguagePreference(userId: string, language: string) {
  // TODO: Update language for content personalization
  console.log(`[AI] Setting language ${language} for user ${userId}`);
}

async function updateCurrencyPreference(userId: string, currency: string) {
  // TODO: Update currency for pricing recommendations
  console.log(`[AI] Setting currency ${currency} for user ${userId}`);
}

async function recalculateRecommendations(userId: string) {
  // TODO: Trigger recommendation engine to recalculate for this user
  console.log(`[AI] Recalculating recommendations for user ${userId}`);
}

function calculateAgeGroup(dateOfBirth: string): string {
  const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 50) return '35-49';
  if (age < 65) return '50-64';
  return '65+';
}

async function updateUserSegment(userId: string, segment: string, value: string) {
  // TODO: Update user segment in database
  console.log(`[AI] User ${userId} segment ${segment} = ${value}`);
}

async function updateUserVector(userId: string, data: any) {
  // TODO: Update ML model user vector
  console.log(`[AI] Updating user vector for ${userId}:`, data);
}

/**
 * ========================================
 * IA-002.3: Onboarding Completion Handler
 * ========================================
 */

/**
 * Handle user onboarding completed event
 * Triggers cold start recommendation workflow
 * IA-002.3
 */
export const handleOnboardingCompleted = async (message: any): Promise<void> => {
  try {
    const { userId, profile, completedAt } = JSON.parse(message.value.toString());

    console.log(`[AI] 🎉 User ${userId} completed onboarding at ${completedAt}`);

    // Dynamically import orchestrator to avoid circular dependencies
    const { OnboardingOrchestratorService } = await import('../onboarding/onboarding-orchestrator.service');
    const orchestrator = new OnboardingOrchestratorService();

    // Process onboarding completion
    const result = await orchestrator.processOnboardingComplete(userId, profile);

    if (result.success) {
      console.log(`✅ [AI] Onboarding workflow completed for user ${userId}`);
      console.log(`   - Segment: ${result.metadata.segmentAssigned}`);
      console.log(`   - Confidence: ${(result.metadata.confidence || 0 * 100).toFixed(1)}%`);
      console.log(`   - Recommendations: ${result.recommendations.length}`);
    } else {
      console.error(`❌ [AI] Onboarding workflow failed for user ${userId}:`, result.error);
    }
  } catch (error) {
    console.error(`❌ [AI] Failed to process onboarding completion:`, error);
    throw error;
  }
};

/**
 * Register Kafka consumer for onboarding events
 * Call this in app initialization
 */
export async function registerOnboardingConsumer(kafkaConsumer: any): Promise<void> {
  await kafkaConsumer.subscribe({ topic: 'user.onboarding.completed' });

  await kafkaConsumer.run({
    eachMessage: async ({ message }: any) => {
      await handleOnboardingCompleted(message);
    },
  });

  console.log('✓ Registered Kafka consumer: user.onboarding.completed');
}
