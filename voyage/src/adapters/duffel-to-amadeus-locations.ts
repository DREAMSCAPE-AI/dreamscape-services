/**
 * Adapter : Duffel Place[] → shape Amadeus attendue par les routes locations
 *
 * Duffel Place shape:
 * {
 *   id: "arp_lhr_gb",
 *   name: "London Heathrow",
 *   type: "airport" | "city",
 *   iata_code: "LHR",
 *   iata_city_code: "LON",
 *   iata_country_code: "GB",
 *   latitude: 51.47,
 *   longitude: -0.46,
 *   time_zone: "Europe/London",
 *   city?: { id, name, iata_code, iata_country_code }
 * }
 *
 * Shape de sortie attendue par le frontend (ex: AirportSearch autocomplete, HotelSearch):
 * {
 *   data: [{
 *     iataCode, cityCode, name, country, coordinates: { latitude, longitude },
 *     type: 'AIRPORT' | 'CITY',
 *     subType: 'AIRPORT' | 'CITY',
 *     address: { cityName, countryName }   ← requis par HotelSearch.tsx:271
 *   }]
 * }
 */

// ISO 3166-1 alpha-2 → country name (most common travel destinations)
const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AD: 'Andorra', AO: 'Angola',
  AR: 'Argentina', AM: 'Armenia', AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan',
  BS: 'Bahamas', BH: 'Bahrain', BD: 'Bangladesh', BY: 'Belarus', BE: 'Belgium',
  BZ: 'Belize', BJ: 'Benin', BT: 'Bhutan', BO: 'Bolivia', BA: 'Bosnia and Herzegovina',
  BW: 'Botswana', BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso',
  KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada', CV: 'Cape Verde', CF: 'Central African Republic',
  TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia', CG: 'Congo',
  CD: 'Congo (DR)', CR: 'Costa Rica', HR: 'Croatia', CU: 'Cuba', CY: 'Cyprus',
  CZ: 'Czech Republic', DK: 'Denmark', DJ: 'Djibouti', DO: 'Dominican Republic',
  EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador', EE: 'Estonia', ET: 'Ethiopia',
  FJ: 'Fiji', FI: 'Finland', FR: 'France', GA: 'Gabon', GE: 'Georgia',
  DE: 'Germany', GH: 'Ghana', GR: 'Greece', GT: 'Guatemala', GN: 'Guinea',
  HT: 'Haiti', HN: 'Honduras', HK: 'Hong Kong', HU: 'Hungary', IS: 'Iceland',
  IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq', IE: 'Ireland',
  IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan',
  KZ: 'Kazakhstan', KE: 'Kenya', KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos',
  LV: 'Latvia', LB: 'Lebanon', LY: 'Libya', LI: 'Liechtenstein', LT: 'Lithuania',
  LU: 'Luxembourg', MO: 'Macau', MK: 'Macedonia', MG: 'Madagascar', MY: 'Malaysia',
  MV: 'Maldives', ML: 'Mali', MT: 'Malta', MR: 'Mauritania', MU: 'Mauritius',
  MX: 'Mexico', MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro',
  MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NP: 'Nepal',
  NL: 'Netherlands', NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria',
  NO: 'Norway', OM: 'Oman', PK: 'Pakistan', PA: 'Panama', PY: 'Paraguay',
  PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar',
  RO: 'Romania', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia', SN: 'Senegal',
  RS: 'Serbia', SL: 'Sierra Leone', SG: 'Singapore', SK: 'Slovakia', SI: 'Slovenia',
  SO: 'Somalia', ZA: 'South Africa', KR: 'South Korea', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan',
  TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand', TG: 'Togo', TN: 'Tunisia',
  TR: 'Turkey', TM: 'Turkmenistan', UG: 'Uganda', UA: 'Ukraine', AE: 'United Arab Emirates',
  GB: 'United Kingdom', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
};

function getCountryName(code: string): string {
  if (!code) return '';
  return COUNTRY_NAMES[code.toUpperCase()] || code;
}

export interface AmadeusLocationShape {
  iataCode: string;
  cityCode: string;
  name: string;
  country: string;
  coordinates: {
    latitude: number | null;
    longitude: number | null;
  };
  type: string;
  subType: string;
  timeZone?: string;
  address: {
    cityName: string;
    countryName: string;
  };
}

export function duffelToAmadeusLocations(
  duffelPlaces: any[],
  subTypeFilter?: string
): { data: AmadeusLocationShape[]; meta: { count: number } } {
  if (!Array.isArray(duffelPlaces)) {
    return { data: [], meta: { count: 0 } };
  }

  const mapped: AmadeusLocationShape[] = [];

  for (const place of duffelPlaces) {
    const type = (place.type || 'airport').toUpperCase(); // 'AIRPORT' | 'CITY'

    // Filter by subType if provided
    if (subTypeFilter) {
      const filter = subTypeFilter.toUpperCase();
      if (filter === 'AIRPORT' && type !== 'AIRPORT') continue;
      if (filter === 'CITY' && type !== 'CITY') continue;
    }

    const countryCode = place.iata_country_code || place.city?.iata_country_code || '';
    // For cities, cityName = place.name; for airports, prefer place.city?.name
    const cityName = type === 'AIRPORT'
      ? (place.city?.name || place.name || '')
      : (place.name || '');

    mapped.push({
      iataCode: place.iata_code || place.iata_city_code || '',
      cityCode: place.iata_city_code || place.city?.iata_code || place.iata_code || '',
      name: place.name || '',
      country: countryCode,
      coordinates: {
        latitude: place.latitude ?? null,
        longitude: place.longitude ?? null,
      },
      type,
      subType: type,
      timeZone: place.time_zone,
      address: {
        cityName,
        countryName: getCountryName(countryCode),
      },
    });
  }

  return {
    data: mapped,
    meta: { count: mapped.length },
  };
}
