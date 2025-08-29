import { Schema, model, Document } from 'mongoose';

export interface IPriceAnalyticsData extends Document {
  analyticsId: string;
  
  // Route information
  originLocationCode: string;
  destinationLocationCode: string;
  route: string; // "ORIGIN-DESTINATION"
  
  // Date and timing
  departureDate: Date;
  returnDate?: Date;
  analysisDate: Date;
  
  // Price data
  currentPrice: {
    amount: number;
    currency: string;
  };
  
  priceHistory: {
    date: Date;
    price: number;
    source: string;
  }[];
  
  // Statistical analysis
  priceStats: {
    lowest: number;
    highest: number;
    average: number;
    median: number;
    trend: 'up' | 'down' | 'stable';
    volatility: number; // standard deviation
    confidence: number; // 0-100
  };
  
  // Price predictions
  pricePrediction?: {
    nextWeekPrice: number;
    nextMonthPrice: number;
    recommendation: 'buy_now' | 'wait' | 'monitor';
    confidence: number;
    factors: string[];
  };
  
  // Seasonal analysis
  seasonalData?: {
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    isHighSeason: boolean;
    seasonalMultiplier: number;
    historicalSeasonalPrices: {
      year: number;
      averagePrice: number;
    }[];
  };
  
  // Market analysis
  marketAnalysis: {
    competitorCount: number;
    pricePosition: 'low' | 'medium' | 'high';
    marketShare?: Record<string, number>; // airline -> percentage
    demandLevel: 'low' | 'medium' | 'high';
    supplyLevel: 'low' | 'medium' | 'high';
  };
  
  // Travel class analysis
  travelClass: 'economy' | 'premium_economy' | 'business' | 'first';
  classComparison?: {
    economy?: number;
    premium_economy?: number;
    business?: number;
    first?: number;
  };
  
  // Booking recommendations
  recommendations: {
    bestBookingWindow: {
      start: number; // days before departure
      end: number; // days before departure
    };
    expectedSavings?: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  
  // Data sources and quality
  dataSources: string[];
  dataQuality: {
    completeness: number; // 0-100
    freshness: number; // hours since last update
    reliability: number; // 0-100
  };
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const PriceAnalyticsDataSchema = new Schema<IPriceAnalyticsData>({
  analyticsId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  
  // Route information
  originLocationCode: { 
    type: String, 
    required: true, 
    uppercase: true,
    index: true
  },
  destinationLocationCode: { 
    type: String, 
    required: true, 
    uppercase: true,
    index: true
  },
  route: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // Date and timing
  departureDate: { type: Date, required: true, index: true },
  returnDate: { type: Date },
  analysisDate: { type: Date, required: true, default: Date.now, index: true },
  
  // Price data
  currentPrice: {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 }
  },
  
  priceHistory: [{
    date: { type: Date, required: true },
    price: { type: Number, required: true, min: 0 },
    source: { type: String, required: true }
  }],
  
  // Statistical analysis
  priceStats: {
    lowest: { type: Number, required: true, min: 0 },
    highest: { type: Number, required: true, min: 0 },
    average: { type: Number, required: true, min: 0 },
    median: { type: Number, required: true, min: 0 },
    trend: { 
      type: String, 
      required: true,
      enum: ['up', 'down', 'stable']
    },
    volatility: { type: Number, required: true, min: 0 },
    confidence: { type: Number, required: true, min: 0, max: 100 }
  },
  
  // Price predictions
  pricePrediction: {
    nextWeekPrice: { type: Number, min: 0 },
    nextMonthPrice: { type: Number, min: 0 },
    recommendation: { 
      type: String,
      enum: ['buy_now', 'wait', 'monitor']
    },
    confidence: { type: Number, min: 0, max: 100 },
    factors: [{ type: String }]
  },
  
  // Seasonal analysis
  seasonalData: {
    season: { 
      type: String,
      enum: ['spring', 'summer', 'autumn', 'winter']
    },
    isHighSeason: { type: Boolean },
    seasonalMultiplier: { type: Number, min: 0 },
    historicalSeasonalPrices: [{
      year: { type: Number, required: true },
      averagePrice: { type: Number, required: true, min: 0 }
    }]
  },
  
  // Market analysis
  marketAnalysis: {
    competitorCount: { type: Number, required: true, min: 0 },
    pricePosition: { 
      type: String, 
      required: true,
      enum: ['low', 'medium', 'high']
    },
    marketShare: { type: Schema.Types.Mixed },
    demandLevel: { 
      type: String, 
      required: true,
      enum: ['low', 'medium', 'high']
    },
    supplyLevel: { 
      type: String, 
      required: true,
      enum: ['low', 'medium', 'high']
    }
  },
  
  // Travel class analysis
  travelClass: { 
    type: String, 
    required: true,
    enum: ['economy', 'premium_economy', 'business', 'first'],
    index: true
  },
  classComparison: {
    economy: { type: Number, min: 0 },
    premium_economy: { type: Number, min: 0 },
    business: { type: Number, min: 0 },
    first: { type: Number, min: 0 }
  },
  
  // Booking recommendations
  recommendations: {
    bestBookingWindow: {
      start: { type: Number, required: true, min: 0 },
      end: { type: Number, required: true, min: 0 }
    },
    expectedSavings: { type: Number },
    riskLevel: { 
      type: String, 
      required: true,
      enum: ['low', 'medium', 'high']
    }
  },
  
  // Data sources and quality
  dataSources: [{ type: String, required: true }],
  dataQuality: {
    completeness: { type: Number, required: true, min: 0, max: 100 },
    freshness: { type: Number, required: true, min: 0 }, // hours
    reliability: { type: Number, required: true, min: 0, max: 100 }
  },
  
  // Additional metadata
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'price_analytics'
});

// Indexes for performance
PriceAnalyticsDataSchema.index({ route: 1, departureDate: 1, travelClass: 1 });
PriceAnalyticsDataSchema.index({ originLocationCode: 1, destinationLocationCode: 1, analysisDate: -1 });
PriceAnalyticsDataSchema.index({ departureDate: 1, analysisDate: -1 });
PriceAnalyticsDataSchema.index({ 'priceStats.trend': 1, analysisDate: -1 });
PriceAnalyticsDataSchema.index({ 'recommendations.riskLevel': 1 });

export const PriceAnalyticsData = model<IPriceAnalyticsData>('PriceAnalyticsData', PriceAnalyticsDataSchema);