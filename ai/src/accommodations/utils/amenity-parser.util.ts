/**
 * Amenity Parser Utility
 *
 * Normalizes raw amenity strings from Amadeus API into standardized
 * AmenityCategory enums for consistent vectorization.
 *
 * Handles variations in naming, synonyms, and multi-language inputs.
 *
 * @module accommodations/utils
 * @ticket US-IA-003.1
 */

import { AmenityCategory } from '../types/accommodation-vector.types';

/**
 * Amenity keyword mapping
 *
 * Maps various string patterns to standardized AmenityCategory.
 * Keys are lowercase for case-insensitive matching.
 */
const AMENITY_KEYWORDS: Record<string, AmenityCategory[]> = {
  // Climate-related
  'pool': [AmenityCategory.POOL],
  'swimming': [AmenityCategory.POOL],
  'piscine': [AmenityCategory.POOL],
  'outdoor pool': [AmenityCategory.POOL],
  'indoor pool': [AmenityCategory.POOL],

  'air conditioning': [AmenityCategory.AIR_CONDITIONING],
  'air-conditioning': [AmenityCategory.AIR_CONDITIONING],
  'ac': [AmenityCategory.AIR_CONDITIONING],
  'climate control': [AmenityCategory.AIR_CONDITIONING],
  'climatisation': [AmenityCategory.AIR_CONDITIONING],

  'heating': [AmenityCategory.HEATING],
  'central heating': [AmenityCategory.HEATING],
  'chauffage': [AmenityCategory.HEATING],

  'sauna': [AmenityCategory.SAUNA],
  'steam room': [AmenityCategory.SAUNA],

  'hot tub': [AmenityCategory.HOT_TUB],
  'jacuzzi': [AmenityCategory.HOT_TUB],
  'spa tub': [AmenityCategory.HOT_TUB],

  // Activity-related
  'gym': [AmenityCategory.GYM],
  'fitness': [AmenityCategory.GYM],
  'fitness center': [AmenityCategory.GYM],
  'fitness centre': [AmenityCategory.GYM],
  'workout': [AmenityCategory.GYM],
  'salle de sport': [AmenityCategory.GYM],

  'spa': [AmenityCategory.SPA],
  'wellness': [AmenityCategory.WELLNESS_CENTER],
  'wellness center': [AmenityCategory.WELLNESS_CENTER],
  'wellness centre': [AmenityCategory.WELLNESS_CENTER],
  'massage': [AmenityCategory.SPA],

  'tennis': [AmenityCategory.SPORTS_FACILITIES],
  'golf': [AmenityCategory.SPORTS_FACILITIES],
  'sports': [AmenityCategory.SPORTS_FACILITIES],
  'sport facilities': [AmenityCategory.SPORTS_FACILITIES],
  'basketball': [AmenityCategory.SPORTS_FACILITIES],
  'volleyball': [AmenityCategory.SPORTS_FACILITIES],

  'water sports': [AmenityCategory.WATER_SPORTS],
  'diving': [AmenityCategory.WATER_SPORTS],
  'snorkeling': [AmenityCategory.WATER_SPORTS],
  'kayaking': [AmenityCategory.WATER_SPORTS],
  'surfing': [AmenityCategory.WATER_SPORTS],

  // Gastronomy-related
  'restaurant': [AmenityCategory.RESTAURANT],
  'dining': [AmenityCategory.RESTAURANT],
  'on-site restaurant': [AmenityCategory.RESTAURANT],

  'bar': [AmenityCategory.BAR],
  'lounge': [AmenityCategory.BAR],
  'pub': [AmenityCategory.BAR],

  'room service': [AmenityCategory.ROOM_SERVICE],
  '24-hour room service': [AmenityCategory.ROOM_SERVICE],
  '24h room service': [AmenityCategory.ROOM_SERVICE],

  'breakfast': [AmenityCategory.BREAKFAST_INCLUDED],
  'continental breakfast': [AmenityCategory.BREAKFAST_INCLUDED],
  'buffet breakfast': [AmenityCategory.BREAKFAST_INCLUDED],
  'complimentary breakfast': [AmenityCategory.BREAKFAST_INCLUDED],

  'fine dining': [AmenityCategory.FINE_DINING],
  'gourmet': [AmenityCategory.FINE_DINING],
  'michelin': [AmenityCategory.FINE_DINING],
  'starred restaurant': [AmenityCategory.FINE_DINING],

  // Family-related
  'kids club': [AmenityCategory.KIDS_CLUB],
  'kids\' club': [AmenityCategory.KIDS_CLUB],
  'children club': [AmenityCategory.KIDS_CLUB],
  'children\'s club': [AmenityCategory.KIDS_CLUB],
  'club enfants': [AmenityCategory.KIDS_CLUB],

  'playground': [AmenityCategory.PLAYGROUND],
  'play area': [AmenityCategory.PLAYGROUND],
  'children playground': [AmenityCategory.PLAYGROUND],

  'babysitting': [AmenityCategory.BABYSITTING],
  'childcare': [AmenityCategory.BABYSITTING],
  'nanny service': [AmenityCategory.BABYSITTING],

  'family room': [AmenityCategory.FAMILY_ROOMS],
  'family rooms': [AmenityCategory.FAMILY_ROOMS],
  'connecting rooms': [AmenityCategory.FAMILY_ROOMS],

  // Business-related
  'business center': [AmenityCategory.BUSINESS_CENTER],
  'business centre': [AmenityCategory.BUSINESS_CENTER],
  'business services': [AmenityCategory.BUSINESS_CENTER],

  'meeting room': [AmenityCategory.MEETING_ROOMS],
  'meeting rooms': [AmenityCategory.MEETING_ROOMS],
  'conference room': [AmenityCategory.CONFERENCE_FACILITIES],
  'conference rooms': [AmenityCategory.CONFERENCE_FACILITIES],
  'event space': [AmenityCategory.CONFERENCE_FACILITIES],

  'coworking': [AmenityCategory.COWORKING_SPACE],
  'co-working': [AmenityCategory.COWORKING_SPACE],
  'shared workspace': [AmenityCategory.COWORKING_SPACE],

  // Connectivity
  'wifi': [AmenityCategory.WIFI],
  'wi-fi': [AmenityCategory.WIFI],
  'wireless internet': [AmenityCategory.WIFI],
  'free wifi': [AmenityCategory.WIFI],
  'complimentary wifi': [AmenityCategory.WIFI],

  'parking': [AmenityCategory.PARKING],
  'free parking': [AmenityCategory.PARKING],
  'valet parking': [AmenityCategory.PARKING],
  'garage': [AmenityCategory.PARKING],

  'airport shuttle': [AmenityCategory.AIRPORT_SHUTTLE],
  'shuttle service': [AmenityCategory.AIRPORT_SHUTTLE],
  'airport transfer': [AmenityCategory.AIRPORT_SHUTTLE],

  // Luxury
  'concierge': [AmenityCategory.CONCIERGE],
  'concierge service': [AmenityCategory.CONCIERGE],

  'butler': [AmenityCategory.BUTLER_SERVICE],
  'butler service': [AmenityCategory.BUTLER_SERVICE],
  'personal butler': [AmenityCategory.BUTLER_SERVICE],

  'vip lounge': [AmenityCategory.VIP_LOUNGE],
  'executive lounge': [AmenityCategory.VIP_LOUNGE],
  'club lounge': [AmenityCategory.VIP_LOUNGE],

  // Romance
  'couples spa': [AmenityCategory.COUPLES_SPA],
  'couples massage': [AmenityCategory.COUPLES_SPA],
  'spa for couples': [AmenityCategory.COUPLES_SPA],

  'private dining': [AmenityCategory.PRIVATE_DINING],
  'in-room dining': [AmenityCategory.PRIVATE_DINING],

  'romance package': [AmenityCategory.ROMANCE_PACKAGE],
  'honeymoon suite': [AmenityCategory.ROMANCE_PACKAGE],
  'romantic': [AmenityCategory.ROMANCE_PACKAGE],

  // Nature/Environment
  'garden': [AmenityCategory.GARDEN],
  'gardens': [AmenityCategory.GARDEN],
  'botanical garden': [AmenityCategory.GARDEN],

  'terrace': [AmenityCategory.TERRACE],
  'rooftop terrace': [AmenityCategory.TERRACE],
  'balcony': [AmenityCategory.TERRACE],

  'outdoor activities': [AmenityCategory.OUTDOOR_ACTIVITIES],
  'hiking': [AmenityCategory.OUTDOOR_ACTIVITIES],
  'biking': [AmenityCategory.OUTDOOR_ACTIVITIES],
  'cycling': [AmenityCategory.OUTDOOR_ACTIVITIES],

  'eco-friendly': [AmenityCategory.ECO_FRIENDLY],
  'sustainable': [AmenityCategory.ECO_FRIENDLY],
  'green': [AmenityCategory.ECO_FRIENDLY],
  'eco certified': [AmenityCategory.ECO_FRIENDLY],
};

/**
 * Parse raw amenity strings into standardized categories
 *
 * @param rawAmenities - Array of amenity strings from Amadeus
 * @returns Set of normalized AmenityCategory enums
 *
 * @example
 * parseAmenities(['Free WiFi', 'Swimming Pool', 'Restaurant'])
 * // Returns Set([WIFI, POOL, RESTAURANT])
 */
export function parseAmenities(rawAmenities: string[]): Set<AmenityCategory> {
  const normalized = new Set<AmenityCategory>();

  for (const amenity of rawAmenities) {
    const lowerAmenity = amenity.toLowerCase().trim();

    // Try exact match first
    if (AMENITY_KEYWORDS[lowerAmenity]) {
      AMENITY_KEYWORDS[lowerAmenity].forEach(cat => normalized.add(cat));
      continue;
    }

    // Try partial match (contains keyword)
    for (const [keyword, categories] of Object.entries(AMENITY_KEYWORDS)) {
      if (lowerAmenity.includes(keyword)) {
        categories.forEach(cat => normalized.add(cat));
      }
    }
  }

  return normalized;
}

/**
 * Check if amenity set includes specific category
 *
 * @param amenities - Set of amenity categories
 * @param category - Category to check
 * @returns true if amenity is present
 */
export function hasAmenity(amenities: Set<AmenityCategory>, category: AmenityCategory): boolean {
  return amenities.has(category);
}

/**
 * Count amenities in a specific group
 *
 * @param amenities - Set of amenity categories
 * @param group - Array of categories to count
 * @returns Number of amenities present from the group
 *
 * @example
 * const climate = [POOL, AIR_CONDITIONING, HEATING];
 * countAmenitiesInGroup(amenities, climate) // Returns 2 if pool and AC present
 */
export function countAmenitiesInGroup(
  amenities: Set<AmenityCategory>,
  group: AmenityCategory[]
): number {
  return group.filter(cat => amenities.has(cat)).length;
}

/**
 * Get amenity coverage score for a dimension
 *
 * Calculates what percentage of expected amenities are present.
 *
 * @param amenities - Set of amenity categories
 * @param expectedAmenities - Array of amenities expected for full score
 * @returns Score [0-1] representing coverage
 *
 * @example
 * const spaAmenities = [SPA, SAUNA, HOT_TUB, WELLNESS_CENTER];
 * getAmenityCoverage(amenities, spaAmenities) // Returns 0.75 if 3/4 present
 */
export function getAmenityCoverage(
  amenities: Set<AmenityCategory>,
  expectedAmenities: AmenityCategory[]
): number {
  const presentCount = countAmenitiesInGroup(amenities, expectedAmenities);
  return expectedAmenities.length > 0 ? presentCount / expectedAmenities.length : 0;
}

/**
 * Climate amenities group
 */
export const CLIMATE_AMENITIES: AmenityCategory[] = [
  AmenityCategory.POOL,
  AmenityCategory.AIR_CONDITIONING,
  AmenityCategory.HEATING,
  AmenityCategory.SAUNA,
  AmenityCategory.HOT_TUB,
];

/**
 * Activity amenities group
 */
export const ACTIVITY_AMENITIES: AmenityCategory[] = [
  AmenityCategory.GYM,
  AmenityCategory.SPA,
  AmenityCategory.SPORTS_FACILITIES,
  AmenityCategory.WATER_SPORTS,
  AmenityCategory.WELLNESS_CENTER,
];

/**
 * Gastronomy amenities group
 */
export const GASTRONOMY_AMENITIES: AmenityCategory[] = [
  AmenityCategory.RESTAURANT,
  AmenityCategory.BAR,
  AmenityCategory.ROOM_SERVICE,
  AmenityCategory.BREAKFAST_INCLUDED,
  AmenityCategory.FINE_DINING,
];

/**
 * Family amenities group
 */
export const FAMILY_AMENITIES: AmenityCategory[] = [
  AmenityCategory.KIDS_CLUB,
  AmenityCategory.PLAYGROUND,
  AmenityCategory.BABYSITTING,
  AmenityCategory.FAMILY_ROOMS,
];

/**
 * Business amenities group
 */
export const BUSINESS_AMENITIES: AmenityCategory[] = [
  AmenityCategory.BUSINESS_CENTER,
  AmenityCategory.MEETING_ROOMS,
  AmenityCategory.CONFERENCE_FACILITIES,
  AmenityCategory.COWORKING_SPACE,
];

/**
 * Luxury amenities group
 */
export const LUXURY_AMENITIES: AmenityCategory[] = [
  AmenityCategory.CONCIERGE,
  AmenityCategory.BUTLER_SERVICE,
  AmenityCategory.VIP_LOUNGE,
  AmenityCategory.FINE_DINING,
];

/**
 * Romance amenities group
 */
export const ROMANCE_AMENITIES: AmenityCategory[] = [
  AmenityCategory.COUPLES_SPA,
  AmenityCategory.PRIVATE_DINING,
  AmenityCategory.ROMANCE_PACKAGE,
];

/**
 * Nature amenities group
 */
export const NATURE_AMENITIES: AmenityCategory[] = [
  AmenityCategory.GARDEN,
  AmenityCategory.TERRACE,
  AmenityCategory.OUTDOOR_ACTIVITIES,
  AmenityCategory.ECO_FRIENDLY,
];

/**
 * Extract amenities from Amadeus hotel response
 *
 * Handles various formats Amadeus might return amenities in.
 *
 * @param amadeusHotel - Raw hotel object from Amadeus API
 * @returns Set of normalized amenity categories
 */
export function extractAmadeusAmenities(amadeusHotel: any): Set<AmenityCategory> {
  const amenities: string[] = [];

  // Amenities might be in different fields
  if (amadeusHotel.amenities) {
    if (Array.isArray(amadeusHotel.amenities)) {
      amenities.push(...amadeusHotel.amenities);
    } else if (typeof amadeusHotel.amenities === 'object') {
      // Sometimes amenities are { code: string, description: string }[]
      const amenityArray = Object.values(amadeusHotel.amenities);
      amenityArray.forEach((item: any) => {
        if (item.description) amenities.push(item.description);
        if (item.code) amenities.push(item.code);
      });
    }
  }

  // Check hotel property for additional amenities
  if (amadeusHotel.hotel?.amenities) {
    amenities.push(...amadeusHotel.hotel.amenities);
  }

  // Check descriptions for keywords
  if (amadeusHotel.description) {
    amenities.push(amadeusHotel.description);
  }

  return parseAmenities(amenities);
}

/**
 * Validate amenity set for completeness
 *
 * Checks if we have minimum expected amenities for a quality hotel.
 *
 * @param amenities - Set of amenity categories
 * @returns Validation result with warnings
 */
export function validateAmenities(amenities: Set<AmenityCategory>): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Minimum expected: WiFi
  if (!hasAmenity(amenities, AmenityCategory.WIFI)) {
    warnings.push('Missing WiFi - uncommon for modern hotels');
  }

  // If empty, likely parsing issue
  if (amenities.size === 0) {
    warnings.push('No amenities detected - may indicate data quality issue');
  }

  return {
    isValid: amenities.size > 0,
    warnings,
  };
}
