/**
 * Internal DTO for Flight Offers
 * Maps Amadeus Flight Offers API response to internal data structure
 */

export interface FlightOfferDTO {
  id: string;
  source: string;
  instantTicketingRequired: boolean;
  nonHomogeneous: boolean;
  oneWay: boolean;
  lastTicketingDate: string;
  numberOfBookableSeats: number;
  itineraries: ItineraryDTO[];
  price: PriceDTO;
  pricingOptions: PricingOptionsDTO;
  validatingAirlineCodes: string[];
  travelerPricings: TravelerPricingDTO[];
}

export interface ItineraryDTO {
  duration: string;
  segments: SegmentDTO[];
}

export interface SegmentDTO {
  departure: EndPointDTO;
  arrival: EndPointDTO;
  carrierCode: string;
  number: string;
  aircraft: AircraftDTO;
  operating?: OperatingDTO;
  duration: string;
  id: string;
  numberOfStops: number;
  blacklistedInEU: boolean;
}

export interface EndPointDTO {
  iataCode: string;
  terminal?: string;
  at: string; // ISO 8601 datetime
}

export interface AircraftDTO {
  code: string;
}

export interface OperatingDTO {
  carrierCode: string;
}

export interface PriceDTO {
  currency: string;
  total: string;
  base: string;
  fees: FeeDTO[];
  grandTotal: string;
  additionalServices?: AdditionalServiceDTO[];
}

export interface FeeDTO {
  amount: string;
  type: string;
}

export interface AdditionalServiceDTO {
  amount: string;
  type: string;
}

export interface PricingOptionsDTO {
  fareType: string[];
  includedCheckedBagsOnly: boolean;
}

export interface TravelerPricingDTO {
  travelerId: string;
  fareOption: string;
  travelerType: string;
  price: TravelerPriceDTO;
  fareDetailsBySegment: FareDetailDTO[];
}

export interface TravelerPriceDTO {
  currency: string;
  total: string;
  base: string;
}

export interface FareDetailDTO {
  segmentId: string;
  cabin: string;
  fareBasis: string;
  brandedFare?: string;
  class: string;
  includedCheckedBags: CheckedBagsDTO;
}

export interface CheckedBagsDTO {
  quantity?: number;
  weight?: number;
  weightUnit?: string;
}

/**
 * Simplified Flight Offer for frontend consumption
 */
export interface SimplifiedFlightOfferDTO {
  id: string;
  price: {
    total: number;
    currency: string;
  };
  duration: string;
  stops: number;
  departure: {
    airport: string;
    time: Date;
    terminal?: string;
  };
  arrival: {
    airport: string;
    time: Date;
    terminal?: string;
  };
  airline: {
    code: string;
    name?: string;
  };
  cabinClass: string;
  availableSeats: number;
  isRefundable: boolean;
  baggageAllowance: {
    checkedBags: number;
    cabinBags: number;
  };
}
