import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalytics extends Document {
  type: 'daily' | 'weekly' | 'monthly' | 'route' | 'destination' | 'user_behavior';
  date: Date;
  
  route?: {
    origin: string;
    destination: string;
  };
  
  destination?: {
    iataCode: string;
    cityName: string;
    countryName: string;
  };
  
  metrics: {
    totalSearches?: number;
    uniqueUsers?: number;
    averageSearchesPerUser?: number;
    
    popularCabinClasses?: Array<{
      class: string;
      count: number;
      percentage: number;
    }>;
    
    popularPassengerCounts?: Array<{
      adults: number;
      children: number;
      infants: number;
      count: number;
      percentage: number;
    }>;
    
    averagePrice?: number;
    minPrice?: number;
    maxPrice?: number;
    priceDistribution?: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    
    totalBookings?: number;
    conversionRate?: number;
    averageBookingValue?: number;
    
    popularDepartureHours?: Array<{
      hour: number;
      count: number;
      percentage: number;
    }>;
    
    popularDaysOfWeek?: Array<{
      day: string;
      count: number;
      percentage: number;
    }>;
    
    seasonalTrends?: Array<{
      month: number;
      searches: number;
      bookings: number;
      averagePrice: number;
    }>;
    
    averageSessionDuration?: number;
    bounceRate?: number;
    pagesPerSession?: number;
    
    deviceTypes?: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    
    topCountries?: Array<{
      country: string;
      count: number;
      percentage: number;
    }>;
    
    topCities?: Array<{
      city: string;
      country: string;
      count: number;
      percentage: number;
    }>;
  };
  
  generatedAt: Date;
  dataRange: {
    from: Date;
    to: Date;
  };
}

const AnalyticsSchema = new Schema<IAnalytics>({
  type: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'route', 'destination', 'user_behavior']
  },
  date: {
    type: Date,
    required: true
  },
  route: {
    origin: String,
    destination: String
  },
  destination: {
    iataCode: String,
    cityName: String,
    countryName: String
  },
  metrics: {
    type: Schema.Types.Mixed,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  dataRange: {
    from: { type: Date, required: true },
    to: { type: Date, required: true }
  }
});

AnalyticsSchema.index({ type: 1, date: -1 });
AnalyticsSchema.index({ 'route.origin': 1, 'route.destination': 1, date: -1 });
AnalyticsSchema.index({ 'destination.iataCode': 1, date: -1 });

export const Analytics = mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);