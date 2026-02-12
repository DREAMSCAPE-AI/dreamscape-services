/**
 * Activity Vectorizer Service
 *
 * Transforms raw activity features into 8-dimensional feature vectors
 * compatible with UserVector for cosine similarity calculation.
 *
 * ## 🔍 WHAT IT DOES
 * This service takes unstructured activity data from Amadeus API and converts it
 * into normalized 8D vectors that can be compared with user preference vectors.
 *
 * ## 💡 WHY WE NEED IT
 * To personalize activity recommendations, we must represent activities in the
 * same dimensional space as user preferences. This allows us to calculate
 * similarity scores using cosine similarity.
 *
 * ## ⚙️ HOW IT WORKS
 * 1. Parse activity characteristics (category, intensity, duration, etc.)
 * 2. Calculate dimension scores based on activity type and features
 * 3. Normalize each dimension to [0-1] range
 * 4. Apply configurable weights for fine-tuning
 *
 * @module activities/services
 * @ticket US-IA-004.1
 */

import {
  ActivityVector,
  ActivityFeatures,
  ActivityVectorizationConfig,
  DEFAULT_ACTIVITY_VECTORIZATION_CONFIG,
  ActivityCategory,
  ActivityIntensity,
  BatchActivityVectorizationResult,
} from '../types/activity-vector.types';

/**
 * ActivityVectorizerService
 *
 * Core service for activity feature extraction and vectorization.
 */
export class ActivityVectorizerService {
  private config: ActivityVectorizationConfig;

  constructor(config?: Partial<ActivityVectorizationConfig>) {
    this.config = {
      ...DEFAULT_ACTIVITY_VECTORIZATION_CONFIG,
      ...config,
    };
  }

  /**
   * Vectorize a single activity
   *
   * Main entry point for transforming activity features into a vector.
   *
   * @param features - Structured activity features
   * @returns 8D feature vector normalized to [0-1]
   */
  vectorize(features: ActivityFeatures): ActivityVector {
    return [
      this.calculateClimateDimension(features),
      this.calculateCultureNatureDimension(features),
      this.calculateBudgetDimension(features),
      this.calculateActivityLevelDimension(features),
      this.calculateGroupSizeDimension(features),
      this.calculateUrbanRuralDimension(features),
      this.calculateGastronomyDimension(features),
      this.calculatePopularityDimension(features),
    ];
  }

  /**
   * Vectorize activity from raw Amadeus data
   *
   * Convenience method that handles data transformation from Amadeus format.
   *
   * @param amadeusActivity - Raw activity object from Amadeus API
   * @returns 8D feature vector
   */
  vectorizeFromAmadeus(amadeusActivity: any): ActivityVector {
    const features = this.transformAmadeusToFeatures(amadeusActivity);
    return this.vectorize(features);
  }

  /**
   * Batch vectorize multiple activities
   *
   * Optimized for processing search results (50-200 activities).
   * Calculates market average dynamically for budget normalization.
   *
   * @param activities - Array of activity features
   * @returns Map of activityId to vector, with metadata
   */
  batchVectorize(activities: ActivityFeatures[]): BatchActivityVectorizationResult {
    const startTime = Date.now();
    const vectors = new Map<string, ActivityVector>();
    const errors: Array<{ activityId: string; error: string }> = [];

    // Calculate market average price for this batch
    const prices = activities
      .map(act => act.price.amount)
      .filter(p => p > 0);

    const marketAverage = prices.length > 0
      ? prices.reduce((sum, p) => sum + p, 0) / prices.length
      : this.config.budget.marketAveragePrice;

    // Update config for this batch
    const originalAverage = this.config.budget.marketAveragePrice;
    this.config.budget.marketAveragePrice = marketAverage;

    // Vectorize each activity
    for (const activity of activities) {
      try {
        const vector = this.vectorize(activity);
        vectors.set(activity.activityId, vector);
      } catch (error) {
        errors.push({
          activityId: activity.activityId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Restore original config
    this.config.budget.marketAveragePrice = originalAverage;

    return {
      vectors,
      processingTime: Date.now() - startTime,
      itemsProcessed: vectors.size,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Transform Amadeus activity data to ActivityFeatures
   *
   * Handles various Amadeus API response formats.
   *
   * @param amadeusActivity - Raw Amadeus activity object
   * @returns Structured activity features
   */
  private transformAmadeusToFeatures(amadeusActivity: any): ActivityFeatures {
    const activity = amadeusActivity;

    // Parse category
    const category = this.parseCategory(activity.category || activity.type);

    // Parse intensity
    const intensity = this.parseIntensity(activity, category);

    // Parse duration
    const duration = this.parseDuration(activity.duration);

    // Parse price
    const price = {
      amount: parseFloat(activity.price?.amount || activity.price || 0),
      currency: activity.price?.currency || 'EUR',
      perPerson: true,
      discountsAvailable: activity.discountsAvailable || false,
    };

    // Parse group size
    const groupSize = {
      min: activity.groupSize?.min || 1,
      max: activity.groupSize?.max || activity.groupSize || 50,
      typical: activity.groupSize?.typical || Math.ceil((activity.groupSize?.max || 10) / 2),
    };

    return {
      activityId: activity.id || activity.activityId,
      name: activity.name,
      description: activity.description || '',

      location: {
        name: activity.location?.name || activity.location || '',
        address: activity.location?.address || '',
        coordinates: {
          latitude: activity.location?.coordinates?.latitude || activity.latitude || 0,
          longitude: activity.location?.coordinates?.longitude || activity.longitude || 0,
        },
        cityCode: activity.cityCode || activity.location?.cityCode,
        countryCode: activity.countryCode,
      },

      category,
      subCategories: activity.subCategories || [],

      intensity,
      duration,
      groupSize,
      price,

      rating: activity.rating || 0,
      reviewCount: activity.reviewCount || 0,

      bookingInfo: {
        instantConfirmation: activity.bookingInfo?.instantConfirmation || false,
        freeCancellation: activity.bookingInfo?.freeCancellation || false,
        cancellationPolicy: activity.bookingInfo?.cancellationPolicy,
        minimumNotice: activity.bookingInfo?.minimumNotice,
      },

      images: activity.images || [],
      videoUrl: activity.videoUrl,

      availability: {
        daysOfWeek: activity.availability?.daysOfWeek,
        timeSlots: activity.availability?.timeSlots,
        seasonal: activity.seasonal || false,
        weatherDependent: this.isWeatherDependent(category),
      },

      features: {
        guidedTour: activity.guidedTour || false,
        audioGuide: activity.audioGuide || false,
        transportation: activity.transportation || false,
        mealIncluded: activity.mealIncluded || false,
        equipmentProvided: activity.equipmentProvided || false,
        accessible: activity.accessible || false,
        childFriendly: activity.childFriendly || false,
        petFriendly: activity.petFriendly || false,
      },

      requirements: {
        minAge: activity.minAge,
        maxAge: activity.maxAge,
        fitnessLevel: activity.fitnessLevel,
        languages: activity.languages,
        specialRequirements: activity.specialRequirements,
      },

      metadata: {
        isPopular: activity.isPopular || false,
        isNewListing: activity.isNewListing || false,
        hostedBy: activity.hostedBy,
        certifications: activity.certifications,
        tags: activity.tags,
      },
    };
  }

  // ============================================================================
  // DIMENSION CALCULATORS
  // ============================================================================

  /**
   * Dimension 0: Climate
   *
   * Measures weather dependency and outdoor nature of activity.
   * Higher values indicate more climate-sensitive activities.
   *
   * @param features - Activity features
   * @returns Normalized score [0-1]
   */
  private calculateClimateDimension(features: ActivityFeatures): number {
    const weights = this.config.climate;
    let score = 0;

    // Check if activity is outdoor
    const isOutdoor = this.isOutdoorActivity(features.category);
    if (isOutdoor) {
      score += weights.outdoorWeight;
    }

    // Weather dependent activities
    if (features.availability.weatherDependent) {
      score += weights.weatherDependentWeight;
    }

    // Seasonal activities
    if (features.availability.seasonal) {
      score += weights.seasonalWeight;
    }

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  /**
   * Dimension 1: Culture vs Nature
   *
   * Measures whether activity is culture-oriented (museums, shows)
   * or nature-oriented (hiking, wildlife).
   *
   * Scale: 0 = Pure nature, 0.5 = Mixed, 1 = Pure culture
   *
   * @param features - Activity features
   * @returns Normalized score [0-1]
   */
  private calculateCultureNatureDimension(features: ActivityFeatures): number {
    const culturalCategories = [
      ActivityCategory.MUSEUM,
      ActivityCategory.HISTORICAL_SITE,
      ActivityCategory.ART_GALLERY,
      ActivityCategory.CULTURAL_TOUR,
      ActivityCategory.ARCHITECTURE_TOUR,
      ActivityCategory.SHOW,
      ActivityCategory.THEATER,
      ActivityCategory.CONCERT,
      ActivityCategory.CITY_TOUR,
    ];

    const natureCategories = [
      ActivityCategory.HIKING,
      ActivityCategory.WILDLIFE,
      ActivityCategory.NATURE_TOUR,
      ActivityCategory.SAFARI,
      ActivityCategory.BEACH,
      ActivityCategory.NATIONAL_PARK,
      ActivityCategory.DIVING,
    ];

    if (culturalCategories.includes(features.category)) {
      return 1.0;
    } else if (natureCategories.includes(features.category)) {
      return 0.0;
    } else {
      return 0.5; // Mixed or neutral
    }
  }

  /**
   * Dimension 2: Budget
   *
   * Measures relative price level compared to market average.
   *
   * Scale: 0 = Free/budget, 0.5 = Mid-range, 1 = Luxury
   *
   * @param features - Activity features
   * @returns Normalized score [0-1]
   */
  private calculateBudgetDimension(features: ActivityFeatures): number {
    const { amount } = features.price;
    const marketAverage = this.config.budget.marketAveragePrice;

    if (amount === 0) {
      return 0.0; // Free activity
    }

    if (!marketAverage || marketAverage === 0) {
      return 0.5; // Default mid-range if no reference
    }

    // Calculate relative position
    // Budget: 0-0.5x average → score 0-0.3
    // Mid-range: 0.5-1.5x average → score 0.3-0.7
    // Premium: 1.5-3x average → score 0.7-0.9
    // Luxury: >3x average → score 0.9-1.0

    const ratio = amount / marketAverage;

    if (ratio < 0.5) {
      return Math.min(0.3, ratio / 0.5 * 0.3);
    } else if (ratio < 1.5) {
      return 0.3 + ((ratio - 0.5) / 1.0) * 0.4;
    } else if (ratio < 3.0) {
      return 0.7 + ((ratio - 1.5) / 1.5) * 0.2;
    } else {
      return Math.min(1.0, 0.9 + Math.log10(ratio / 3) * 0.1);
    }
  }

  /**
   * Dimension 3: Activity Level
   *
   * Measures physical intensity and exertion required.
   *
   * Scale: 0 = Relaxed, 1 = Very high intensity
   *
   * @param features - Activity features
   * @returns Normalized score [0-1]
   */
  private calculateActivityLevelDimension(features: ActivityFeatures): number {
    const weights = this.config.activityLevel;

    switch (features.intensity) {
      case ActivityIntensity.LOW:
        return weights.lowIntensity;
      case ActivityIntensity.MODERATE:
        return weights.moderateIntensity;
      case ActivityIntensity.HIGH:
        return weights.highIntensity;
      case ActivityIntensity.VERY_HIGH:
        return weights.veryHighIntensity;
      default:
        return 0.5; // Default moderate
    }
  }

  /**
   * Dimension 4: Group Size
   *
   * Measures suitability for different group sizes.
   *
   * Scale: 0 = Solo/couple only, 1 = Large groups
   *
   * @param features - Activity features
   * @returns Normalized score [0-1]
   */
  private calculateGroupSizeDimension(features: ActivityFeatures): number {
    const weights = this.config.groupSize;
    const { max, typical } = features.groupSize;
    let score = 0;

    // Score based on maximum group size
    if (max <= 2) {
      score += weights.soloWeight;
    } else if (max <= 4) {
      score += weights.coupleWeight;
    } else if (max <= 10) {
      score += weights.smallGroupWeight;
    } else {
      score += weights.largeGroupWeight;
    }

    // Bonus for child-friendly activities
    if (features.features.childFriendly) {
      score += weights.childFriendlyBonus;
    }

    return Math.min(1.0, score);
  }

  /**
   * Dimension 5: Urban vs Rural
   *
   * Measures whether activity is urban/city-based or rural/nature-based.
   *
   * Scale: 0 = Remote/rural, 1 = City center
   *
   * @param features - Activity features
   * @returns Normalized score [0-1]
   */
  private calculateUrbanRuralDimension(features: ActivityFeatures): number {
    const urbanCategories = [
      ActivityCategory.MUSEUM,
      ActivityCategory.ART_GALLERY,
      ActivityCategory.SHOW,
      ActivityCategory.THEATER,
      ActivityCategory.NIGHTLIFE,
      ActivityCategory.CITY_TOUR,
      ActivityCategory.SHOPPING_TOUR,
      ActivityCategory.MARKET_VISIT,
      ActivityCategory.ARCHITECTURE_TOUR,
    ];

    const ruralCategories = [
      ActivityCategory.HIKING,
      ActivityCategory.NATURE_TOUR,
      ActivityCategory.SAFARI,
      ActivityCategory.NATIONAL_PARK,
      ActivityCategory.WILDLIFE,
    ];

    if (urbanCategories.includes(features.category)) {
      return 1.0;
    } else if (ruralCategories.includes(features.category)) {
      return 0.0;
    } else {
      return 0.5; // Suburban or mixed
    }
  }

  /**
   * Dimension 6: Gastronomy
   *
   * Measures food and culinary focus of the activity.
   *
   * @param features - Activity features
   * @returns Normalized score [0-1]
   */
  private calculateGastronomyDimension(features: ActivityFeatures): number {
    const weights = this.config.gastronomy;
    let score = 0;

    // Food-centric categories
    const foodCategories = [
      ActivityCategory.FOOD_TOUR,
      ActivityCategory.WINE_TASTING,
      ActivityCategory.COOKING_CLASS,
      ActivityCategory.CULINARY_EXPERIENCE,
    ];

    if (foodCategories.includes(features.category)) {
      score += weights.foodTourWeight + weights.culinaryExperienceWeight;
    }

    // Meal included bonus
    if (features.features.mealIncluded) {
      score += weights.mealIncludedBonus;
    }

    return Math.min(1.0, score);
  }

  /**
   * Dimension 7: Popularity
   *
   * Measures overall quality and popularity based on ratings and bookings.
   *
   * @param features - Activity features
   * @returns Normalized score [0-1]
   */
  private calculatePopularityDimension(features: ActivityFeatures): number {
    const weights = this.config.popularity;
    let score = 0;

    // Rating component (0-5 scale)
    if (features.rating > 0) {
      const normalizedRating = features.rating / 5;
      score += weights.ratingWeight * normalizedRating;
    }

    // Review count component (logarithmic)
    if (features.reviewCount > 0) {
      const normalizedReviews = this.logScale(features.reviewCount, 5, 1000);
      score += weights.reviewCountWeight * normalizedReviews;
    }

    // Popularity flag
    if (features.metadata?.isPopular) {
      score += weights.bookingPopularityWeight;
    }

    // Instant confirmation bonus
    if (features.bookingInfo.instantConfirmation) {
      score += weights.instantConfirmationBonus;
    }

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, score / maxScore);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Parse activity category from Amadeus data
   */
  private parseCategory(categoryString: string): ActivityCategory {
    const normalized = (categoryString || '').toUpperCase().replace(/[- ]/g, '_');

    // Try direct match
    if (Object.values(ActivityCategory).includes(normalized as ActivityCategory)) {
      return normalized as ActivityCategory;
    }

    // Fuzzy matching
    if (normalized.includes('MUSEUM')) return ActivityCategory.MUSEUM;
    if (normalized.includes('TOUR')) return ActivityCategory.TOUR;
    if (normalized.includes('FOOD') || normalized.includes('CULINARY')) return ActivityCategory.FOOD_TOUR;
    if (normalized.includes('SHOW') || normalized.includes('PERFORMANCE')) return ActivityCategory.SHOW;
    if (normalized.includes('WATER') || normalized.includes('DIVING')) return ActivityCategory.WATER_SPORTS;
    if (normalized.includes('HIKE') || normalized.includes('HIKING')) return ActivityCategory.HIKING;
    if (normalized.includes('NATURE')) return ActivityCategory.NATURE_TOUR;
    if (normalized.includes('CITY')) return ActivityCategory.CITY_TOUR;
    if (normalized.includes('WINE')) return ActivityCategory.WINE_TASTING;
    if (normalized.includes('SPA') || normalized.includes('WELLNESS')) return ActivityCategory.SPA;

    return ActivityCategory.OTHER;
  }

  /**
   * Parse activity intensity
   */
  private parseIntensity(activity: any, category: ActivityCategory): ActivityIntensity {
    // Explicit intensity
    if (activity.intensity) {
      const normalized = activity.intensity.toUpperCase();
      if (Object.values(ActivityIntensity).includes(normalized as ActivityIntensity)) {
        return normalized as ActivityIntensity;
      }
    }

    // Infer from category
    const highIntensityCategories = [
      ActivityCategory.EXTREME_SPORTS,
      ActivityCategory.CLIMBING,
      ActivityCategory.HIKING,
      ActivityCategory.DIVING,
    ];

    const lowIntensityCategories = [
      ActivityCategory.MUSEUM,
      ActivityCategory.ART_GALLERY,
      ActivityCategory.SHOW,
      ActivityCategory.THEATER,
    ];

    if (highIntensityCategories.includes(category)) {
      return ActivityIntensity.HIGH;
    } else if (lowIntensityCategories.includes(category)) {
      return ActivityIntensity.LOW;
    } else {
      return ActivityIntensity.MODERATE;
    }
  }

  /**
   * Parse duration
   */
  private parseDuration(durationString: any): {
    value: number;
    formatted: string;
    isFlexible: boolean;
  } {
    if (!durationString) {
      return { value: 120, formatted: '2 hours', isFlexible: true };
    }

    if (typeof durationString === 'object' && durationString.value) {
      return durationString;
    }

    // Parse string like "2 hours", "Half day", "PT2H"
    const str = String(durationString).toLowerCase();

    let value = 120; // default 2 hours

    if (str.includes('full day')) {
      value = 480;
    } else if (str.includes('half day')) {
      value = 240;
    } else if (str.match(/(\d+)\s*hour/)) {
      const hours = parseInt(str.match(/(\d+)\s*hour/)![1], 10);
      value = hours * 60;
    } else if (str.match(/(\d+)\s*min/)) {
      value = parseInt(str.match(/(\d+)\s*min/)![1], 10);
    } else if (str.match(/pt(\d+)h/i)) {
      const hours = parseInt(str.match(/pt(\d+)h/i)![1], 10);
      value = hours * 60;
    }

    return {
      value,
      formatted: durationString,
      isFlexible: str.includes('flexible') || str.includes('approximately'),
    };
  }

  /**
   * Check if activity is outdoor
   */
  private isOutdoorActivity(category: ActivityCategory): boolean {
    const outdoorCategories = [
      ActivityCategory.HIKING,
      ActivityCategory.CLIMBING,
      ActivityCategory.WATER_SPORTS,
      ActivityCategory.EXTREME_SPORTS,
      ActivityCategory.SKIING,
      ActivityCategory.DIVING,
      ActivityCategory.WILDLIFE,
      ActivityCategory.NATURE_TOUR,
      ActivityCategory.SAFARI,
      ActivityCategory.BEACH,
      ActivityCategory.NATIONAL_PARK,
      ActivityCategory.BIKE_TOUR,
      ActivityCategory.BOAT_TOUR,
    ];

    return outdoorCategories.includes(category);
  }

  /**
   * Check if activity is weather dependent
   */
  private isWeatherDependent(category: ActivityCategory): boolean {
    const weatherDependentCategories = [
      ActivityCategory.HIKING,
      ActivityCategory.BEACH,
      ActivityCategory.WATER_SPORTS,
      ActivityCategory.SKIING,
      ActivityCategory.SAFARI,
      ActivityCategory.BOAT_TOUR,
      ActivityCategory.BIKE_TOUR,
      ActivityCategory.PHOTOGRAPHY_TOUR,
    ];

    return weatherDependentCategories.includes(category);
  }

  /**
   * Logarithmic scaling helper
   */
  private logScale(value: number, min: number, max: number): number {
    if (value < min) return 0;
    if (value > max) return 1;

    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logValue = Math.log10(value);

    return (logValue - logMin) / (logMax - logMin);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ActivityVectorizationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ActivityVectorizationConfig {
    return { ...this.config };
  }
}

export default ActivityVectorizerService;
