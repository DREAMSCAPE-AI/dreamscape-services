/**
 * Simplified DTOs for Hotel Offers
 * Optimized for frontend consumption
 */

export interface SimplifiedHotelOfferDTO {
  id: string;
  hotelId: string;
  name: string;
  cityCode: string | null;
  location: {
    latitude: number | null;
    longitude: number | null;
    distance?: number;
    distanceUnit?: string;
  };
  address: {
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
  rating: number | null;
  reviewCount: number | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  price: {
    amount: number;
    currency: string;
    perNight: number;
    base?: number;
    taxes?: number;
  };
  room: {
    type: string;
    description: string | null;
    beds: number | null;
    bedType: string | null;
    guests: number;
  };
  amenities: string[];
  images: string[];
  cancellation: {
    freeCancellation: boolean;
    deadline: string | null;
    penalty: number | null;
  };
  chainCode: string | null;
  contact: {
    phone: string | null;
    email: string | null;
  } | null;
}

export interface SimplifiedHotelListDTO {
  hotels: SimplifiedHotelOfferDTO[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
