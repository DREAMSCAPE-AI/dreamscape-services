export class ActivityMapper {
  private static DEBUG_MODE = false; // Set to true to enable detailed logging
  private static loggedActivitiesCount = 0;
  private static MAX_LOGS = 3; // Only log first 3 activities to avoid console spam

  static mapAmadeusToSimplified(amadeusActivities: any[], searchLocationName?: string): any[] {
    // Reset log counter for new batch
    this.loggedActivitiesCount = 0;
    return amadeusActivities.map(activity => this.mapSingleActivity(activity, searchLocationName));
  }

  static mapSingleActivity(activity: any, searchLocationName?: string): any {
    const price = activity.price || {};
    const geoCode = activity.geoCode || {};
    const pictures = activity.pictures || [];

    const shouldLog = this.DEBUG_MODE && this.loggedActivitiesCount < this.MAX_LOGS;

    // 🔍 DEBUG: Log activity fields related to location (only first few activities)
    if (shouldLog) {
      console.log('🗺️ [ActivityMapper] Mapping activity:', activity.name);
      console.log('📍 [ActivityMapper] Available location fields:', {
        geoCode: geoCode,
        locationName: activity.locationName,
        city: activity.city,
        destination: activity.destination,
        address: activity.address,
        country: activity.country
      });
      this.loggedActivitiesCount++;
    }

    // Try to extract location name from various possible fields
    let locationName = 'Location not specified';

    // Priority order for location name:
    // 1. activity.locationName
    // 2. activity.city
    // 3. activity.destination
    // 4. searchLocationName (from query parameters)
    // 5. Reverse geocode coordinates or use city name from coordinates
    // 6. Fallback to coordinates string
    if (activity.locationName) {
      locationName = activity.locationName;
      if (shouldLog) console.log('✅ [ActivityMapper] Using locationName:', locationName);
    } else if (activity.city) {
      locationName = activity.city;
      if (shouldLog) console.log('✅ [ActivityMapper] Using city:', locationName);
    } else if (activity.destination) {
      locationName = activity.destination;
      if (shouldLog) console.log('✅ [ActivityMapper] Using destination:', locationName);
    } else if (searchLocationName) {
      locationName = searchLocationName;
      if (shouldLog) console.log('✅ [ActivityMapper] Using searchLocationName from context:', locationName);
    } else if (geoCode.latitude && geoCode.longitude) {
      // Try to get city name from known coordinates
      locationName = this.getCityNameFromCoordinates(geoCode.latitude, geoCode.longitude)
        || `${geoCode.latitude.toFixed(4)}, ${geoCode.longitude.toFixed(4)}`;
      if (shouldLog) console.log('⚠️ [ActivityMapper] Using coordinates/city lookup as fallback:', locationName);
    }

    return {
      id: activity.id || activity.self?.split('/').pop() || '',
      name: activity.name || 'Unnamed Activity',
      description: activity.description || activity.shortDescription || '',
      shortDescription: activity.shortDescription || activity.description?.substring(0, 150) + '...' || '',
      location: {
        name: locationName,
        address: this.formatAddress(geoCode),
        coordinates: geoCode.latitude && geoCode.longitude ? {
          latitude: parseFloat(geoCode.latitude),
          longitude: parseFloat(geoCode.longitude)
        } : undefined
      },
      rating: this.parseRating(activity.rating),
      reviewCount: this.parseReviewCount(activity.rating),
      duration: this.parseDuration(activity),
      groupSize: this.parseGroupSize(activity),
      price: {
        amount: parseFloat(price.amount || '0'),
        currency: price.currencyCode || 'EUR',
        formatted: this.formatPrice(price)
      },
      images: pictures.map((pic: any) => pic.url || pic).filter(Boolean),
      category: this.mapCategory(activity),
      tags: this.extractTags(activity),
      highlights: this.extractHighlights(activity),
      includes: this.extractIncludes(activity),
      excludes: this.extractExcludes(activity),
      meetingPoint: this.extractMeetingPoint(activity),
      languages: this.extractLanguages(activity),
      difficulty: this.extractDifficulty(activity),
      ageRestriction: this.extractAgeRestriction(activity),
      availability: {
        available: true,
        nextAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        schedule: ['09:00', '11:00', '14:00', '16:00']
      },
      bookingInfo: {
        instantConfirmation: true,
        freeCancellation: activity.cancellationPolicy?.includes('free') || false,
        cancellationPolicy: activity.cancellationPolicy || 'Free cancellation up to 24 hours before',
        voucherInfo: 'Mobile voucher accepted'
      },
      reviews: []
    };
  }

  private static formatAddress(geoCode: any): string {
    if (!geoCode) return 'Address not available';
    return geoCode.address || 'Address not available';
  }

  private static parseRating(rating: any): number {
    if (!rating) return 4.0 + Math.random() * 1.0;
    if (typeof rating === 'number') return rating;
    if (typeof rating === 'string') return parseFloat(rating) || 4.5;
    if (rating.overall) return parseFloat(rating.overall) || 4.5;
    return 4.0 + Math.random() * 1.0;
  }

  private static parseReviewCount(rating: any): number {
    if (!rating) return Math.floor(Math.random() * 500) + 50;
    if (rating.count) return parseInt(rating.count);
    return Math.floor(Math.random() * 500) + 50;
  }

  private static parseDuration(activity: any): string {
    if (activity.duration) return activity.duration;
    if (activity.durationRange) {
      return `${activity.durationRange.min || 1}-${activity.durationRange.max || 3} hours`;
    }
    return '2-3 hours';
  }

  private static parseGroupSize(activity: any): string {
    if (activity.groupSize) return activity.groupSize;
    if (activity.maximumNumberOfPeople) {
      return `Up to ${activity.maximumNumberOfPeople} people`;
    }
    return 'Up to 20 people';
  }

  private static formatPrice(price: any): string {
    if (!price || !price.amount) return '$0';
    const amount = parseFloat(price.amount);
    const currency = price.currencyCode || 'EUR';
    
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥'
    };
    
    const symbol = symbols[currency] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  }

  private static mapCategory(activity: any): string {
    const type = activity.type || activity.category || '';
    const typeUpper = type.toUpperCase();
    
    const categoryMap: { [key: string]: string } = {
      'SIGHTSEEING': 'SIGHTSEEING',
      'ATTRACTION': 'ATTRACTION',
      'TOUR': 'TOUR',
      'MUSEUM': 'MUSEUM',
      'ENTERTAINMENT': 'ENTERTAINMENT',
      'ADVENTURE': 'ADVENTURE',
      'CULTURAL': 'CULTURAL',
      'FOOD': 'FOOD_AND_DRINK',
      'NATURE': 'NATURE',
      'WELLNESS': 'WELLNESS'
    };

    for (const [key, value] of Object.entries(categoryMap)) {
      if (typeUpper.includes(key)) return value;
    }

    return 'TOUR';
  }

  private static extractTags(activity: any): string[] {
    const tags: string[] = [];
    
    if (activity.tags) {
      return Array.isArray(activity.tags) ? activity.tags : [activity.tags];
    }

    const category = this.mapCategory(activity);
    const categoryTags: { [key: string]: string[] } = {
      'SIGHTSEEING': ['Guided Tour', 'Photography', 'Walking'],
      'ATTRACTION': ['Must-See', 'Popular', 'Family-Friendly'],
      'TOUR': ['Expert Guide', 'Small Group', 'Historical'],
      'MUSEUM': ['Art', 'History', 'Educational'],
      'ENTERTAINMENT': ['Fun', 'Evening', 'Live Show'],
      'ADVENTURE': ['Outdoor', 'Active', 'Thrilling'],
      'CULTURAL': ['Traditional', 'Local Experience', 'Authentic'],
      'FOOD_AND_DRINK': ['Tasting', 'Local Cuisine', 'Culinary'],
      'NATURE': ['Scenic', 'Wildlife', 'Outdoor'],
      'WELLNESS': ['Relaxing', 'Spa', 'Meditation']
    };

    return categoryTags[category] || ['Experience', 'Popular'];
  }

  private static extractHighlights(activity: any): string[] {
    if (activity.highlights && Array.isArray(activity.highlights)) {
      return activity.highlights;
    }
    if (activity.description) {
      return [activity.description.substring(0, 100) + '...'];
    }
    return ['Unique experience', 'Expert local guide', 'Small group tour'];
  }

  private static extractIncludes(activity: any): string[] {
    if (activity.includedServices && Array.isArray(activity.includedServices)) {
      return activity.includedServices;
    }
    if (activity.includes && Array.isArray(activity.includes)) {
      return activity.includes;
    }
    return ['Professional guide', 'All necessary equipment'];
  }

  private static extractExcludes(activity: any): string[] {
    if (activity.excludedServices && Array.isArray(activity.excludedServices)) {
      return activity.excludedServices;
    }
    if (activity.excludes && Array.isArray(activity.excludes)) {
      return activity.excludes;
    }
    return ['Hotel pickup', 'Food and drinks', 'Gratuities'];
  }

  private static extractMeetingPoint(activity: any): string {
    if (activity.meetingPoint) return activity.meetingPoint;
    if (activity.geoCode?.address) return activity.geoCode.address;
    return 'Meeting point will be confirmed upon booking';
  }

  private static extractLanguages(activity: any): string[] {
    if (activity.languages && Array.isArray(activity.languages)) {
      return activity.languages;
    }
    return ['English'];
  }

  private static extractDifficulty(activity: any): string {
    if (activity.difficulty) return activity.difficulty;
    if (activity.difficultyLevel) return activity.difficultyLevel;
    return 'Moderate';
  }

  private static extractAgeRestriction(activity: any): string {
    if (activity.ageRestriction) return activity.ageRestriction;
    if (activity.minimumAge) return `Minimum age: ${activity.minimumAge} years`;
    return 'Suitable for all ages';
  }

  /**
   * Get city name from coordinates using a lookup table of known cities
   * This is a fallback when the API doesn't provide location names
   */
  private static getCityNameFromCoordinates(latitude: number, longitude: number): string | null {
    // Known city coordinates (approximate centers)
    const cityCoordinates: Array<{ lat: number; lon: number; name: string; radius: number }> = [
      { lat: 48.8566, lon: 2.3522, name: 'Paris', radius: 0.5 },
      { lat: 51.5074, lon: -0.1278, name: 'London', radius: 0.5 },
      { lat: 40.7128, lon: -74.0060, name: 'New York', radius: 0.5 },
      { lat: 35.6762, lon: 139.6503, name: 'Tokyo', radius: 0.5 },
      { lat: 25.2048, lon: 55.2708, name: 'Dubai', radius: 0.5 },
      { lat: 13.7563, lon: 100.5018, name: 'Bangkok', radius: 0.5 },
      { lat: 41.9028, lon: 12.4964, name: 'Rome', radius: 0.5 },
      { lat: 41.3851, lon: 2.1734, name: 'Barcelona', radius: 0.5 },
      { lat: 52.3676, lon: 4.9041, name: 'Amsterdam', radius: 0.5 },
      { lat: 1.3521, lon: 103.8198, name: 'Singapore', radius: 0.5 },
      { lat: 43.7102, lon: 7.2620, name: 'Nice', radius: 0.3 },
      { lat: 43.5528, lon: 7.0174, name: 'Cannes', radius: 0.2 },
      { lat: 37.7749, lon: -122.4194, name: 'San Francisco', radius: 0.5 },
      { lat: 34.0522, lon: -118.2437, name: 'Los Angeles', radius: 0.5 },
      { lat: 41.8781, lon: -87.6298, name: 'Chicago', radius: 0.5 },
      { lat: 55.7558, lon: 37.6173, name: 'Moscow', radius: 0.5 },
      { lat: 52.5200, lon: 13.4050, name: 'Berlin', radius: 0.5 },
      { lat: 48.1351, lon: 11.5820, name: 'Munich', radius: 0.3 },
      { lat: 50.1109, lon: 8.6821, name: 'Frankfurt', radius: 0.3 },
      { lat: 45.4642, lon: 9.1900, name: 'Milan', radius: 0.3 },
      { lat: 40.4168, lon: -3.7038, name: 'Madrid', radius: 0.5 },
      { lat: 38.7223, lon: -9.1393, name: 'Lisbon', radius: 0.3 },
      { lat: 59.3293, lon: 18.0686, name: 'Stockholm', radius: 0.3 },
      { lat: 55.6761, lon: 12.5683, name: 'Copenhagen', radius: 0.3 },
      { lat: 47.4979, lon: 19.0402, name: 'Budapest', radius: 0.3 },
      { lat: 50.0755, lon: 14.4378, name: 'Prague', radius: 0.3 },
      { lat: 48.2082, lon: 16.3738, name: 'Vienna', radius: 0.3 },
    ];

    // Find closest city within radius
    for (const city of cityCoordinates) {
      const distance = Math.sqrt(
        Math.pow(latitude - city.lat, 2) + Math.pow(longitude - city.lon, 2)
      );

      if (distance <= city.radius) {
        if (this.DEBUG_MODE) {
          console.log(`✅ [ActivityMapper] Matched coordinates to ${city.name} (distance: ${distance.toFixed(4)})`);
        }
        return city.name;
      }
    }

    return null;
  }
}