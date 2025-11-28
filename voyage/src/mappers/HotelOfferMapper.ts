import { HotelOfferDTO } from '@/dto/HotelOffer.dto';
import { SimplifiedHotelOfferDTO } from '@/dto/SimplifiedHotelOffer.dto';

/**
 * Mapper for Hotel Offer data
 * Transforms Amadeus API responses to internal DTOs and simplified views
 */
export class HotelOfferMapper {
  /**
   * Map Amadeus API hotel offer to internal DTO
   */
  static mapToDTO(amadeusHotel: any): HotelOfferDTO {
    return {
      type: amadeusHotel.type || 'hotel-offer',
      hotel: {
        type: amadeusHotel.hotel?.type || 'hotel',
        hotelId: amadeusHotel.hotel?.hotelId || amadeusHotel.hotelId,
        chainCode: amadeusHotel.hotel?.chainCode,
        dupeId: amadeusHotel.hotel?.dupeId,
        name: amadeusHotel.hotel?.name || amadeusHotel.name || 'Unknown Hotel',
        cityCode: amadeusHotel.hotel?.cityCode,
        latitude: amadeusHotel.hotel?.latitude ? parseFloat(amadeusHotel.hotel.latitude) : undefined,
        longitude: amadeusHotel.hotel?.longitude ? parseFloat(amadeusHotel.hotel.longitude) : undefined,
        hotelDistance: amadeusHotel.hotel?.hotelDistance ? {
          distance: parseFloat(amadeusHotel.hotel.hotelDistance.distance),
          distanceUnit: amadeusHotel.hotel.hotelDistance.distanceUnit
        } : undefined,
        address: amadeusHotel.hotel?.address,
        contact: amadeusHotel.hotel?.contact,
        description: amadeusHotel.hotel?.description,
        amenities: amadeusHotel.hotel?.amenities || [],
        media: amadeusHotel.hotel?.media || [],
        rating: amadeusHotel.hotel?.rating,
        ratings: amadeusHotel.hotel?.ratings
      },
      available: amadeusHotel.available !== false,
      offers: amadeusHotel.offers?.map((offer: any) => ({
        id: offer.id,
        checkInDate: offer.checkInDate,
        checkOutDate: offer.checkOutDate,
        rateCode: offer.rateCode,
        rateFamilyEstimated: offer.rateFamilyEstimated,
        category: offer.category,
        description: offer.description,
        commission: offer.commission,
        room: {
          type: offer.room?.type || 'UNKNOWN',
          typeEstimated: offer.room?.typeEstimated,
          description: offer.room?.description
        },
        guests: {
          adults: offer.guests?.adults || 1,
          childAges: offer.guests?.childAges
        },
        price: {
          currency: offer.price?.currency || 'EUR',
          base: offer.price?.base,
          total: offer.price?.total || '0',
          taxes: offer.price?.taxes,
          variations: offer.price?.variations,
          markups: offer.price?.markups
        },
        policies: offer.policies,
        self: offer.self
      })) || [],
      self: amadeusHotel.self
    };
  }

  /**
   * Map multiple Amadeus hotel offers to DTOs
   */
  static mapToDTOs(amadeusHotels: any[]): HotelOfferDTO[] {
    if (!Array.isArray(amadeusHotels)) {
      return [];
    }
    return amadeusHotels.map(hotel => this.mapToDTO(hotel));
  }

  /**
   * Map DTO to simplified version for frontend
   */
  static mapToSimplified(dto: HotelOfferDTO): SimplifiedHotelOfferDTO {
    const firstOffer = dto.offers[0];
    const checkInDate = new Date(firstOffer?.checkInDate);
    const checkOutDate = new Date(firstOffer?.checkOutDate);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    const totalPrice = parseFloat(firstOffer?.price?.total || '0');
    const basePrice = parseFloat(firstOffer?.price?.base || firstOffer?.price?.total || '0');
    const taxesAmount = totalPrice - basePrice;

    // Extract cancellation policy
    const cancellationPolicy = firstOffer?.policies?.cancellations?.[0];
    const freeCancellation = cancellationPolicy?.type === 'FULL_REFUND' ||
                             cancellationPolicy?.amount === '0' ||
                             cancellationPolicy === undefined;
    const cancellationDeadline = cancellationPolicy?.deadline || null;
    const cancellationPenalty = cancellationPolicy?.amount ? parseFloat(cancellationPolicy.amount) : null;

    return {
      id: firstOffer?.id || dto.hotel.hotelId,
      hotelId: dto.hotel.hotelId,
      name: dto.hotel.name,
      cityCode: dto.hotel.cityCode || null,
      location: {
        latitude: dto.hotel.latitude || null,
        longitude: dto.hotel.longitude || null,
        distance: dto.hotel.hotelDistance?.distance,
        distanceUnit: dto.hotel.hotelDistance?.distanceUnit
      },
      address: {
        street: dto.hotel.address?.lines?.join(', ') || null,
        city: dto.hotel.address?.cityName || null,
        postalCode: dto.hotel.address?.postalCode || null,
        country: dto.hotel.address?.countryCode || null
      },
      rating: dto.hotel.ratings?.overall || (dto.hotel.rating ? parseFloat(dto.hotel.rating) : null),
      reviewCount: dto.hotel.ratings?.numberOfReviews || null,
      checkIn: firstOffer?.checkInDate || '',
      checkOut: firstOffer?.checkOutDate || '',
      nights,
      price: {
        amount: totalPrice,
        currency: firstOffer?.price?.currency || 'EUR',
        perNight: nights > 0 ? totalPrice / nights : totalPrice,
        base: basePrice,
        taxes: taxesAmount
      },
      room: {
        type: firstOffer?.room?.type || 'STANDARD',
        description: firstOffer?.room?.description?.text || firstOffer?.description?.text || null,
        beds: firstOffer?.room?.typeEstimated?.beds || null,
        bedType: firstOffer?.room?.typeEstimated?.bedType || null,
        guests: firstOffer?.guests?.adults || 1
      },
      amenities: dto.hotel.amenities || [],
      images: dto.hotel.media?.map(m => m.uri) || [],
      cancellation: {
        freeCancellation,
        deadline: cancellationDeadline,
        penalty: cancellationPenalty
      },
      chainCode: dto.hotel.chainCode || null,
      contact: dto.hotel.contact ? {
        phone: dto.hotel.contact.phone || null,
        email: dto.hotel.contact.email || null
      } : null
    };
  }

  /**
   * Map multiple DTOs to simplified version
   */
  static mapToSimplifiedList(dtos: HotelOfferDTO[]): SimplifiedHotelOfferDTO[] {
    if (!Array.isArray(dtos)) {
      return [];
    }
    return dtos.map(dto => this.mapToSimplified(dto));
  }

  /**
   * Map Amadeus hotels directly to simplified format (shortcut)
   */
  static mapAmadeusToSimplified(amadeusHotels: any[]): SimplifiedHotelOfferDTO[] {
    const dtos = this.mapToDTOs(amadeusHotels);
    return this.mapToSimplifiedList(dtos);
  }
}
