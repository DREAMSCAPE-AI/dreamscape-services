/**
 * DTOs for Amadeus Hotel Search API
 * Based on Amadeus Hotel Search v3 API structure
 */

export interface HotelOfferDTO {
  type: string;
  hotel: HotelDTO;
  available: boolean;
  offers: OfferDTO[];
  self?: string;
}

export interface HotelDTO {
  type: string;
  hotelId: string;
  chainCode?: string;
  dupeId?: string;
  name: string;
  cityCode?: string;
  latitude?: number;
  longitude?: number;
  hotelDistance?: HotelDistanceDTO;
  address?: AddressDTO;
  contact?: ContactDTO;
  description?: DescriptionDTO;
  amenities?: string[];
  media?: MediaDTO[];
  rating?: string;
  ratings?: RatingsDTO;
}

export interface HotelDistanceDTO {
  distance: number;
  distanceUnit: string;
}

export interface AddressDTO {
  lines?: string[];
  postalCode?: string;
  cityName?: string;
  countryCode?: string;
  stateCode?: string;
}

export interface ContactDTO {
  phone?: string;
  fax?: string;
  email?: string;
}

export interface DescriptionDTO {
  lang?: string;
  text: string;
}

export interface MediaDTO {
  uri: string;
  category?: string;
}

export interface RatingsDTO {
  overall?: number;
  location?: number;
  service?: number;
  cleanliness?: number;
  comfort?: number;
  facilities?: number;
  staff?: number;
  numberOfReviews?: number;
}

export interface OfferDTO {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  rateCode?: string;
  rateFamilyEstimated?: RateFamilyEstimatedDTO;
  category?: string;
  description?: DescriptionDTO;
  commission?: CommissionDTO;
  room: RoomDTO;
  guests: GuestsDTO;
  price: PriceDTO;
  policies?: PoliciesDTO;
  self?: string;
}

export interface RateFamilyEstimatedDTO {
  code: string;
  type: string;
}

export interface CommissionDTO {
  percentage?: string;
  amount?: string;
  description?: DescriptionDTO;
}

export interface RoomDTO {
  type: string;
  typeEstimated?: TypeEstimatedDTO;
  description?: DescriptionDTO;
}

export interface TypeEstimatedDTO {
  category?: string;
  beds?: number;
  bedType?: string;
}

export interface GuestsDTO {
  adults: number;
  childAges?: number[];
}

export interface PriceDTO {
  currency: string;
  base?: string;
  total: string;
  taxes?: TaxDTO[];
  variations?: VariationsDTO;
  markups?: MarkupDTO[];
}

export interface TaxDTO {
  code?: string;
  amount?: string;
  currency?: string;
  included?: boolean;
  description?: string;
  pricingFrequency?: string;
  pricingMode?: string;
}

export interface VariationsDTO {
  average?: PriceVariationDTO;
  changes?: PriceChangeDTO[];
}

export interface PriceVariationDTO {
  base?: string;
  total?: string;
}

export interface PriceChangeDTO {
  startDate: string;
  endDate: string;
  base?: string;
  total?: string;
}

export interface MarkupDTO {
  amount?: string;
}

export interface PoliciesDTO {
  paymentType?: string;
  guarantee?: GuaranteeDTO;
  deposit?: DepositDTO;
  prepay?: PrepayDTO;
  holdTime?: HoldTimeDTO;
  cancellations?: CancellationDTO[];
  checkInOut?: CheckInOutDTO;
}

export interface GuaranteeDTO {
  acceptedPayments?: AcceptedPaymentsDTO;
}

export interface AcceptedPaymentsDTO {
  creditCards?: string[];
  methods?: string[];
}

export interface DepositDTO {
  amount?: string;
  deadline?: string;
  description?: DescriptionDTO;
  acceptedPayments?: AcceptedPaymentsDTO;
}

export interface PrepayDTO {
  amount?: string;
  deadline?: string;
  description?: DescriptionDTO;
  acceptedPayments?: AcceptedPaymentsDTO;
}

export interface HoldTimeDTO {
  deadline?: string;
}

export interface CancellationDTO {
  description?: DescriptionDTO;
  type?: string;
  amount?: string;
  numberOfNights?: number;
  percentage?: string;
  deadline?: string;
}

export interface CheckInOutDTO {
  checkIn?: string;
  checkOut?: string;
  checkInDescription?: DescriptionDTO;
  checkOutDescription?: DescriptionDTO;
}
