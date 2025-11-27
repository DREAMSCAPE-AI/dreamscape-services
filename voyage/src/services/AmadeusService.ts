import axios, { AxiosInstance } from 'axios';
import { config } from '@/config/environment';
import cacheService from './CacheService';

export interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface FlightSearchParams {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  infants?: number;
  travelClass?: string;
  nonStop?: boolean;
  maxPrice?: number;
  max?: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

interface HotelSearchParams {
  cityCode?: string;
  latitude?: number;
  longitude?: number;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  roomQuantity?: number;
  radius?: number;
  radiusUnit?: string;
  hotelIds?: string;
  ratings?: string[];
  amenities?: string[];
  priceRange?: string;
  currency?: string;
  lang?: string;
  max?: number;
  page?: PaginationParams;
}

export interface ActivitySearchParams {
  latitude: number;
  longitude: number;
  radius?: number;
  north?: number;
  west?: number;
  south?: number;
  east?: number;
}

class AmadeusService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // Increased to 2 seconds between requests
  private rateLimitRetryCount = 0;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  
  // Circuit breaker properties
  private circuitBreakerFailureCount = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private circuitBreakerLastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private isCircuitOpen = false;

  constructor() {
    this.api = axios.create({
      baseURL: config.amadeus.baseUrl,
      timeout: 30000, // Increased timeout to 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor to ensure valid token and rate limiting
    this.api.interceptors.request.use(
      async (config) => {
        await this.ensureValidToken();
        await this.enforceRateLimit();
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling and retry logic
    this.api.interceptors.response.use(
      (response) => {
        // Reset retry count and circuit breaker on successful response
        this.rateLimitRetryCount = 0;
        this.circuitBreakerFailureCount = 0;
        if (this.isCircuitOpen) {
          this.isCircuitOpen = false;
          console.log('Circuit breaker closed after successful response');
        }
        return response;
      },
      async (error) => {
        console.error('Amadeus API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            params: error.config?.params
          }
        });

        // Handle 429 rate limit errors with exponential backoff
        if (error.response?.status === 429 && this.rateLimitRetryCount < this.MAX_RETRY_ATTEMPTS) {
          this.rateLimitRetryCount++;
          const backoffTime = Math.pow(2, this.rateLimitRetryCount) * 1000; // Exponential backoff
          console.log(`Rate limit hit, retrying in ${backoffTime}ms (attempt ${this.rateLimitRetryCount}/${this.MAX_RETRY_ATTEMPTS})`);
          
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          return this.api.request(error.config);
        }

        // Circuit breaker logic
        if (error.response?.status === 429) {
          this.circuitBreakerFailureCount++;
          this.circuitBreakerLastFailureTime = Date.now();
          if (this.circuitBreakerFailureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
            this.isCircuitOpen = true;
            console.log('Circuit breaker opened due to consecutive rate limit errors');
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async enforceRateLimit(): Promise<void> {
    // Check circuit breaker
    this.checkCircuitBreaker();
    
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private checkCircuitBreaker(): void {
    if (this.isCircuitOpen) {
      const now = Date.now();
      const timeSinceLastFailure = now - this.circuitBreakerLastFailureTime;
      
      if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT) {
        // Reset circuit breaker
        this.isCircuitOpen = false;
        this.circuitBreakerFailureCount = 0;
        console.log('Circuit breaker reset - attempting to resume normal operation');
      } else {
        const remainingTime = Math.ceil((this.CIRCUIT_BREAKER_TIMEOUT - timeSinceLastFailure) / 1000);
        throw new Error(`Circuit breaker is open. API requests are temporarily disabled. Try again in ${remainingTime} seconds.`);
      }
    }
  }

  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    if (!this.accessToken || now >= this.tokenExpiresAt) {
      await this.authenticate();
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post(
        `${config.amadeus.baseUrl}/v1/security/oauth2/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.amadeus.apiKey,
          client_secret: config.amadeus.apiSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data: AmadeusTokenResponse = response.data;
      this.accessToken = data.access_token;
      // Set expiration 5 minutes before actual expiry for safety
      this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
      
      console.log('Amadeus authentication successful');
    } catch (error) {
      console.error('Amadeus authentication failed:', error);
      throw new Error('Failed to authenticate with Amadeus API');
    }
  }

  private handleError(error: any, context: string): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      // Handle specific error cases
      if (status === 429) {
        return new Error(`Rate limit exceeded. Please try again later. Context: ${context}`);
      } else if (status === 400) {
        const errorMessage = data?.errors?.[0]?.detail || data?.error_description || 'Invalid request parameters';
        return new Error(`Bad Request: ${errorMessage}. Context: ${context}`);
      } else if (status === 401) {
        return new Error(`Authentication failed. Context: ${context}`);
      } else if (status === 404) {
        return new Error(`Resource not found. Context: ${context}`);
      } else if (status >= 500) {
        return new Error(`Server error (${status}). Context: ${context}`);
      }
      
      return new Error(`API Error (${status}): ${data?.message || error.message}. Context: ${context}`);
    } else if (error.request) {
      return new Error(`Network error: No response received. Context: ${context}`);
    } else {
      return new Error(`Request error: ${error.message}. Context: ${context}`);
    }
  }

  async searchLocations(params: { keyword: string; subType?: string; countryCode?: string }): Promise<any> {
    try {
      // Clean and validate the keyword
      const cleanKeyword = this.cleanLocationKeyword(params.keyword);

      if (!cleanKeyword || cleanKeyword.length < 2) {
        throw new Error('Keyword must be at least 2 characters long');
      }

      const searchParams: any = {
        keyword: cleanKeyword,
        'page[limit]': 10,
        'page[offset]': 0
      };

      // Only add subType if it's provided and valid
      if (params.subType && ['AIRPORT', 'CITY', 'HOTEL', 'DISTRICT'].includes(params.subType)) {
        searchParams.subType = params.subType;
      }

      // Only add countryCode if it's provided and valid (2-letter ISO code)
      if (params.countryCode && /^[A-Z]{2}$/.test(params.countryCode)) {
        searchParams.countryCode = params.countryCode;
      }

      console.log('Location search params:', searchParams);

      // Use cache wrapper
      return await cacheService.cacheWrapper(
        'locations',
        searchParams,
        async () => {
          const response = await this.api.get('/v1/reference-data/locations', {
            params: searchParams
          });
          return response.data;
        }
      );
    } catch (error) {
      console.error('Amadeus location search error:', error);
      throw this.handleError(error, `Location search for "${params.keyword}"`);
    }
  }

  // Clean location keyword to handle various input formats
  private cleanLocationKeyword(keyword: string): string {
    if (!keyword) return '';
    
    // Remove extra spaces and convert to proper case
    let cleaned = keyword.trim();
    
    // Handle "CITY, COUNTRY" format - extract just the city name for better results
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      cleaned = parts[0].trim();
    }
    
    // Handle all caps - convert to title case for better API results
    if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
      cleaned = cleaned.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return cleaned;
  }

  async searchHotels(params: HotelSearchParams): Promise<any> {
    // Wrap with cache for better performance
    return await cacheService.cacheWrapper(
      'hotels',
      params,
      async () => {
        try {
          // Validate required parameters
          if (!params.checkInDate || !params.checkOutDate) {
            throw new Error('Check-in and check-out dates are required');
          }

          // Validate date format (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(params.checkInDate) || !dateRegex.test(params.checkOutDate)) {
            throw new Error('Dates must be in YYYY-MM-DD format');
          }

          // Validate that check-in is before check-out
          if (new Date(params.checkInDate) >= new Date(params.checkOutDate)) {
            throw new Error('Check-in date must be before check-out date');
          }

          // Set pagination defaults
          const page = params.page || { offset: 0, limit: 10 };
          const limit = Math.min(50, Math.max(1, page.limit || 10));
          const offset = Math.max(0, page.offset || 0);

          const searchParams: any = {
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            adults: Math.max(1, Math.min(8, params.adults ?? 1)), // Clamp between 1-8
            roomQuantity: Math.max(1, Math.min(8, params.roomQuantity ?? 1)), // Clamp between 1-8
            view: 'FULL_ALL_IMAGES'
          };

          if (params.page) {
            searchParams.page = {
              limit: params.page.limit,
              offset: params.page.offset
            };
          }

          try {
            const response = await this.api.get('/v3/shopping/hotel-offers', {
              params: searchParams
            });
            return response.data;
          } catch (error: any) {
            // If we get a rate limit error or no city code, try the fallback
            if (error.response?.status === 429 || !params.cityCode) {
              throw this.handleError(error, `Hotel search for ${params.cityCode || 'coordinates'}`);
            }

            try {
              console.log('Trying hotel list endpoint as fallback...');
              const fallbackResponse = await this.api.get('/v1/reference-data/locations/hotels/by-city', {
                params: {
                  cityCode: params.cityCode,
                  radius: params.radius || 5,
                  radiusUnit: params.radiusUnit || 'KM',
              hotelSource: 'ALL'
            }
          });
          return fallbackResponse.data;
        } catch (fallbackError) {
          console.error('Hotel fallback search also failed:', fallbackError);
          throw this.handleError(error, `Hotel search for ${params.cityCode || 'coordinates'}`);
        }
      }
    } catch (error) {
      // This catch block was missing - it handles any errors from the validation logic
      throw this.handleError(error, `Hotel search for ${params.cityCode || 'coordinates'}`);
    }
      }
    );
  }

  async searchFlights(params: FlightSearchParams) {
    try {
      // Use cache wrapper for flight search
      return await cacheService.cacheWrapper(
        'flights',
        params,
        async () => {
          const response = await this.api.get('/v2/shopping/flight-offers', { params });
          return response.data;
        }
      );
    } catch (error) {
      throw this.handleError(error, 'Flight search failed');
    }
  }

  /**
   * Search flights with DTO mapping
   * Ticket: DR-133 - VOYAGE-001.4 : Service Flight Search
   * Maps Amadeus API response to internal DTOs
   */
  async searchFlightsWithMapping(params: FlightSearchParams) {
    try {
      // Use cache wrapper for flight search with mapping
      return await cacheService.cacheWrapper(
        'flightOffers',
        params,
        async () => {
          const response = await this.api.get('/v2/shopping/flight-offers', { params });
          // Note: FlightOfferMapper can be imported when needed
          // For now, return raw data - mapper will be used in routes
          return response.data;
        }
      );
    } catch (error) {
      throw this.handleError(error, 'Flight search failed');
    }
  }

  async searchFlightDestinations(params: { origin: string; maxPrice?: number; departureDate?: string }) {
    try {
      const response = await this.api.get('/v1/shopping/flight-destinations', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight destinations search failed');
    }
  }

  async getHotelDetails(offerId: string): Promise<any> {
    try {
      // Use cache wrapper for hotel details
      return await cacheService.cacheWrapper(
        'hotelDetails',
        { offerId },
        async () => {
          const response = await this.api.get(`/v3/shopping/hotel-offers/${offerId}`);
          return response.data;
        }
      );
    } catch (error) {
      throw this.handleError(error, 'Failed to get hotel details');
    }
  }



  async autocompleteHotelName(params: {
    keyword: string;
    subType?: string;
    countryCode?: string;
    max?: number;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/reference-data/locations/hotel', {
        params
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to autocomplete hotel name');
    }
  }

  async searchActivities(params: ActivitySearchParams) {
    try {
      const response = await this.api.get('/v1/shopping/activities', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Activities search failed');
    }
  }

  async getActivityDetails(activityId: string) {
    try {
      const response = await this.api.get(`/v1/shopping/activities/${activityId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Activity details fetch failed');
    }
  }

  async analyzeFlightPrices(params: {
    originIataCode: string;
    destinationIataCode: string;
    departureDate: string;
    currencyCode?: string;
  }): Promise<any> {
    try {
      // Use cache wrapper for flight price analysis
      return await cacheService.cacheWrapper(
        'flightPrices',
        params,
        async () => {
          const response = await this.api.get('/v1/analytics/itinerary-price-metrics', { params });
          return response.data;
        }
      );
    } catch (error) {
      throw this.handleError(error, 'Flight price analysis failed');
    }
  }

  async predictFlightChoice(params: any): Promise<any> {
    try {
      const response = await this.api.post('/v2/shopping/flight-offers/prediction', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight choice prediction failed');
    }
  }

  async searchFlightInspiration(params: {
    origin: string;
    maxPrice?: number;
    departureDate?: string;
    oneWay?: boolean;
    duration?: string;
    nonStop?: boolean;
    viewBy?: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/shopping/flight-destinations', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight inspiration search failed');
    }
  }

  async searchCheapestFlightDates(params: {
    origin: string;
    destination: string;
    departureDate?: string;
    oneWay?: boolean;
    nonStop?: boolean;
    duration?: string;
    viewBy?: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/shopping/flight-dates', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Cheapest flight dates search failed');
    }
  }

  async searchFlightAvailabilities(params: any): Promise<any> {
    try {
      const response = await this.api.post('/v1/shopping/availability/flight-availabilities', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight availabilities search failed');
    }
  }

  async createFlightOrder(params: any): Promise<any> {
    try {
      const response = await this.api.post('/v1/booking/flight-orders', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight order creation failed');
    }
  }

  async getFlightOrder(orderId: string): Promise<any> {
    try {
      const response = await this.api.get(`/v1/booking/flight-orders/${orderId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight order retrieval failed');
    }
  }

  async deleteFlightOrder(orderId: string): Promise<any> {
    try {
      const response = await this.api.delete(`/v1/booking/flight-orders/${orderId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight order deletion failed');
    }
  }

  async getFlightSeatMap(params: {
    flightOfferId: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/shopping/seatmaps', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Seat map retrieval failed');
    }
  }

  async getBrandedFares(params: any): Promise<any> {
    try {
      const response = await this.api.post('/v1/shopping/flight-offers/upselling', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Branded fares retrieval failed');
    }
  }

  async getFlightStatus(params: {
    carrierCode: string;
    flightNumber: string;
    scheduledDepartureDate: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v2/schedule/flights', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight status retrieval failed');
    }
  }

  async predictFlightDelay(params: {
    originLocationCode: string;
    destinationLocationCode: string;
    departureDate: string;
    departureTime: string;
    arrivalDate: string;
    arrivalTime: string;
    aircraftCode: string;
    carrierCode: string;
    flightNumber: string;
    duration: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/travel/predictions/flight-delay', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight delay prediction failed');
    }
  }

  async getAirportOnTimePerformance(params: {
    airportCode: string;
    date: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/airport/predictions/on-time', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Airport on-time performance retrieval failed');
    }
  }

  async getNearestRelevantAirports(params: {
    latitude: number;
    longitude: number;
    radius?: number;
    page?: {
      limit?: number;
      offset?: number;
    };
    sort?: string;
  }): Promise<any> {
    try {
      const searchParams: any = {
        latitude: params.latitude,
        longitude: params.longitude,
      };
      
      if (params.radius) searchParams.radius = params.radius;
      if (params.page?.limit) searchParams['page[limit]'] = params.page.limit;
      if (params.page?.offset) searchParams['page[offset]'] = params.page.offset;
      if (params.sort) searchParams.sort = params.sort;
      
      const response = await this.api.get('/v1/reference-data/airports', { params: searchParams });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Nearest airports retrieval failed');
    }
  }

  async getAirportRoutes(params: {
    departureAirportCode: string;
    max?: number;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/airport/direct-destinations', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Airport routes retrieval failed');
    }
  }

  async getMostTraveledDestinations(params: {
    originCityCode: string;
    period: string;
    max?: number;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/travel/analytics/air-traffic/traveled', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Most traveled destinations retrieval failed');
    }
  }

  async getMostBookedDestinations(params: {
    originCityCode: string;
    period: string;
    max?: number;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/travel/analytics/air-traffic/booked', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Most booked destinations retrieval failed');
    }
  }

  async getBusiestTravelingPeriod(params: {
    cityCode: string;
    period: string;
    direction?: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/travel/analytics/air-traffic/busiest-period', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Busiest traveling period retrieval failed');
    }
  }

  async getFlightCheckinLinks(params: {
    airlineCode: string;
    language?: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v2/reference-data/urls/checkin-links', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight check-in links retrieval failed');
    }
  }

  async lookupAirlineCode(params: {
    airlineCodes?: string;
    IATACode?: string;
    ICAOCode?: string;
  }): Promise<any> {
    try {
      // Use cache wrapper for airline lookup (long TTL - 7 days)
      return await cacheService.cacheWrapper(
        'airlines',
        params,
        async () => {
          const response = await this.api.get('/v1/reference-data/airlines', { params });
          return response.data;
        }
      );
    } catch (error) {
      throw this.handleError(error, 'Airline code lookup failed');
    }
  }

  async getAirlineRoutes(params: {
    airlineCode: string;
    max?: number;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v1/airline/destinations', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Airline routes retrieval failed');
    }
  }

  async searchTransfers(params: {
    startLocationCode: string;
    endLocationCode: string;
    transferType: string;
    startDateTime: string;
    passengers: number;
    startConnectedSegment?: any;
    endConnectedSegment?: any;
  }): Promise<any> {
    try {
      const response = await this.api.post('/v1/shopping/transfer-offers', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Transfer search failed');
    }
  }

  async createTransferBooking(params: any): Promise<any> {
    try {
      const response = await this.api.post('/v1/ordering/transfer-orders', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Transfer booking creation failed');
    }
  }

  async getTransferOrder(orderId: string, params?: {
    lang?: string;
  }): Promise<any> {
    try {
      const response = await this.api.get(`/v1/ordering/transfer-orders/${orderId}`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Transfer order retrieval failed');
    }
  }

  async cancelTransferOrder(orderId: string, params?: {
    confirmNbr?: string;
  }): Promise<any> {
    try {
      const response = await this.api.delete(`/v1/ordering/transfer-orders/${orderId}`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Transfer order cancellation failed');
    }
  }

  async getHotelRatings(params: {
    hotelIds: string;
  }): Promise<any> {
    try {
      const response = await this.api.get('/v2/e-reputation/hotel-sentiments', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Hotel ratings retrieval failed');
    }
  }

  async searchHotelNames(params: {
    keyword: string;
    subType?: string;
    countryCode?: string;
    page?: {
      limit?: number;
      offset?: number;
    };
  }): Promise<any> {
    try {
      const searchParams: any = {
        keyword: params.keyword,
        subType: params.subType || 'HOTEL',
      };
      
      if (params.countryCode) searchParams.countryCode = params.countryCode;
      if (params.page?.limit) searchParams['page[limit]'] = params.page.limit;
      if (params.page?.offset) searchParams['page[offset]'] = params.page.offset;
      
      const response = await this.api.get('/v1/reference-data/locations/hotel', { params: searchParams });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Hotel name search failed');
    }
  }

  async createHotelBooking(params: any): Promise<any> {
    try {
      const response = await this.api.post('/v1/booking/hotel-bookings', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Hotel booking creation failed');
    }
  }

  async getHotelList(params: {
    cityCode?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    radiusUnit?: string;
    amenities?: string[];
    ratings?: string[];
    hotelSource?: string;
  }): Promise<any> {
    try {
      const searchParams: any = {};
      
      if (params.cityCode) {
        searchParams.cityCode = params.cityCode;
      } else if (params.latitude && params.longitude) {
        searchParams.latitude = params.latitude;
        searchParams.longitude = params.longitude;
      }
      
      if (params.radius) searchParams.radius = params.radius;
      if (params.radiusUnit) searchParams.radiusUnit = params.radiusUnit;
      if (params.amenities) searchParams.amenities = params.amenities.join(',');
      if (params.ratings) searchParams.ratings = params.ratings.join(',');
      if (params.hotelSource) searchParams.hotelSource = params.hotelSource;
      
      const response = await this.api.get('/v1/reference-data/locations/hotels/by-city', { params: searchParams });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Hotel list retrieval failed');
    }
  }

  async resolveLocationCode(locationInput: string): Promise<string> {
    try {
      // If it's already a 3-letter IATA code, return as-is
      if (/^[A-Z]{3}$/.test(locationInput.trim())) {
        return locationInput.trim().toUpperCase();
      }

      // Clean the input
      const cleanInput = this.cleanLocationKeyword(locationInput);

      // Try to search for airports first
      try {
        const airportResponse = await this.searchLocations({
          keyword: cleanInput,
          subType: 'AIRPORT'
        });

        if (airportResponse.data && airportResponse.data.length > 0) {
          const airport = airportResponse.data[0];
          if (airport.iataCode) {
            console.log(`Resolved "${locationInput}" to airport code: ${airport.iataCode}`);
            return airport.iataCode;
          }
        }
      } catch (airportError) {
        console.warn(`Airport search failed for "${cleanInput}":`, airportError);
      }

      // Try to search for cities
      try {
        const cityResponse = await this.searchLocations({
          keyword: cleanInput,
          subType: 'CITY'
        });

        if (cityResponse.data && cityResponse.data.length > 0) {
          const city = cityResponse.data[0];
          if (city.iataCode) {
            console.log(`Resolved "${locationInput}" to city code: ${city.iataCode}`);
            return city.iataCode;
          }
        }
      } catch (cityError) {
        console.warn(`City search failed for "${cleanInput}":`, cityError);
      }

      // Fallback to hardcoded mappings for common cities
      const cityMappings: Record<string, string> = {
        'nice': 'NCE',
        'cannes': 'NCE',
        'bangkok': 'BKK',
        'paris': 'CDG',
        'london': 'LHR',
        'new york': 'JFK',
        'tokyo': 'NRT',
        'dubai': 'DXB',
        'singapore': 'SIN',
        'hong kong': 'HKG',
        'sydney': 'SYD',
        'melbourne': 'MEL',
        'los angeles': 'LAX',
        'san francisco': 'SFO',
        'chicago': 'ORD',
        'miami': 'MIA',
        'toronto': 'YYZ',
        'vancouver': 'YVR',
        'amsterdam': 'AMS',
        'frankfurt': 'FRA',
        'munich': 'MUC',
        'zurich': 'ZUR',
        'vienna': 'VIE',
        'rome': 'FCO',
        'milan': 'MXP',
        'barcelona': 'BCN',
        'madrid': 'MAD',
        'lisbon': 'LIS',
        'stockholm': 'ARN',
        'copenhagen': 'CPH',
        'oslo': 'OSL',
        'helsinki': 'HEL',
        'moscow': 'SVO',
        'istanbul': 'IST',
        'cairo': 'CAI',
        'johannesburg': 'JNB',
        'cape town': 'CPT',
        'mumbai': 'BOM',
        'delhi': 'DEL',
        'bangalore': 'BLR',
        'seoul': 'ICN',
        'beijing': 'PEK',
        'shanghai': 'PVG',
        'taipei': 'TPE',
        'kuala lumpur': 'KUL',
        'jakarta': 'CGK',
        'manila': 'MNL',
        'ho chi minh': 'SGN',
        'hanoi': 'HAN'
      };

      const mappedCode = cityMappings[cleanInput.toLowerCase()];
      if (mappedCode) {
        console.log(`Resolved "${locationInput}" using fallback mapping: ${mappedCode}`);
        return mappedCode;
      }

      // If all else fails, return the original input (with warning)
      console.warn(`Could not resolve location code for "${locationInput}", using original input`);
      return locationInput.trim().toUpperCase();
    } catch (error) {
      console.error(`Error resolving location code for "${locationInput}":`, error);
      return locationInput.trim().toUpperCase();
    }
  }

  async getHotelImages(params: {
    hotelId: string;
  }): Promise<any> {
    try {
      const response = await this.api.get(`/v1/shopping/hotel-offers/${params.hotelId}/images`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get hotel images');
    }
  }

  async searchAirports(params: { keyword: string; subType?: string }): Promise<any> {
    try {
      const searchParams = {
        keyword: params.keyword,
        subType: 'AIRPORT',
        'page[limit]': 10
      };

      // Use cache wrapper for airport search (long TTL - 24 hours)
      return await cacheService.cacheWrapper(
        'airports',
        searchParams,
        async () => {
          const response = await this.api.get('/v1/reference-data/locations', {
            params: searchParams
          });
          return response.data;
        }
      );
    } catch (error) {
      throw this.handleError(error, 'Airport search failed');
    }
  }

  async getFlightPriceAnalysis(params: {
    originIataCode: string;
    destinationIataCode: string;
    departureDate: string;
    currencyCode?: string;
  }): Promise<any> {
    return this.analyzeFlightPrices(params);
  }

  async getFlightChoicePrediction(flightOffers: any): Promise<any> {
    return this.predictFlightChoice(flightOffers);
  }

  async getFlightOffersPrice(flightOffers: any): Promise<any> {
    try {
      const response = await this.api.post('/v1/shopping/flight-offers/pricing', {
        data: {
          type: 'flight-offers-pricing',
          flightOffers: Array.isArray(flightOffers) ? flightOffers : [flightOffers]
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Flight offers pricing failed');
    }
  }
}

export default new AmadeusService();
