import DatabaseService from '@/database/DatabaseService';
import { FlightData } from '@/database/schemas/FlightData';
import { UserActivity } from '@/database/schemas/UserActivity';
import { Analytics } from '@/database/schemas/Analytics';
import { User, Booking, SearchHistory, FlightCache, PopularDestination, PriceAlert } from '@prisma/client';

export class FlightDatabaseService {
  private dbService: DatabaseService;
  private prisma;
  private mongoModels;

  constructor() {
    this.dbService = DatabaseService.getInstance();
    this.prisma = this.dbService.getPrismaClient();
    this.mongoModels = this.dbService.getMongoModels();
  }

  // PostgreSQL operations for structured data
  
  /**
   * Create or update user
   */
  async upsertUser(userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    dateOfBirth?: Date;
    nationality?: string;
    passportNumber?: string;
  }): Promise<User> {
    return await this.prisma.user.upsert({
      where: { email: userData.email },
      update: userData,
      create: { 
        ...userData,
        password: 'temp-password' // Temporary password for migration
      }
    });
  }

  /**
   * Create booking
   */
  async createBooking(bookingData: {
    userId: string;
    bookingReference: string;
    totalPrice: number;
    currency: string;
    outboundFlightId: string;
    returnFlightId?: string;
    passengers: any;
    travelDate: Date;
    returnDate?: Date;
    paymentMethod?: string;
  }): Promise<Booking> {
    return await this.prisma.booking.create({
      data: bookingData
    });
  }

  /**
   * Get user bookings
   */
  async getUserBookings(userId: string): Promise<Booking[]> {
    return await this.prisma.booking.findMany({
      where: { userId },
      orderBy: { bookedAt: 'desc' }
    });
  }

  /**
   * Record search history
   */
  async recordSearch(searchData: {
    userId?: string;
    sessionId: string;
    origin: string;
    destination: string;
    departureDate: Date;
    returnDate?: Date;
    passengers: any;
    cabinClass?: string;
    resultsCount?: number;
  }): Promise<SearchHistory> {
    return await this.prisma.searchHistory.create({
      data: searchData
    });
  }

  /**
   * Cache flight data
   */
  async cacheFlightData(cacheData: {
    cacheKey: string;
    origin: string;
    destination: string;
    departureDate: Date;
    returnDate?: Date;
    passengers: any;
    cabinClass?: string;
    flightData: any;
    priceAnalysis?: any;
    expiresAt: Date;
  }): Promise<FlightCache> {
    return await this.prisma.flightCache.upsert({
      where: { cacheKey: cacheData.cacheKey },
      update: {
        flightData: cacheData.flightData,
        priceAnalysis: cacheData.priceAnalysis,
        expiresAt: cacheData.expiresAt,
        hitCount: { increment: 1 }
      },
      create: cacheData
    });
  }

  /**
   * Get cached flight data
   */
  async getCachedFlightData(cacheKey: string): Promise<FlightCache | null> {
    const cached = await this.prisma.flightCache.findUnique({
      where: { 
        cacheKey,
        expiresAt: { gt: new Date() }
      }
    });

    if (cached) {
      // Increment hit count
      await this.prisma.flightCache.update({
        where: { id: cached.id },
        data: { hitCount: { increment: 1 } }
      });
    }

    return cached;
  }

  /**
   * Get popular destinations
   */
  async getPopularDestinations(limit: number = 10): Promise<PopularDestination[]> {
    return await this.prisma.popularDestination.findMany({
      orderBy: [
        { searchCount: 'desc' },
        { bookingCount: 'desc' }
      ],
      take: limit
    });
  }

  /**
   * Update destination popularity
   */
  async updateDestinationPopularity(iataCode: string, type: 'search' | 'booking'): Promise<void> {
    const field = type === 'search' ? 'searchCount' : 'bookingCount';
    
    await this.prisma.popularDestination.upsert({
      where: { iataCode },
      update: {
        [field]: { increment: 1 }
      },
      create: {
        iataCode,
        cityName: 'Unknown', // This should be filled from airport data
        countryName: 'Unknown',
        [field]: 1
      }
    });
  }

  // MongoDB operations for unstructured data

  /**
   * Store flight data from Amadeus API
   */
  async storeFlightData(searchId: string, searchParams: any, flightOffers: any): Promise<void> {
    const flightData = new FlightData({
      searchId,
      searchParams,
      offers: flightOffers.data || [],
      meta: flightOffers.meta,
      dictionaries: flightOffers.dictionaries,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });

    await flightData.save();
  }

  /**
   * Get flight data by search ID
   */
  async getFlightData(searchId: string): Promise<any> {
    return await FlightData.findOne({ 
      searchId,
      expiresAt: { $gt: new Date() }
    });
  }

  /**
   * Track user activity
   */
  async trackUserActivity(activityData: {
    userId?: string;
    sessionId: string;
    activityType: 'search' | 'view' | 'click' | 'booking_attempt' | 'booking_complete' | 'page_view';
    details: any;
    duration?: number;
  }): Promise<void> {
    const activity = new UserActivity({
      ...activityData,
      timestamp: new Date()
    });

    await activity.save();
  }

  /**
   * Get user activity analytics
   */
  async getUserActivityAnalytics(userId: string, days: number = 30): Promise<any[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    return await UserActivity.find({
      userId,
      timestamp: { $gte: fromDate }
    }).sort({ timestamp: -1 });
  }

  /**
   * Store analytics data
   */
  async storeAnalytics(analyticsData: {
    type: 'daily' | 'weekly' | 'monthly' | 'route' | 'destination' | 'user_behavior';
    date: Date;
    route?: { origin: string; destination: string };
    destination?: { iataCode: string; cityName: string; countryName: string };
    metrics: any;
    dataRange: { from: Date; to: Date };
  }): Promise<void> {
    const analytics = new Analytics({
      ...analyticsData,
      generatedAt: new Date()
    });

    await analytics.save();
  }

  /**
   * Get route analytics
   */
  async getRouteAnalytics(origin: string, destination: string, days: number = 30): Promise<any> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    return await Analytics.findOne({
      type: 'route',
      'route.origin': origin,
      'route.destination': destination,
      date: { $gte: fromDate }
    }).sort({ date: -1 });
  }

  /**
   * Clean up expired data
   */
  async cleanupExpiredData(): Promise<void> {
    const now = new Date();
    
    // Clean up expired flight cache from PostgreSQL
    await this.prisma.flightCache.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });

    // Clean up expired flight data from MongoDB
    await FlightData.deleteMany({
      expiresAt: { $lt: now }
    });

    console.log('Expired data cleanup completed');
  }
}

export default FlightDatabaseService;
