/**
 * City Name to IATA Code Mapper
 *
 * Converts city names (with country) to their IATA airport codes.
 * Supports multiple languages (English, French, Spanish, etc.)
 *
 * @module shared/utils
 */

/**
 * Comprehensive mapping of city names to IATA codes
 * Format: "city name" -> "IATA" or "city, country" -> "IATA"
 */
const CITY_TO_IATA_MAP: Record<string, string> = {
  // Major European Cities
  'paris': 'PAR',
  'london': 'LON',
  'londres': 'LON',
  'rome': 'ROM',
  'roma': 'ROM',
  'barcelona': 'BCN',
  'barcelone': 'BCN',
  'madrid': 'MAD',
  'berlin': 'BER',
  'amsterdam': 'AMS',
  'vienna': 'VIE',
  'vienne': 'VIE',
  'prague': 'PRG',
  'lisbon': 'LIS',
  'lisbonne': 'LIS',
  'athens': 'ATH',
  'athènes': 'ATH',
  'budapest': 'BUD',
  'warsaw': 'WAW',
  'varsovie': 'WAW',
  'copenhagen': 'CPH',
  'copenhague': 'CPH',
  'stockholm': 'STO',
  'oslo': 'OSL',
  'helsinki': 'HEL',
  'dublin': 'DUB',
  'edinburgh': 'EDI',
  'edimbourg': 'EDI',
  'brussels': 'BRU',
  'bruxelles': 'BRU',
  'zurich': 'ZRH',
  'geneva': 'GVA',
  'genève': 'GVA',
  'venice': 'VCE',
  'venise': 'VCE',
  'milan': 'MIL',
  'florence': 'FLR',
  'munich': 'MUC',
  'frankfurt': 'FRA',
  'cologne': 'CGN',
  'istanbul': 'IST',
  'moscow': 'MOW',
  'moscou': 'MOW',
  'st petersburg': 'LED',
  'saint-pétersbourg': 'LED',

  // North American Cities
  'new york': 'NYC',
  'los angeles': 'LAX',
  'chicago': 'CHI',
  'san francisco': 'SFO',
  'miami': 'MIA',
  'las vegas': 'LAS',
  'seattle': 'SEA',
  'boston': 'BOS',
  'washington': 'WAS',
  'toronto': 'YTO',
  'vancouver': 'YVR',
  'montreal': 'YMQ',
  'montréal': 'YMQ',
  'mexico city': 'MEX',
  'mexico': 'MEX',
  'cancun': 'CUN',
  'cancún': 'CUN',

  // Latin American Cities
  'buenos aires': 'BUE',
  'sao paulo': 'SAO',
  'são paulo': 'SAO',
  'rio de janeiro': 'RIO',
  'rio': 'RIO',
  'lima': 'LIM',
  'bogota': 'BOG',
  'bogotá': 'BOG',
  'santiago': 'SCL',
  'quito': 'UIO',
  'caracas': 'CCS',
  'havana': 'HAV',
  'la havane': 'HAV',

  // Asian Cities
  'tokyo': 'TYO',
  'beijing': 'BJS',
  'pékin': 'BJS',
  'shanghai': 'SHA',
  'hong kong': 'HKG',
  'singapore': 'SIN',
  'singapour': 'SIN',
  'seoul': 'SEL',
  'séoul': 'SEL',
  'bangkok': 'BKK',
  'kuala lumpur': 'KUL',
  'jakarta': 'JKT',
  'manila': 'MNL',
  'manille': 'MNL',
  'delhi': 'DEL',
  'new delhi': 'DEL',
  'mumbai': 'BOM',
  'bangalore': 'BLR',
  'chennai': 'MAA',
  'kolkata': 'CCU',
  'karachi': 'KHI',
  'islamabad': 'ISB',
  'tehran': 'THR',
  'téhéran': 'THR',
  'dubai': 'DXB',
  'dubaï': 'DXB',
  'abu dhabi': 'AUH',
  'doha': 'DOH',
  'riyadh': 'RUH',
  'tel aviv': 'TLV',
  'jerusalem': 'JRS',
  'jérusalem': 'JRS',

  // African Cities
  'cairo': 'CAI',
  'le caire': 'CAI',
  'johannesburg': 'JNB',
  'cape town': 'CPT',
  'le cap': 'CPT',
  'casablanca': 'CAS',
  'marrakech': 'RAK',
  'marrakesh': 'RAK',
  'tunis': 'TUN',
  'algiers': 'ALG',
  'alger': 'ALG',
  'lagos': 'LOS',
  'nairobi': 'NBO',
  'addis ababa': 'ADD',
  'dakar': 'DKR',

  // Oceania Cities
  'sydney': 'SYD',
  'melbourne': 'MEL',
  'brisbane': 'BNE',
  'perth': 'PER',
  'auckland': 'AKL',
  'wellington': 'WLG',
  'christchurch': 'CHC',
  'fiji': 'NAN',

  // Caribbean & Island Destinations
  'punta cana': 'PUJ',
  'santo domingo': 'SDQ',
  'san juan': 'SJU',
  'nassau': 'NAS',
  'bridgetown': 'BGI',
  'kingston': 'KIN',
  'port of spain': 'POS',

  // Middle East Cities
  'amman': 'AMM',
  'beirut': 'BEY',
  'beyrouth': 'BEY',
  'damascus': 'DAM',
  'damas': 'DAM',
  'baghdad': 'BGW',
  'kuwait': 'KWI',
  'muscat': 'MCT',
  'manama': 'BAH',

  // Additional Popular Destinations
  'kyoto': 'UKY',
  'osaka': 'OSA',
  'hanoi': 'HAN',
  'hanoï': 'HAN',
  'ho chi minh': 'SGN',
  'saigon': 'SGN',
  'phnom penh': 'PNH',
  'yangon': 'RGN',
  'rangoon': 'RGN',
  'kathmandu': 'KTM',
  'colombo': 'CMB',
  'male': 'MLE',
  'malé': 'MLE',
  'seychelles': 'SEZ',
  'mauritius': 'MRU',
  'ile maurice': 'MRU',
  'bali': 'DPS',
  'denpasar': 'DPS',
  'phuket': 'HKT',
  'bora bora': 'BOB',
  'tahiti': 'PPT',
  'honolulu': 'HNL',
  'maui': 'OGG',
  'reykjavik': 'REK',
  'reykjavík': 'REK',
};

/**
 * Parse a city name (with optional country) to IATA code
 *
 * @param cityName - City name, optionally with country (e.g., "Paris, France")
 * @returns IATA code or null if not found
 *
 * @example
 * parseCityNameToIATA("Paris, France") // => "PAR"
 * parseCityNameToIATA("Barcelone, Espagne") // => "BCN"
 * parseCityNameToIATA("Invalid City") // => null
 */
export function parseCityNameToIATA(cityName: string): string | null {
  if (!cityName || typeof cityName !== 'string') {
    return null;
  }

  // Extract city name (before comma if present)
  const cityPart = cityName.split(',')[0].trim().toLowerCase();

  // Remove accents for better matching
  const normalized = cityPart
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Try exact match first
  if (CITY_TO_IATA_MAP[normalized]) {
    return CITY_TO_IATA_MAP[normalized];
  }

  // Try original (with accents)
  if (CITY_TO_IATA_MAP[cityPart]) {
    return CITY_TO_IATA_MAP[cityPart];
  }

  // Not found
  return null;
}

/**
 * Parse multiple city names to IATA codes
 *
 * @param cityNames - Array of city names
 * @returns Array of valid IATA codes (invalid cities are filtered out)
 *
 * @example
 * parseCityNamesToIATA(["Paris, France", "London, UK", "Invalid"])
 * // => ["PAR", "LON"]
 */
export function parseCityNamesToIATA(cityNames: string[] | undefined): string[] {
  if (!cityNames || !Array.isArray(cityNames)) {
    return [];
  }

  return cityNames
    .map(city => parseCityNameToIATA(city))
    .filter((iata): iata is string => iata !== null);
}

/**
 * Check if a string is a valid IATA code (3 uppercase letters)
 *
 * @param code - Potential IATA code
 * @returns True if valid IATA format
 *
 * @example
 * isValidIATACode("PAR") // => true
 * isValidIATACode("Paris") // => false
 * isValidIATACode("PA") // => false
 */
export function isValidIATACode(code: string): boolean {
  const iataRegex = /^[A-Z]{3}$/;
  return iataRegex.test(code);
}

/**
 * Get all supported IATA codes
 *
 * @returns Array of all IATA codes in the mapping
 */
export function getAllSupportedIATACodes(): string[] {
  return [...new Set(Object.values(CITY_TO_IATA_MAP))];
}

/**
 * Get reverse mapping (IATA -> city names)
 * Useful for displaying city names from IATA codes
 *
 * @returns Map of IATA codes to their primary city names
 */
export function getIATAToCityMap(): Map<string, string> {
  const reverseMap = new Map<string, string>();

  // Build reverse mapping (IATA -> primary city name in English)
  const primaryNames: Record<string, string> = {
    'PAR': 'Paris',
    'LON': 'London',
    'ROM': 'Rome',
    'BCN': 'Barcelona',
    'NYC': 'New York',
    'LAX': 'Los Angeles',
    'TYO': 'Tokyo',
    'DXB': 'Dubai',
    'SIN': 'Singapore',
    'HKG': 'Hong Kong',
    'BKK': 'Bangkok',
    'SYD': 'Sydney',
    'MEL': 'Melbourne',
    // Add more as needed
  };

  for (const [iata, name] of Object.entries(primaryNames)) {
    reverseMap.set(iata, name);
  }

  return reverseMap;
}
