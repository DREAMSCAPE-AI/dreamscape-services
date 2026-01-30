/**
 * Segment Profile Types
 *
 * Defines the characteristic profiles for each user segment,
 * including typical vector values and metadata.
 *
 * @module segments/types/segment-profile
 */

import { UserSegment, SegmentDimensions } from './segment.types';

/**
 * Profile definition for a user segment
 *
 * This represents the "typical" user in this segment,
 * used for cold start recommendations when user data is limited.
 */
export interface SegmentProfile {
  /**
   * The segment this profile represents
   */
  segment: UserSegment;

  /**
   * Display name for the segment
   */
  name: string;

  /**
   * Detailed description
   */
  description: string;

  /**
   * Typical dimension values for this segment
   */
  dimensions: SegmentDimensions;

  /**
   * Typical 8D feature vector for this segment
   * Aligned with UserVector structure:
   * [0] Climate (0=cold, 1=tropical)
   * [1] Culture vs Nature (0=nature, 1=culture)
   * [2] Budget (0=economy, 1=luxury)
   * [3] Activity Level (0=relaxed, 1=adventure)
   * [4] Travel Group (0=solo, 1=family)
   * [5] Urban vs Rural (0=countryside, 1=city)
   * [6] Gastronomy (0=basic, 1=gourmet)
   * [7] Popularity (0=off-beaten, 1=mainstream)
   */
  typicalVector: [number, number, number, number, number, number, number, number];

  /**
   * Typical budget range (EUR per day)
   */
  budgetRange: {
    min: number;
    max: number;
  };

  /**
   * Common characteristics
   */
  characteristics: string[];

  /**
   * Typical destination preferences
   */
  destinationPreferences: {
    regions: string[];
    types: string[];
    avoidTypes?: string[];
  };

  /**
   * Activity preferences
   */
  activityPreferences: {
    preferred: string[];
    avoided?: string[];
  };

  /**
   * Accommodation preferences
   */
  accommodationPreferences: string[];

  /**
   * Examples of destinations this segment typically enjoys
   */
  exampleDestinations: string[];
}

/**
 * Complete segment profile catalog
 */
export const SEGMENT_PROFILES: Record<UserSegment, SegmentProfile> = {
  [UserSegment.BUDGET_BACKPACKER]: {
    segment: UserSegment.BUDGET_BACKPACKER,
    name: 'Budget Backpacker',
    description: 'Budget-conscious solo travelers or small groups seeking authentic experiences and adventure',
    dimensions: {
      budget: 0.2,
      group: 0.1,
      activity: 0.8,
      comfort: 0.2,
      age: 0.2,
      style: 0.4,
      businessMix: 0.0,
    },
    typicalVector: [0.6, 0.4, 0.2, 0.8, 0.1, 0.4, 0.3, 0.4],
    budgetRange: {
      min: 20,
      max: 50,
    },
    characteristics: [
      'Budget-conscious',
      'Flexible itinerary',
      'Social and open to meeting others',
      'Values authentic experiences over comfort',
      'Often travels solo or with small groups',
      'Long-term travelers',
    ],
    destinationPreferences: {
      regions: ['SOUTHEAST_ASIA', 'EASTERN_EUROPE', 'SOUTH_AMERICA', 'CENTRAL_AMERICA'],
      types: ['CITY', 'NATURE', 'BEACH', 'CULTURAL'],
      avoidTypes: ['LUXURY_RESORT'],
    },
    activityPreferences: {
      preferred: ['HIKING', 'CULTURAL_TOURS', 'STREET_FOOD', 'BACKPACKING', 'HOSTELS', 'PUBLIC_TRANSPORT'],
      avoided: ['LUXURY_SPA', 'FINE_DINING', 'PRIVATE_TOURS'],
    },
    accommodationPreferences: ['HOSTEL', 'BUDGET_HOTEL', 'GUESTHOUSE', 'SHARED_ACCOMMODATION'],
    exampleDestinations: ['BKK', 'HAN', 'BUD', 'LIM', 'DBV'],
  },

  [UserSegment.FAMILY_EXPLORER]: {
    segment: UserSegment.FAMILY_EXPLORER,
    name: 'Family Explorer',
    description: 'Families with children seeking fun, educational, and safe travel experiences',
    dimensions: {
      budget: 0.5,
      group: 0.9,
      activity: 0.5,
      comfort: 0.6,
      age: 0.4,
      style: 0.5,
      businessMix: 0.0,
    },
    typicalVector: [0.7, 0.4, 0.5, 0.5, 0.9, 0.5, 0.5, 0.7],
    budgetRange: {
      min: 80,
      max: 150,
    },
    characteristics: [
      'Traveling with children',
      'Values safety and convenience',
      'Seeks family-friendly activities',
      'Prefers shorter travel distances',
      'Needs flexible cancellation',
      'Educational experiences valued',
    ],
    destinationPreferences: {
      regions: ['WESTERN_EUROPE', 'NORTH_AMERICA', 'MEDITERRANEAN', 'JAPAN'],
      types: ['THEME_PARK', 'BEACH', 'CITY', 'NATURE'],
      avoidTypes: ['NIGHTLIFE_FOCUSED', 'EXTREME_ADVENTURE'],
    },
    activityPreferences: {
      preferred: [
        'THEME_PARKS',
        'AQUARIUMS',
        'MUSEUMS',
        'BEACH_ACTIVITIES',
        'NATURE_PARKS',
        'INTERACTIVE_EXHIBITS',
      ],
      avoided: ['LONG_HIKES', 'EXTREME_SPORTS', 'LATE_NIGHT_ACTIVITIES'],
    },
    accommodationPreferences: ['FAMILY_HOTEL', 'APARTMENT', 'RESORT', 'VACATION_RENTAL'],
    exampleDestinations: ['PAR', 'BCN', 'ORL', 'DXB', 'TYO'],
  },

  [UserSegment.LUXURY_TRAVELER]: {
    segment: UserSegment.LUXURY_TRAVELER,
    name: 'Luxury Traveler',
    description: 'Affluent travelers seeking premium experiences, comfort, and personalized service',
    dimensions: {
      budget: 0.95,
      group: 0.3,
      activity: 0.4,
      comfort: 0.95,
      age: 0.6,
      style: 0.7,
      businessMix: 0.1,
    },
    typicalVector: [0.7, 0.7, 0.95, 0.4, 0.3, 0.8, 0.9, 0.6],
    budgetRange: {
      min: 200,
      max: 1000,
    },
    characteristics: [
      'High disposable income',
      'Values exclusivity and privacy',
      'Seeks premium service',
      'Quality over quantity',
      'Personalized experiences',
      'Time-efficient travel',
    ],
    destinationPreferences: {
      regions: ['WESTERN_EUROPE', 'MIDDLE_EAST', 'MALDIVES', 'CARIBBEAN', 'JAPAN'],
      types: ['LUXURY_RESORT', 'CITY', 'ISLAND', 'SPA'],
      avoidTypes: ['BUDGET_DESTINATIONS', 'BACKPACKING'],
    },
    activityPreferences: {
      preferred: [
        'FINE_DINING',
        'LUXURY_SPA',
        'PRIVATE_TOURS',
        'YACHT_CHARTERS',
        'GOLF',
        'WINE_TASTING',
        'SHOPPING',
      ],
      avoided: ['HOSTELS', 'PUBLIC_TRANSPORT', 'CROWDED_TOURIST_SPOTS'],
    },
    accommodationPreferences: ['5_STAR_HOTEL', 'LUXURY_RESORT', 'BOUTIQUE_HOTEL', 'PRIVATE_VILLA'],
    exampleDestinations: ['DXB', 'MLE', 'PAR', 'TYO', 'LON'],
  },

  [UserSegment.ADVENTURE_SEEKER]: {
    segment: UserSegment.ADVENTURE_SEEKER,
    name: 'Adventure Seeker',
    description: 'Active travelers seeking thrilling outdoor experiences and physical challenges',
    dimensions: {
      budget: 0.6,
      group: 0.3,
      activity: 0.95,
      comfort: 0.4,
      age: 0.3,
      style: 0.2,
      businessMix: 0.0,
    },
    typicalVector: [0.5, 0.2, 0.5, 0.95, 0.3, 0.2, 0.4, 0.3],
    budgetRange: {
      min: 60,
      max: 150,
    },
    characteristics: [
      'Physically active',
      'Risk-tolerant',
      'Seeks adrenaline and challenges',
      'Values natural environments',
      'Flexible and adaptable',
      'Often travels solo or with like-minded groups',
    ],
    destinationPreferences: {
      regions: ['SOUTH_AMERICA', 'NEW_ZEALAND', 'NEPAL', 'AFRICA', 'SCANDINAVIA'],
      types: ['MOUNTAIN', 'NATURE', 'WILDERNESS', 'COASTAL'],
      avoidTypes: ['LUXURY_RESORT', 'CITY_ONLY'],
    },
    activityPreferences: {
      preferred: [
        'HIKING',
        'TREKKING',
        'ROCK_CLIMBING',
        'SURFING',
        'DIVING',
        'SKIING',
        'MOUNTAIN_BIKING',
        'RAFTING',
      ],
      avoided: ['LUXURY_SPA', 'RELAXATION_ONLY', 'SEDENTARY_ACTIVITIES'],
    },
    accommodationPreferences: ['MOUNTAIN_LODGE', 'CAMPING', 'ECO_LODGE', 'BASIC_HOTEL'],
    exampleDestinations: ['KTM', 'AKL', 'QUE', 'CPT', 'REK'],
  },

  [UserSegment.CULTURAL_ENTHUSIAST]: {
    segment: UserSegment.CULTURAL_ENTHUSIAST,
    name: 'Cultural Enthusiast',
    description: 'Travelers focused on cultural immersion, history, art, and local traditions',
    dimensions: {
      budget: 0.6,
      group: 0.4,
      activity: 0.5,
      comfort: 0.6,
      age: 0.5,
      style: 0.9,
      businessMix: 0.0,
    },
    typicalVector: [0.6, 0.9, 0.6, 0.5, 0.4, 0.7, 0.8, 0.6],
    budgetRange: {
      min: 70,
      max: 180,
    },
    characteristics: [
      'Interested in history and art',
      'Values authentic local experiences',
      'Seeks educational travel',
      'Appreciates gastronomy',
      'Respects local customs',
      'Often visits museums and heritage sites',
    ],
    destinationPreferences: {
      regions: ['EUROPE', 'MIDDLE_EAST', 'ASIA', 'SOUTH_AMERICA'],
      types: ['CITY', 'CULTURAL', 'HISTORICAL'],
      avoidTypes: ['BEACH_RESORT_ONLY', 'THEME_PARKS'],
    },
    activityPreferences: {
      preferred: [
        'MUSEUMS',
        'HISTORICAL_SITES',
        'CULINARY_TOURS',
        'LOCAL_MARKETS',
        'CULTURAL_PERFORMANCES',
        'ARCHITECTURE_TOURS',
        'COOKING_CLASSES',
      ],
      avoided: ['EXTREME_SPORTS', 'PARTY_SCENE', 'BEACH_LOUNGING'],
    },
    accommodationPreferences: ['BOUTIQUE_HOTEL', 'CITY_HOTEL', 'HERITAGE_PROPERTY', 'B&B'],
    exampleDestinations: ['ROM', 'KYO', 'IST', 'CAI', 'ATH'],
  },

  [UserSegment.ROMANTIC_COUPLE]: {
    segment: UserSegment.ROMANTIC_COUPLE,
    name: 'Romantic Couple',
    description: 'Couples seeking intimate, romantic experiences and quality time together',
    dimensions: {
      budget: 0.7,
      group: 0.5,
      activity: 0.4,
      comfort: 0.7,
      age: 0.4,
      style: 0.6,
      businessMix: 0.0,
    },
    typicalVector: [0.7, 0.6, 0.7, 0.4, 0.5, 0.6, 0.7, 0.6],
    budgetRange: {
      min: 100,
      max: 250,
    },
    characteristics: [
      'Traveling as a couple',
      'Values privacy and intimacy',
      'Seeks romantic settings',
      'Appreciates fine dining',
      'Prefers peaceful environments',
      'Often celebrating special occasions',
    ],
    destinationPreferences: {
      regions: ['MEDITERRANEAN', 'CARIBBEAN', 'FRENCH_RIVIERA', 'TUSCANY', 'MALDIVES'],
      types: ['BEACH', 'CITY', 'ISLAND', 'COUNTRYSIDE'],
      avoidTypes: ['FAMILY_DESTINATIONS', 'PARTY_DESTINATIONS'],
    },
    activityPreferences: {
      preferred: [
        'ROMANTIC_DINNERS',
        'SUNSET_VIEWS',
        'WINE_TASTING',
        'COUPLES_SPA',
        'SCENIC_WALKS',
        'BOAT_TRIPS',
        'COOKING_CLASSES',
      ],
      avoided: ['CROWDED_ATTRACTIONS', 'EXTREME_SPORTS', 'FAMILY_ACTIVITIES'],
    },
    accommodationPreferences: ['BOUTIQUE_HOTEL', 'ROMANTIC_RESORT', 'B&B', 'PRIVATE_VILLA'],
    exampleDestinations: ['PAR', 'VCE', 'SAN', 'MLE', 'SYC'],
  },

  [UserSegment.BUSINESS_LEISURE]: {
    segment: UserSegment.BUSINESS_LEISURE,
    name: 'Business & Leisure',
    description: 'Business travelers who combine work trips with leisure time',
    dimensions: {
      budget: 0.75,
      group: 0.1,
      activity: 0.4,
      comfort: 0.8,
      age: 0.5,
      style: 0.7,
      businessMix: 0.7,
    },
    typicalVector: [0.6, 0.7, 0.75, 0.4, 0.1, 0.9, 0.6, 0.7],
    budgetRange: {
      min: 120,
      max: 300,
    },
    characteristics: [
      'Combines business with pleasure',
      'Values efficiency and convenience',
      'Limited leisure time',
      'Prefers city destinations',
      'Seeks premium comfort',
      'Often travels solo',
    ],
    destinationPreferences: {
      regions: ['GLOBAL_BUSINESS_HUBS'],
      types: ['CITY', 'URBAN'],
      avoidTypes: ['REMOTE_NATURE', 'ADVENTURE'],
    },
    activityPreferences: {
      preferred: [
        'CITY_TOURS',
        'FINE_DINING',
        'CULTURAL_ATTRACTIONS',
        'SHOPPING',
        'BUSINESS_CENTERS',
        'GOLF',
        'GYM',
      ],
      avoided: ['LONG_EXCURSIONS', 'EXTREME_SPORTS', 'BEACH_LOUNGING'],
    },
    accommodationPreferences: ['BUSINESS_HOTEL', 'CITY_CENTER_HOTEL', '4_STAR_HOTEL', 'SERVICED_APARTMENT'],
    exampleDestinations: ['LON', 'NYC', 'SIN', 'HKG', 'DXB'],
  },

  [UserSegment.SENIOR_COMFORT]: {
    segment: UserSegment.SENIOR_COMFORT,
    name: 'Senior Comfort',
    description: 'Mature travelers prioritizing comfort, accessibility, and cultural experiences',
    dimensions: {
      budget: 0.7,
      group: 0.5,
      activity: 0.2,
      comfort: 0.85,
      age: 0.9,
      style: 0.8,
      businessMix: 0.0,
    },
    typicalVector: [0.7, 0.8, 0.7, 0.2, 0.5, 0.6, 0.7, 0.7],
    budgetRange: {
      min: 90,
      max: 200,
    },
    characteristics: [
      'Mature age (60+)',
      'Values comfort and accessibility',
      'Prefers slower pace',
      'Seeks cultural enrichment',
      'Often travels as couple or group',
      'Health and safety conscious',
    ],
    destinationPreferences: {
      regions: ['EUROPE', 'NORTH_AMERICA', 'MEDITERRANEAN', 'JAPAN'],
      types: ['CITY', 'CULTURAL', 'CRUISE', 'SCENIC'],
      avoidTypes: ['ADVENTURE', 'NIGHTLIFE', 'BACKPACKING'],
    },
    activityPreferences: {
      preferred: [
        'MUSEUMS',
        'HISTORICAL_SITES',
        'SCENIC_DRIVES',
        'RIVER_CRUISES',
        'GARDENS',
        'CLASSICAL_PERFORMANCES',
        'WINE_TASTING',
      ],
      avoided: ['EXTREME_SPORTS', 'LONG_HIKES', 'NIGHTCLUBS', 'HOSTELS'],
    },
    accommodationPreferences: ['COMFORTABLE_HOTEL', 'CRUISE', 'RESORT', 'B&B'],
    exampleDestinations: ['PAR', 'ROM', 'VIE', 'KYO', 'LON'],
  },
};

/**
 * Get segment profile by segment enum
 */
export function getSegmentProfile(segment: UserSegment): SegmentProfile {
  return SEGMENT_PROFILES[segment];
}

/**
 * Get all segment profiles
 */
export function getAllSegmentProfiles(): SegmentProfile[] {
  return Object.values(SEGMENT_PROFILES);
}
