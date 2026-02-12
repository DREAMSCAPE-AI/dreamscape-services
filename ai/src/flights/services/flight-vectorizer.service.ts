/**
 * Flight Vectorizer Service
 *
 * Transforms raw flight features into 8-dimensional feature vectors
 * compatible with UserVector for cosine similarity calculation.
 *
 * ## 🔍 WHAT IT DOES
 * This service takes unstructured flight data from Amadeus API and converts it
 * into normalized 8D vectors that can be compared with user preference vectors.
 *
 * ## 💡 WHY WE NEED IT
 * To personalize flight recommendations, we must represent flights in the
 * same dimensional space as user preferences. This allows us to calculate
 * similarity scores using cosine similarity.
 *
 * ## ⚙️ HOW IT WORKS
 * 1. Parse flight characteristics (class, route, airline, stops, etc.)
 * 2. Calculate dimension scores based on flight features
 * 3. Normalize each dimension to [0-1] range
 * 4. Apply configurable weights for fine-tuning
 *
 * @module flights/services
 * @ticket US-IA-004-bis.1
 */

import {
  FlightVector,
  FlightFeatures,
  FlightVectorizationConfig,
  DEFAULT_FLIGHT_VECTORIZATION_CONFIG,
  FlightClass,
  FlightType,
  AirlineAlliance,
  BatchFlightVectorizationResult,
} from '../types/flight-vector.types';

/**
 * FlightVectorizerService
 *
 * Core service for flight feature extraction and vectorization.
 */
export class FlightVectorizerService {
  private config: FlightVectorizationConfig;

  constructor(config?: Partial<FlightVectorizationConfig>) {
    this.config = {
      ...DEFAULT_FLIGHT_VECTORIZATION_CONFIG,
      ...config,
    };
  }

  /**
   * Vectorize a single flight
   *
   * Main entry point for transforming flight features into a vector.
   *
   * @param features - Structured flight features
   * @returns 8D feature vector normalized to [0-1]
   */
  vectorize(features: FlightFeatures): FlightVector {
    return [
      this.calculateClimateDimension(features),
      this.calculateCultureNatureDimension(features),
      this.calculateBudgetDimension(features),
      this.calculateActivityLevelDimension(features),
      this.calculateGroupSizeDimension(features),
      this.calculateUrbanRuralDimension(features),
      this.calculateGastronomyDimension(features),
      this.calculatePopularityDimension(features),
    ];
  }

  /**
   * Vectorize flight from raw Amadeus data
   *
   * Convenience method that handles data transformation from Amadeus format.
   *
   * @param amadeusFlight - Raw flight object from Amadeus API
   * @returns 8D feature vector
   */
  vectorizeFromAmadeus(amadeusFlight: any): FlightVector {
    const features = this.transformAmadeusToFeatures(amadeusFlight);
    return this.vectorize(features);
  }

  /**
   * Batch vectorize multiple flights
   *
   * Optimized for processing search results (50-200 flights).
   * Calculates market average dynamically for budget normalization.
   *
   * @param flights - Array of flight features
   * @returns Map of flightId to vector, with metadata
   */
  batchVectorize(flights: FlightFeatures[]): BatchFlightVectorizationResult {
    const startTime = Date.now();
    const vectors = new Map<string, FlightVector>();
    const errors: Array<{ flightId: string; error: string }> = [];

    // Calculate market average price for this batch
    const prices = flights
      .map(flight => flight.price.amount)
      .filter(p => p > 0);

    const marketAverage = prices.length > 0
      ? prices.reduce((sum, p) => sum + p, 0) / prices.length
      : this.config.budget.marketAveragePrice;

    // Update config for this batch
    const originalAverage = this.config.budget.marketAveragePrice;
    this.config.budget.marketAveragePrice = marketAverage;

    // Vectorize each flight
    for (const flight of flights) {
      try {
        const vector = this.vectorize(flight);
        vectors.set(flight.flightId, vector);
      } catch (error) {
        errors.push({
          flightId: flight.flightId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Restore original config
    this.config.budget.marketAveragePrice = originalAverage;

    return {
      vectors,
      processingTime: Date.now() - startTime,
      itemsProcessed: vectors.size,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Transform Amadeus flight data to FlightFeatures
   *
   * Handles various Amadeus API response formats.
   *
   * @param amadeusFlight - Raw Amadeus flight object
   * @returns Structured flight features
   */
  private transformAmadeusToFeatures(amadeusFlight: any): FlightFeatures {
    const flight = amadeusFlight;

    // Parse airline info
    const airlineCode = flight.validatingAirlineCodes?.[0] || flight.carrier || '';
    const airline = {
      code: airlineCode,
      name: this.getAirlineName(airlineCode),
      alliance: this.getAirlineAlliance(airlineCode),
      rating: flight.airline?.rating || this.getAirlineRating(airlineCode),
      isLowCost: this.isLowCostCarrier(airlineCode),
    };

    // Parse route
    const segments = flight.itineraries?.[0]?.segments || [];
    const firstSegment = segments[0] || {};
    const lastSegment = segments[segments.length - 1] || {};

    const route = {
      origin: {
        airportCode: firstSegment.departure?.iataCode || '',
        airportName: firstSegment.departure?.airport || '',
        cityCode: firstSegment.departure?.cityCode || '',
        cityName: firstSegment.departure?.city || '',
        countryCode: firstSegment.departure?.countryCode || '',
        terminal: firstSegment.departure?.terminal,
      },
      destination: {
        airportCode: lastSegment.arrival?.iataCode || '',
        airportName: lastSegment.arrival?.airport || '',
        cityCode: lastSegment.arrival?.cityCode || '',
        cityName: lastSegment.arrival?.city || '',
        countryCode: lastSegment.arrival?.countryCode || '',
        terminal: lastSegment.arrival?.terminal,
      },
      distance: flight.distance || this.calculateDistance(
        firstSegment.departure?.coordinates,
        lastSegment.arrival?.coordinates
      ),
    };

    // Parse flight class
    const travelerPricing = flight.travelerPricings?.[0] || {};
    const fareClass = travelerPricing.fareDetailsBySegment?.[0]?.cabin || 'ECONOMY';
    const flightClass = this.parseFlightClass(fareClass);

    // Parse stops
    const numberOfStops = segments.length - 1;
    const flightType = this.parseFlightType(numberOfStops);

    // Parse segments
    const parsedSegments = segments.map((seg: any) => ({
      departure: {
        airportCode: seg.departure?.iataCode || '',
        dateTime: seg.departure?.at || '',
        terminal: seg.departure?.terminal,
      },
      arrival: {
        airportCode: seg.arrival?.iataCode || '',
        dateTime: seg.arrival?.at || '',
        terminal: seg.arrival?.terminal,
      },
      airline: seg.carrierCode || '',
      flightNumber: seg.number || '',
      aircraft: seg.aircraft?.code,
      duration: seg.duration || '',
    }));

    // Parse timing
    const totalDuration = this.parseDuration(flight.itineraries?.[0]?.duration || '');
    const layoverTime = this.calculateLayoverTime(parsedSegments);

    const schedule = {
      departureTime: firstSegment.departure?.at || '',
      arrivalTime: lastSegment.arrival?.at || '',
      isOvernight: this.isOvernightFlight(firstSegment.departure?.at, lastSegment.arrival?.at),
      isRedEye: this.isRedEyeFlight(firstSegment.departure?.at),
      timeOfDay: this.getTimeOfDay(firstSegment.departure?.at),
    };

    const duration = {
      total: totalDuration,
      flight: totalDuration - layoverTime,
      layover: layoverTime,
    };

    // Parse pricing
    const price = {
      amount: parseFloat(flight.price?.total || flight.price || 0),
      currency: flight.price?.currency || 'EUR',
      perPerson: true,
      taxesIncluded: true,
      fareType: travelerPricing.fareOption || 'PUBLISHED',
    };

    // Parse amenities
    const amenities = {
      wifi: flight.amenities?.wifi || false,
      power: flight.amenities?.power || false,
      entertainment: flight.amenities?.entertainment || false,
      meals: this.calculateMeals(duration.total, flightClass),
      baggage: {
        cabin: {
          allowed: true,
          quantity: travelerPricing.fareDetailsBySegment?.[0]?.includedCheckedBags?.quantity || 1,
          weight: travelerPricing.fareDetailsBySegment?.[0]?.includedCheckedBags?.weight || 10,
        },
        checked: {
          quantity: travelerPricing.fareDetailsBySegment?.[0]?.includedCheckedBags?.quantity || 1,
          weight: travelerPricing.fareDetailsBySegment?.[0]?.includedCheckedBags?.weight || 23,
        },
      },
    };

    // Parse booking info
    const bookingInfo = {
      seatsAvailable: flight.numberOfBookableSeats || 9,
      instantTicketing: flight.instantTicketingRequired || false,
      refundable: travelerPricing.fareDetailsBySegment?.[0]?.isRefundable || false,
      changeable: travelerPricing.fareDetailsBySegment?.[0]?.isChangeable || false,
      lastTicketingDate: flight.lastTicketingDate,
    };

    // Parse popularity
    const popularity = {
      routePopularity: this.getRoutePopularity(route.origin.airportCode, route.destination.airportCode),
      airlineRating: airline.rating || 3.5,
      onTimePerformance: this.getOnTimePerformance(airlineCode),
      reviewCount: 0, // Not typically provided by Amadeus
    };

    // Metadata
    const metadata = {
      codeshare: flight.isCodeshare || false,
      operatedBy: flight.operatedBy,
      cabinUpgradeAvailable: flight.cabinUpgradeAvailable || false,
      tags: this.generateFlightTags(flight, flightType, price.amount),
    };

    return {
      flightId: flight.id || `flight-${Date.now()}`,
      offerReference: flight.offerReference || flight.id,
      airline,
      route,
      flightClass,
      flightType,
      numberOfStops,
      segments: parsedSegments,
      duration,
      schedule,
      price,
      amenities,
      bookingInfo,
      popularity,
      metadata,
    };
  }

  // ============================================================================
  // DIMENSION CALCULATORS
  // ============================================================================

  /**
   * Dimension 0: Climate
   *
   * Measures destination climate preference (cold → tropical).
   * Based on destination location and season.
   *
   * @param features - Flight features
   * @returns Normalized score [0-1]
   */
  private calculateClimateDimension(features: FlightFeatures): number {
    // Approximate climate based on destination country/latitude
    const destCountry = features.route.destination.countryCode;

    // Tropical/warm destinations (0.7-1.0)
    const tropicalCountries = ['TH', 'ID', 'MY', 'SG', 'PH', 'MX', 'BR', 'CR', 'CU', 'DO'];

    // Mediterranean/temperate (0.4-0.7)
    const temperateCountries = ['ES', 'IT', 'FR', 'PT', 'GR', 'US', 'AU', 'JP', 'NZ'];

    // Cold destinations (0.0-0.4)
    const coldCountries = ['IS', 'NO', 'SE', 'FI', 'CA', 'RU', 'GL'];

    if (tropicalCountries.includes(destCountry)) {
      return 0.85;
    } else if (temperateCountries.includes(destCountry)) {
      return 0.55;
    } else if (coldCountries.includes(destCountry)) {
      return 0.15;
    } else {
      return 0.5; // Default moderate climate
    }
  }

  /**
   * Dimension 1: Culture vs Nature
   *
   * Measures whether destination is culture-oriented or nature-oriented.
   *
   * Scale: 0 = Pure nature, 0.5 = Mixed, 1 = Pure culture
   *
   * @param features - Flight features
   * @returns Normalized score [0-1]
   */
  private calculateCultureNatureDimension(features: FlightFeatures): number {
    const destCity = features.route.destination.cityCode;
    const destCountry = features.route.destination.countryCode;

    // Cultural capitals and major cities (0.8-1.0)
    const culturalCities = ['PAR', 'ROM', 'LON', 'MAD', 'BCN', 'VIE', 'PRA', 'BER', 'NYC', 'TYO', 'BKK'];

    // Nature/adventure destinations (0.0-0.2)
    const natureCities = ['KEF', 'QTW', 'PPT', 'DPS', 'CNS', 'JRO', 'USH'];

    // Beach/resort destinations (0.2-0.4)
    const beachDestinations = ['CUN', 'PUJ', 'HKT', 'MLE', 'NAN'];

    if (culturalCities.includes(destCity)) {
      return 0.9;
    } else if (natureCities.includes(destCity)) {
      return 0.1;
    } else if (beachDestinations.includes(destCity)) {
      return 0.3;
    } else {
      return 0.5; // Mixed or unknown
    }
  }

  /**
   * Dimension 2: Budget
   *
   * Measures relative price level based on cabin class and price.
   *
   * Scale: 0 = Budget economy, 1 = Luxury first class
   *
   * @param features - Flight features
   * @returns Normalized score [0-1]
   */
  private calculateBudgetDimension(features: FlightFeatures): number {
    const { flightClass, price } = features;
    const marketAverage = this.config.budget.marketAveragePrice;

    // Base score from cabin class
    let classScore = 0;
    switch (flightClass) {
      case FlightClass.ECONOMY:
        classScore = 0.2;
        break;
      case FlightClass.PREMIUM_ECONOMY:
        classScore = 0.45;
        break;
      case FlightClass.BUSINESS:
        classScore = 0.75;
        break;
      case FlightClass.FIRST_CLASS:
        classScore = 0.95;
        break;
    }

    // Adjust by price relative to market average
    const priceRatio = price.amount / marketAverage;
    let priceScore = 0;

    if (priceRatio < 0.5) {
      priceScore = 0.1;
    } else if (priceRatio < 1.0) {
      priceScore = 0.3;
    } else if (priceRatio < 1.5) {
      priceScore = 0.5;
    } else if (priceRatio < 2.5) {
      priceScore = 0.7;
    } else {
      priceScore = 0.9;
    }

    // Weighted combination: 70% class, 30% price
    return classScore * 0.7 + priceScore * 0.3;
  }

  /**
   * Dimension 3: Activity Level
   *
   * Measures travel style: relaxed/direct vs adventurous/connections.
   *
   * Scale: 0 = Relaxed (direct), 1 = Adventurous (connections ok)
   *
   * @param features - Flight features
   * @returns Normalized score [0-1]
   */
  private calculateActivityLevelDimension(features: FlightFeatures): number {
    const config = this.config.activityLevel;
    let score = 0;

    // Direct flights = relaxed travel style
    if (features.flightType === FlightType.DIRECT) {
      score = config.directFlightScore;
    } else if (features.flightType === FlightType.ONE_STOP) {
      score = 1.0 - config.oneStopPenalty;
    } else {
      score = 1.0 - config.multiStopPenalty;
    }

    // Efficient layovers bonus (adventurous but efficient)
    if (features.duration.layover > 0 && features.duration.layover < 180) {
      score += config.shortLayoverBonus;
    }

    // Long flights suggest higher activity level (adventurous travelers)
    if (features.duration.total > 600) {
      score += 0.1;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Dimension 4: Group Size
   *
   * Measures suitability for different group sizes.
   * Based on airline family-friendliness and booking capacity.
   *
   * Scale: 0 = Solo, 1 = Large groups
   *
   * @param features - Flight features
   * @returns Normalized score [0-1]
   */
  private calculateGroupSizeDimension(features: FlightFeatures): number {
    let score = 0.5; // Default suitable for small groups

    // More seats available = better for groups
    const seatsAvailable = features.bookingInfo.seatsAvailable;
    if (seatsAvailable >= 9) {
      score += 0.2;
    } else if (seatsAvailable >= 4) {
      score += 0.1;
    }

    // Family-friendly airlines
    const familyAirlines = ['BA', 'LH', 'AF', 'EK', 'SQ', 'QR'];
    if (familyAirlines.includes(features.airline.code)) {
      score += 0.15;
    }

    // Economy class better for groups (cost)
    if (features.flightClass === FlightClass.ECONOMY) {
      score += 0.15;
    }

    return Math.min(1.0, score);
  }

  /**
   * Dimension 5: Urban vs Rural
   *
   * Measures destination urbanism level.
   *
   * Scale: 0 = Rural, 1 = Urban
   *
   * @param features - Flight features
   * @returns Normalized score [0-1]
   */
  private calculateUrbanRuralDimension(features: FlightFeatures): number {
    const destCity = features.route.destination.cityCode;

    // Major urban centers
    const majorCities = ['NYC', 'LON', 'PAR', 'TYO', 'HKG', 'SIN', 'DXB', 'FRA', 'AMS', 'SYD'];

    // Secondary cities
    const secondaryCities = ['BCN', 'ROM', 'MAD', 'BER', 'MUC', 'ZRH', 'CPH', 'VIE'];

    // Rural/nature destinations
    const ruralDestinations = ['KEF', 'QTW', 'JRO', 'USH', 'IQQ'];

    if (majorCities.includes(destCity)) {
      return 1.0;
    } else if (secondaryCities.includes(destCity)) {
      return 0.75;
    } else if (ruralDestinations.includes(destCity)) {
      return 0.1;
    } else {
      return 0.5;
    }
  }

  /**
   * Dimension 6: Gastronomy
   *
   * Measures destination culinary reputation.
   * Less relevant for flights themselves, more for destination scoring.
   *
   * @param features - Flight features
   * @returns Normalized score [0-1]
   */
  private calculateGastronomyDimension(features: FlightFeatures): number {
    const destCountry = features.route.destination.countryCode;
    const destCity = features.route.destination.cityCode;

    // Culinary hotspots
    const culinaryDestinations = ['FR', 'IT', 'JP', 'ES', 'TH', 'MX', 'PE', 'VN'];
    const culinaryCities = ['PAR', 'TYO', 'ROM', 'BCN', 'BKK', 'LIM', 'HAN'];

    if (culinaryCities.includes(destCity)) {
      return 0.95;
    } else if (culinaryDestinations.includes(destCountry)) {
      return 0.8;
    } else {
      return 0.5; // Neutral
    }
  }

  /**
   * Dimension 7: Popularity
   *
   * Measures airline quality + route popularity + on-time performance.
   *
   * @param features - Flight features
   * @returns Normalized score [0-1]
   */
  private calculatePopularityDimension(features: FlightFeatures): number {
    const weights = this.config.popularity;
    let score = 0;

    // Airline rating (0-5 scale)
    const normalizedRating = features.popularity.airlineRating / 5;
    score += weights.airlineRatingWeight * normalizedRating;

    // Route popularity
    score += weights.routePopularityWeight * features.popularity.routePopularity;

    // On-time performance
    score += weights.onTimeWeight * features.popularity.onTimePerformance;

    // Alliance membership bonus
    if (features.airline.alliance !== AirlineAlliance.NONE) {
      score += 0.05;
    }

    // Instant ticketing bonus (convenience)
    if (features.bookingInfo.instantTicketing) {
      score += 0.05;
    }

    const maxScore = Object.values(weights).reduce((sum, w) => sum + w, 0) + 0.1; // +0.1 for bonuses
    return Math.min(1.0, score / maxScore);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Parse flight class from cabin string
   */
  private parseFlightClass(cabin: string): FlightClass {
    const normalized = cabin.toUpperCase();

    if (normalized.includes('FIRST')) return FlightClass.FIRST_CLASS;
    if (normalized.includes('BUSINESS')) return FlightClass.BUSINESS;
    if (normalized.includes('PREMIUM')) return FlightClass.PREMIUM_ECONOMY;
    return FlightClass.ECONOMY;
  }

  /**
   * Parse flight type from number of stops
   */
  private parseFlightType(stops: number): FlightType {
    if (stops === 0) return FlightType.DIRECT;
    if (stops === 1) return FlightType.ONE_STOP;
    return FlightType.TWO_PLUS_STOPS;
  }

  /**
   * Parse duration from ISO 8601 format
   */
  private parseDuration(durationString: string): number {
    if (!durationString) return 0;

    // Format: PT12H30M
    const match = durationString.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);

    return hours * 60 + minutes;
  }

  /**
   * Calculate total layover time
   */
  private calculateLayoverTime(segments: any[]): number {
    if (segments.length <= 1) return 0;

    let totalLayover = 0;
    for (let i = 0; i < segments.length - 1; i++) {
      const arrivalTime = new Date(segments[i].arrival.dateTime).getTime();
      const departureTime = new Date(segments[i + 1].departure.dateTime).getTime();
      totalLayover += (departureTime - arrivalTime) / (1000 * 60); // minutes
    }

    return totalLayover;
  }

  /**
   * Check if flight is overnight
   */
  private isOvernightFlight(departureTime: string, arrivalTime: string): boolean {
    const departure = new Date(departureTime);
    const arrival = new Date(arrivalTime);
    return arrival.getDate() !== departure.getDate();
  }

  /**
   * Check if flight is red-eye
   */
  private isRedEyeFlight(departureTime: string): boolean {
    const departure = new Date(departureTime);
    const hour = departure.getHours();
    return hour >= 22 || hour < 6;
  }

  /**
   * Get time of day for departure
   */
  private getTimeOfDay(departureTime: string): 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' {
    const departure = new Date(departureTime);
    const hour = departure.getHours();

    if (hour >= 6 && hour < 12) return 'MORNING';
    if (hour >= 12 && hour < 18) return 'AFTERNOON';
    if (hour >= 18 && hour < 22) return 'EVENING';
    return 'NIGHT';
  }

  /**
   * Calculate meals based on duration and class
   */
  private calculateMeals(durationMinutes: number, flightClass: FlightClass): number {
    if (flightClass === FlightClass.FIRST_CLASS || flightClass === FlightClass.BUSINESS) {
      if (durationMinutes > 360) return 2;
      if (durationMinutes > 180) return 1;
    } else if (flightClass === FlightClass.PREMIUM_ECONOMY) {
      if (durationMinutes > 240) return 1;
    } else {
      if (durationMinutes > 300) return 1;
    }
    return 0;
  }

  /**
   * Get airline name from code
   */
  private getAirlineName(code: string): string {
    const airlines: Record<string, string> = {
      'AF': 'Air France',
      'BA': 'British Airways',
      'LH': 'Lufthansa',
      'EK': 'Emirates',
      'SQ': 'Singapore Airlines',
      'QR': 'Qatar Airways',
      'AA': 'American Airlines',
      'UA': 'United Airlines',
      'DL': 'Delta Air Lines',
      'KL': 'KLM',
      'IB': 'Iberia',
      'AZ': 'ITA Airways',
      'VS': 'Virgin Atlantic',
      'TK': 'Turkish Airlines',
      'NH': 'ANA',
    };
    return airlines[code] || code;
  }

  /**
   * Get airline alliance
   */
  private getAirlineAlliance(code: string): AirlineAlliance {
    const starAlliance = ['LH', 'UA', 'SQ', 'NH', 'AC', 'TK', 'TG', 'LO', 'OS', 'SN'];
    const oneworld = ['AA', 'BA', 'IB', 'QR', 'QF', 'CX', 'AY', 'JL', 'LA'];
    const skyteam = ['AF', 'KL', 'DL', 'AZ', 'SU', 'AM', 'CI', 'CZ', 'KE', 'ME'];

    if (starAlliance.includes(code)) return AirlineAlliance.STAR_ALLIANCE;
    if (oneworld.includes(code)) return AirlineAlliance.ONEWORLD;
    if (skyteam.includes(code)) return AirlineAlliance.SKYTEAM;
    return AirlineAlliance.NONE;
  }

  /**
   * Get airline rating
   */
  private getAirlineRating(code: string): number {
    const ratings: Record<string, number> = {
      'SQ': 5.0,
      'QR': 5.0,
      'EK': 4.8,
      'NH': 4.7,
      'LH': 4.5,
      'AF': 4.3,
      'BA': 4.2,
      'KL': 4.2,
      'TK': 4.0,
      'AA': 3.8,
      'UA': 3.7,
      'DL': 3.9,
    };
    return ratings[code] || 3.5;
  }

  /**
   * Check if low-cost carrier
   */
  private isLowCostCarrier(code: string): boolean {
    const lowCostCarriers = ['FR', 'U2', 'W6', 'NK', 'F9', 'G4', 'VY', 'TP'];
    return lowCostCarriers.includes(code);
  }

  /**
   * Get route popularity (0-1)
   */
  private getRoutePopularity(origin: string, destination: string): number {
    // Popular routes get higher scores
    const popularRoutes = [
      'JFK-LHR', 'LAX-TYO', 'LHR-DXB', 'SIN-SYD', 'CDG-JFK',
      'FRA-JFK', 'LHR-JFK', 'AMS-JFK', 'MUC-JFK', 'ZRH-JFK',
    ];

    const route = `${origin}-${destination}`;
    const reverseRoute = `${destination}-${origin}`;

    if (popularRoutes.includes(route) || popularRoutes.includes(reverseRoute)) {
      return 0.9;
    }

    // Major hub airports get moderate popularity
    const majorHubs = ['JFK', 'LHR', 'CDG', 'FRA', 'AMS', 'DXB', 'SIN', 'HKG', 'TYO'];
    if (majorHubs.includes(origin) && majorHubs.includes(destination)) {
      return 0.7;
    }

    return 0.5; // Default
  }

  /**
   * Get on-time performance (0-1)
   */
  private getOnTimePerformance(airlineCode: string): number {
    const performance: Record<string, number> = {
      'SQ': 0.92,
      'NH': 0.90,
      'QR': 0.88,
      'LH': 0.85,
      'EK': 0.83,
      'KL': 0.82,
      'AF': 0.80,
      'BA': 0.78,
      'DL': 0.82,
      'AA': 0.75,
      'UA': 0.73,
    };
    return performance[airlineCode] || 0.75;
  }

  /**
   * Calculate distance between coordinates
   */
  private calculateDistance(coord1: any, coord2: any): number {
    if (!coord1 || !coord2) return 0;

    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(coord2.latitude - coord1.latitude);
    const dLon = this.toRad(coord2.longitude - coord1.longitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(coord1.latitude)) * Math.cos(this.toRad(coord2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  /**
   * Generate flight tags
   */
  private generateFlightTags(flight: any, flightType: FlightType, price: number): string[] {
    const tags: string[] = [];

    if (flightType === FlightType.DIRECT) {
      tags.push('direct');
    }

    if (price < 200) {
      tags.push('budget-friendly');
    } else if (price > 1000) {
      tags.push('premium');
    }

    return tags;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FlightVectorizationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): FlightVectorizationConfig {
    return { ...this.config };
  }
}

export default FlightVectorizerService;
