/**
 * Mapper for Flight Offers API responses
 * Converts Amadeus API responses to internal DTOs
 *
 * Ticket: DR-132 - VOYAGE-001.3 : Mapping des réponses Flight API
 * FIXED: Type safety and validation (DR-132-FIX)
 */

import {
  FlightOfferDTO,
  SimplifiedFlightOfferDTO,
  ItineraryDTO,
  SegmentDTO,
  PriceDTO,
  TravelerPricingDTO
} from '../dto/FlightOffer.dto';

import {
  AmadeusFlightOffer,
  AmadeusItinerary,
  AmadeusSegment,
  AmadeusPrice,
  AmadeusTravelerPricing,
  AmadeusTypeGuards,
  AmadeusValidationError
} from '../types/amadeus.types';

export class FlightOfferMapper {
  /**
   * Maps Amadeus Flight Offer response to internal DTO
   * Now with full type safety and validation
   */
  static mapToDTO(amadeusOffer: AmadeusFlightOffer): FlightOfferDTO {
    // Validate input
    this.validateFlightOffer(amadeusOffer);

    try {

      return {
        id: amadeusOffer.id,
        source: amadeusOffer.source,
        instantTicketingRequired: amadeusOffer.instantTicketingRequired ?? false,
        nonHomogeneous: amadeusOffer.nonHomogeneous ?? false,
        oneWay: amadeusOffer.oneWay ?? false,
        lastTicketingDate: amadeusOffer.lastTicketingDate ?? amadeusOffer.lastTicketingDateTime ?? '',
        numberOfBookableSeats: amadeusOffer.numberOfBookableSeats ?? 0,
        itineraries: this.mapItineraries(amadeusOffer.itineraries),
        price: this.mapPrice(amadeusOffer.price),
        pricingOptions: amadeusOffer.pricingOptions ?? { fareType: [], includedCheckedBagsOnly: false },
        validatingAirlineCodes: amadeusOffer.validatingAirlineCodes ?? [],
        travelerPricings: this.mapTravelerPricings(amadeusOffer.travelerPricings ?? [])
      };
    } catch (error) {
      if (error instanceof AmadeusValidationError) {
        throw error;
      }
      throw new AmadeusValidationError(
        `Failed to map flight offer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'amadeusOffer'
      );
    }
  }

  /**
   * Validates the complete flight offer structure
   */
  private static validateFlightOffer(offer: any): asserts offer is AmadeusFlightOffer {
    if (!offer) {
      throw new AmadeusValidationError('Flight offer is null or undefined');
    }

    if (!offer.id || typeof offer.id !== 'string') {
      throw new AmadeusValidationError('Missing or invalid flight offer ID', 'id');
    }

    if (!offer.source || typeof offer.source !== 'string') {
      throw new AmadeusValidationError('Missing or invalid flight offer source', 'source');
    }

    if (!Array.isArray(offer.itineraries) || offer.itineraries.length === 0) {
      throw new AmadeusValidationError('Missing or empty itineraries', 'itineraries');
    }

    if (!AmadeusTypeGuards.isPrice(offer.price)) {
      throw new AmadeusValidationError('Missing or invalid price information', 'price');
    }

    // Validate each itinerary
    offer.itineraries.forEach((itinerary: any, index: number) => {
      if (!AmadeusTypeGuards.isItinerary(itinerary)) {
        throw new AmadeusValidationError(
          `Invalid itinerary at index ${index}`,
          `itineraries[${index}]`
        );
      }
    });
  }

  /**
   * Maps multiple Amadeus offers to internal DTOs
   * Now with error handling for individual offers
   */
  static mapToDTOs(amadeusOffers: AmadeusFlightOffer[]): FlightOfferDTO[] {
    if (!Array.isArray(amadeusOffers)) {
      throw new AmadeusValidationError('Expected an array of flight offers');
    }

    if (amadeusOffers.length === 0) {
      return [];
    }

    const results: FlightOfferDTO[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    amadeusOffers.forEach((offer, index) => {
      try {
        results.push(this.mapToDTO(offer));
      } catch (error) {
        errors.push({
          index,
          error: error instanceof Error ? error : new Error('Unknown error')
        });
      }
    });

    // If more than 50% of offers failed, throw an error
    if (errors.length > amadeusOffers.length / 2) {
      throw new AmadeusValidationError(
        `Failed to map ${errors.length}/${amadeusOffers.length} flight offers. First error: ${errors[0]?.error.message}`
      );
    }

    // Log warnings for individual failures but continue with successful mappings
    if (errors.length > 0) {
      console.warn(`Failed to map ${errors.length} flight offers:`, errors);
    }

    return results;
  }

  /**
   * Simplifies flight offer for frontend consumption
   * Now with validation
   */
  static mapToSimplified(offer: FlightOfferDTO): SimplifiedFlightOfferDTO {
    if (!offer.itineraries || offer.itineraries.length === 0) {
      throw new AmadeusValidationError('Cannot simplify offer: missing itineraries');
    }

    const firstItinerary = offer.itineraries[0];

    if (!firstItinerary.segments || firstItinerary.segments.length === 0) {
      throw new AmadeusValidationError('Cannot simplify offer: missing segments');
    }

    const firstSegment = firstItinerary.segments[0];
    const lastSegment = firstItinerary.segments[firstItinerary.segments.length - 1];
    const totalStops = firstItinerary.segments.reduce((sum, seg) => sum + seg.numberOfStops, 0);

    // Extract cabin class from first traveler pricing
    const cabinClass = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ?? 'ECONOMY';

    // Calculate baggage allowance
    const checkedBags = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags?.quantity ?? 0;

    return {
      id: offer.id,
      price: {
        total: parseFloat(offer.price.total),
        currency: offer.price.currency
      },
      duration: firstItinerary.duration,
      stops: totalStops,
      departure: {
        airport: firstSegment.departure.iataCode,
        time: new Date(firstSegment.departure.at),
        terminal: firstSegment.departure.terminal
      },
      arrival: {
        airport: lastSegment.arrival.iataCode,
        time: new Date(lastSegment.arrival.at),
        terminal: lastSegment.arrival.terminal
      },
      airline: {
        code: firstSegment.carrierCode,
        name: this.getAirlineName(firstSegment.carrierCode)
      },
      cabinClass,
      availableSeats: offer.numberOfBookableSeats,
      isRefundable: this.isRefundable(offer.pricingOptions.fareType),
      baggageAllowance: {
        checkedBags,
        cabinBags: 1 // Usually 1 cabin bag is allowed
      }
    };
  }

  /**
   * Simplifies multiple offers
   */
  static mapToSimplifiedList(offers: FlightOfferDTO[]): SimplifiedFlightOfferDTO[] {
    return offers.map(offer => this.mapToSimplified(offer));
  }

  // Private helper methods with validation

  private static mapItineraries(itineraries: AmadeusItinerary[]): ItineraryDTO[] {
    if (!Array.isArray(itineraries)) {
      throw new AmadeusValidationError('Itineraries must be an array');
    }

    return itineraries.map((itinerary, index) => {
      if (!itinerary.duration) {
        throw new AmadeusValidationError(
          `Missing duration for itinerary at index ${index}`,
          `itineraries[${index}].duration`
        );
      }

      if (!Array.isArray(itinerary.segments) || itinerary.segments.length === 0) {
        throw new AmadeusValidationError(
          `Missing or empty segments for itinerary at index ${index}`,
          `itineraries[${index}].segments`
        );
      }

      return {
        duration: itinerary.duration,
        segments: this.mapSegments(itinerary.segments)
      };
    });
  }

  private static mapSegments(segments: AmadeusSegment[]): SegmentDTO[] {
    if (!Array.isArray(segments)) {
      throw new AmadeusValidationError('Segments must be an array');
    }

    return segments.map((segment, index) => {
      // Validate required fields
      if (!AmadeusTypeGuards.isSegment(segment)) {
        throw new AmadeusValidationError(
          `Invalid segment at index ${index}`,
          `segments[${index}]`
        );
      }

      if (!AmadeusTypeGuards.isEndPoint(segment.departure)) {
        throw new AmadeusValidationError(
          `Invalid departure endpoint at segment ${index}`,
          `segments[${index}].departure`
        );
      }

      if (!AmadeusTypeGuards.isEndPoint(segment.arrival)) {
        throw new AmadeusValidationError(
          `Invalid arrival endpoint at segment ${index}`,
          `segments[${index}].arrival`
        );
      }

      if (!segment.aircraft?.code) {
        throw new AmadeusValidationError(
          `Missing aircraft code at segment ${index}`,
          `segments[${index}].aircraft.code`
        );
      }

      return {
        departure: {
          iataCode: segment.departure.iataCode,
          terminal: segment.departure.terminal,
          at: segment.departure.at
        },
        arrival: {
          iataCode: segment.arrival.iataCode,
          terminal: segment.arrival.terminal,
          at: segment.arrival.at
        },
        carrierCode: segment.carrierCode,
        number: segment.number,
        aircraft: {
          code: segment.aircraft.code
        },
        operating: segment.operating ? {
          carrierCode: segment.operating.carrierCode
        } : undefined,
        duration: segment.duration,
        id: segment.id,
        numberOfStops: segment.numberOfStops ?? 0,
        blacklistedInEU: segment.blacklistedInEU ?? false
      };
    });
  }

  private static mapPrice(price: AmadeusPrice): PriceDTO {
    // Validate required price fields
    if (!price.currency || typeof price.currency !== 'string') {
      throw new AmadeusValidationError('Missing or invalid currency', 'price.currency');
    }

    if (!price.total || typeof price.total !== 'string') {
      throw new AmadeusValidationError('Missing or invalid total price', 'price.total');
    }

    if (!price.base || typeof price.base !== 'string') {
      throw new AmadeusValidationError('Missing or invalid base price', 'price.base');
    }

    // Validate numeric values
    const totalNum = parseFloat(price.total);
    const baseNum = parseFloat(price.base);

    if (isNaN(totalNum) || totalNum < 0) {
      throw new AmadeusValidationError('Total price must be a valid positive number', 'price.total');
    }

    if (isNaN(baseNum) || baseNum < 0) {
      throw new AmadeusValidationError('Base price must be a valid positive number', 'price.base');
    }

    return {
      currency: price.currency,
      total: price.total,
      base: price.base,
      fees: price.fees ?? [],
      grandTotal: price.grandTotal ?? price.total,
      additionalServices: price.additionalServices
    };
  }

  private static mapTravelerPricings(travelerPricings: AmadeusTravelerPricing[]): TravelerPricingDTO[] {
    if (!Array.isArray(travelerPricings)) {
      return [];
    }

    return travelerPricings.map((tp, index) => {
      // Validate required fields
      if (!tp.travelerId) {
        throw new AmadeusValidationError(
          `Missing traveler ID at index ${index}`,
          `travelerPricings[${index}].travelerId`
        );
      }

      if (!tp.fareOption) {
        throw new AmadeusValidationError(
          `Missing fare option at index ${index}`,
          `travelerPricings[${index}].fareOption`
        );
      }

      if (!tp.travelerType) {
        throw new AmadeusValidationError(
          `Missing traveler type at index ${index}`,
          `travelerPricings[${index}].travelerType`
        );
      }

      if (!tp.price?.currency || !tp.price?.total || !tp.price?.base) {
        throw new AmadeusValidationError(
          `Missing or invalid price for traveler at index ${index}`,
          `travelerPricings[${index}].price`
        );
      }

      return {
        travelerId: tp.travelerId,
        fareOption: tp.fareOption,
        travelerType: tp.travelerType,
        price: {
          currency: tp.price.currency,
          total: tp.price.total,
          base: tp.price.base
        },
        fareDetailsBySegment: tp.fareDetailsBySegment?.map((fd, fdIndex) => {
          if (!fd.segmentId) {
            throw new AmadeusValidationError(
              `Missing segment ID for fare detail at traveler ${index}, segment ${fdIndex}`,
              `travelerPricings[${index}].fareDetailsBySegment[${fdIndex}].segmentId`
            );
          }

          return {
            segmentId: fd.segmentId,
            cabin: fd.cabin,
            fareBasis: fd.fareBasis,
            brandedFare: fd.brandedFare,
            class: fd.class,
            includedCheckedBags: fd.includedCheckedBags ?? {}
          };
        }) ?? []
      };
    });
  }

  private static isRefundable(fareTypes: string[]): boolean {
    return fareTypes?.includes('REFUNDABLE') ?? false;
  }

  private static getAirlineName(code: string): string | undefined {
    // Common airline codes mapping
    const airlines: Record<string, string> = {
      'AF': 'Air France',
      'BA': 'British Airways',
      'LH': 'Lufthansa',
      'KL': 'KLM',
      'DL': 'Delta Air Lines',
      'AA': 'American Airlines',
      'UA': 'United Airlines',
      'EK': 'Emirates',
      'QR': 'Qatar Airways',
      'SQ': 'Singapore Airlines',
      'TK': 'Turkish Airlines',
      'EY': 'Etihad Airways',
      'QF': 'Qantas',
      'CX': 'Cathay Pacific',
      'JL': 'Japan Airlines',
      'NH': 'All Nippon Airways',
      'AC': 'Air Canada',
      'AZ': 'ITA Airways',
      'LX': 'Swiss International Air Lines',
      'OS': 'Austrian Airlines',
      'SK': 'Scandinavian Airlines',
      'IB': 'Iberia',
      'AY': 'Finnair',
      'VS': 'Virgin Atlantic',
      'FR': 'Ryanair',
      'U2': 'easyJet',
      'W6': 'Wizz Air'
    };

    return airlines[code];
  }
}
