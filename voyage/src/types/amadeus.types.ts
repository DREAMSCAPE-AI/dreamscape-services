/**
 * Amadeus API Type Definitions
 * Complete type-safe interfaces for Amadeus Flight Offers API v2
 *
 * Ticket: DR-132 - VOYAGE-001.3 : Type Safety Implementation
 */

// ============================================================================
// FLIGHT OFFER TYPES
// ============================================================================

export interface AmadeusFlightOffer {
  id: string;
  source: string;
  instantTicketingRequired?: boolean;
  nonHomogeneous?: boolean;
  oneWay?: boolean;
  lastTicketingDate?: string;
  lastTicketingDateTime?: string;
  numberOfBookableSeats?: number;
  itineraries: AmadeusItinerary[];
  price: AmadeusPrice;
  pricingOptions?: AmadeusPricingOptions;
  validatingAirlineCodes?: string[];
  travelerPricings?: AmadeusTravelerPricing[];
}

export interface AmadeusItinerary {
  duration: string;
  segments: AmadeusSegment[];
}

export interface AmadeusSegment {
  departure: AmadeusEndPoint;
  arrival: AmadeusEndPoint;
  carrierCode: string;
  number: string;
  aircraft: AmadeusAircraft;
  operating?: AmadeusOperating;
  duration: string;
  id: string;
  numberOfStops?: number;
  blacklistedInEU?: boolean;
  co2Emissions?: AmadeusCO2Emission[];
}

export interface AmadeusEndPoint {
  iataCode: string;
  terminal?: string;
  at: string; // ISO 8601 datetime
}

export interface AmadeusAircraft {
  code: string;
}

export interface AmadeusOperating {
  carrierCode: string;
}

export interface AmadeusCO2Emission {
  weight: number;
  weightUnit: string;
  cabin: string;
}

// ============================================================================
// PRICE TYPES
// ============================================================================

export interface AmadeusPrice {
  currency: string;
  total: string;
  base: string;
  fees?: AmadeusFee[];
  grandTotal?: string;
  additionalServices?: AmadeusAdditionalService[];
  taxes?: AmadeusTax[];
}

export interface AmadeusFee {
  amount: string;
  type: string;
}

export interface AmadeusAdditionalService {
  amount: string;
  type: string;
}

export interface AmadeusTax {
  amount: string;
  code: string;
}

export interface AmadeusPricingOptions {
  fareType: string[];
  includedCheckedBagsOnly: boolean;
}

// ============================================================================
// TRAVELER PRICING TYPES
// ============================================================================

export interface AmadeusTravelerPricing {
  travelerId: string;
  fareOption: string;
  travelerType: string;
  price: AmadeusTravelerPrice;
  fareDetailsBySegment?: AmadeusFareDetail[];
}

export interface AmadeusTravelerPrice {
  currency: string;
  total: string;
  base: string;
  taxes?: AmadeusTax[];
  refundableTaxes?: string;
}

export interface AmadeusFareDetail {
  segmentId: string;
  cabin: string;
  fareBasis: string;
  brandedFare?: string;
  brandedFareLabel?: string;
  class: string;
  isAllotment?: boolean;
  allotmentDetails?: AmadeusAllotmentDetails;
  sliceDiceIndicator?: string;
  includedCheckedBags?: AmadeusCheckedBags;
  additionalServices?: AmadeusAdditionalServiceDetails;
}

export interface AmadeusAllotmentDetails {
  tourName?: string;
  tourReference?: string;
}

export interface AmadeusCheckedBags {
  quantity?: number;
  weight?: number;
  weightUnit?: string;
}

export interface AmadeusAdditionalServiceDetails {
  chargeableCheckedBags?: AmadeusChargeableCheckedBags;
  chargeableSeatSelection?: boolean;
  chargeableSeat?: boolean;
  otherServices?: string[];
}

export interface AmadeusChargeableCheckedBags {
  quantity?: number;
  weight?: number;
  weightUnit?: string;
  id?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface AmadeusFlightOffersResponse {
  data: AmadeusFlightOffer[];
  dictionaries?: AmadeusDictionaries;
  meta?: AmadeusMetadata;
}

export interface AmadeusDictionaries {
  locations?: Record<string, AmadeusLocation>;
  aircraft?: Record<string, string>;
  currencies?: Record<string, string>;
  carriers?: Record<string, string>;
}

export interface AmadeusLocation {
  cityCode?: string;
  countryCode?: string;
}

export interface AmadeusMetadata {
  count?: number;
  links?: AmadeusLinks;
}

export interface AmadeusLinks {
  self?: string;
  next?: string;
  previous?: string;
  last?: string;
  first?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface AmadeusError {
  status: number;
  code: number;
  title: string;
  detail: string;
  source?: AmadeusErrorSource;
}

export interface AmadeusErrorSource {
  parameter?: string;
  pointer?: string;
  example?: string;
}

export interface AmadeusErrorResponse {
  errors: AmadeusError[];
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export class AmadeusValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'AmadeusValidationError';
  }
}

/**
 * Type guards for Amadeus API responses
 */
export const AmadeusTypeGuards = {
  isFlightOffer(value: any): value is AmadeusFlightOffer {
    return (
      value &&
      typeof value === 'object' &&
      typeof value.id === 'string' &&
      typeof value.source === 'string' &&
      Array.isArray(value.itineraries) &&
      value.price &&
      typeof value.price === 'object'
    );
  },

  isItinerary(value: any): value is AmadeusItinerary {
    return (
      value &&
      typeof value === 'object' &&
      typeof value.duration === 'string' &&
      Array.isArray(value.segments)
    );
  },

  isSegment(value: any): value is AmadeusSegment {
    return (
      value &&
      typeof value === 'object' &&
      value.departure &&
      value.arrival &&
      typeof value.carrierCode === 'string' &&
      typeof value.number === 'string'
    );
  },

  isPrice(value: any): value is AmadeusPrice {
    return (
      value &&
      typeof value === 'object' &&
      typeof value.currency === 'string' &&
      typeof value.total === 'string' &&
      typeof value.base === 'string'
    );
  },

  isEndPoint(value: any): value is AmadeusEndPoint {
    return (
      value &&
      typeof value === 'object' &&
      typeof value.iataCode === 'string' &&
      typeof value.at === 'string'
    );
  }
};
