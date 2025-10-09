/**
 * Mapper for Flight Offers API responses
 * Converts Amadeus API responses to internal DTOs
 *
 * Ticket: DR-132 - VOYAGE-001.3 : Mapping des réponses Flight API
 */

import {
  FlightOfferDTO,
  SimplifiedFlightOfferDTO,
  ItineraryDTO,
  SegmentDTO,
  PriceDTO,
  TravelerPricingDTO
} from '../dto/FlightOffer.dto';

export class FlightOfferMapper {
  /**
   * Maps Amadeus Flight Offer response to internal DTO
   */
  static mapToDTO(amadeusOffer: any): FlightOfferDTO {
    if (!amadeusOffer) {
      throw new Error('Invalid Amadeus offer: offer is null or undefined');
    }

    return {
      id: amadeusOffer.id,
      source: amadeusOffer.source,
      instantTicketingRequired: amadeusOffer.instantTicketingRequired ?? false,
      nonHomogeneous: amadeusOffer.nonHomogeneous ?? false,
      oneWay: amadeusOffer.oneWay ?? false,
      lastTicketingDate: amadeusOffer.lastTicketingDate,
      numberOfBookableSeats: amadeusOffer.numberOfBookableSeats ?? 0,
      itineraries: this.mapItineraries(amadeusOffer.itineraries),
      price: this.mapPrice(amadeusOffer.price),
      pricingOptions: amadeusOffer.pricingOptions ?? { fareType: [], includedCheckedBagsOnly: false },
      validatingAirlineCodes: amadeusOffer.validatingAirlineCodes ?? [],
      travelerPricings: this.mapTravelerPricings(amadeusOffer.travelerPricings)
    };
  }

  /**
   * Maps multiple Amadeus offers to internal DTOs
   */
  static mapToDTOs(amadeusOffers: any[]): FlightOfferDTO[] {
    if (!Array.isArray(amadeusOffers)) {
      throw new Error('Invalid Amadeus offers: expected an array');
    }

    return amadeusOffers.map(offer => this.mapToDTO(offer));
  }

  /**
   * Simplifies flight offer for frontend consumption
   */
  static mapToSimplified(offer: FlightOfferDTO): SimplifiedFlightOfferDTO {
    const firstItinerary = offer.itineraries[0];
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

  // Private helper methods

  private static mapItineraries(itineraries: any[]): ItineraryDTO[] {
    if (!Array.isArray(itineraries)) {
      return [];
    }

    return itineraries.map(itinerary => ({
      duration: itinerary.duration,
      segments: this.mapSegments(itinerary.segments)
    }));
  }

  private static mapSegments(segments: any[]): SegmentDTO[] {
    if (!Array.isArray(segments)) {
      return [];
    }

    return segments.map(segment => ({
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
    }));
  }

  private static mapPrice(price: any): PriceDTO {
    return {
      currency: price.currency,
      total: price.total,
      base: price.base,
      fees: price.fees ?? [],
      grandTotal: price.grandTotal,
      additionalServices: price.additionalServices
    };
  }

  private static mapTravelerPricings(travelerPricings: any[]): TravelerPricingDTO[] {
    if (!Array.isArray(travelerPricings)) {
      return [];
    }

    return travelerPricings.map(tp => ({
      travelerId: tp.travelerId,
      fareOption: tp.fareOption,
      travelerType: tp.travelerType,
      price: {
        currency: tp.price.currency,
        total: tp.price.total,
        base: tp.price.base
      },
      fareDetailsBySegment: tp.fareDetailsBySegment?.map((fd: any) => ({
        segmentId: fd.segmentId,
        cabin: fd.cabin,
        fareBasis: fd.fareBasis,
        brandedFare: fd.brandedFare,
        class: fd.class,
        includedCheckedBags: fd.includedCheckedBags ?? {}
      })) ?? []
    }));
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
