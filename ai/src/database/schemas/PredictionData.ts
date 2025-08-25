import mongoose, { Schema, Document } from 'mongoose';

export interface IPredictionData extends Document {
  predictionId: string;
  type: 'price' | 'demand' | 'weather' | 'event' | 'recommendation';
  route?: {
    origin: string;
    destination: string;
  };
  targetDate: Date;
  
  inputFeatures: {
    historical: {
      prices?: number[];
      bookings?: number[];
      searches?: number[];
      seasonality?: any;
    };
    external: {
      weather?: any;
      events?: any[];
      holidays?: any[];
      economicIndicators?: any;
    };
    realTime: {
      currentDemand?: number;
      availableSeats?: number;
      competitorPrices?: number[];
      marketTrends?: any;
    };
  };
  
  predictions: {
    price?: {
      predicted: number;
      confidence: number;
      range: {
        min: number;
        max: number;
      };
      trend: 'increasing' | 'decreasing' | 'stable';
      factors: Array<{
        factor: string;
        impact: number;
        description: string;
      }>;
    };
    demand?: {
      level: 'low' | 'medium' | 'high' | 'very_high';
      score: number;
      confidence: number;
      peakTimes?: string[];
    };
    recommendations?: Array<{
      type: 'alternative_date' | 'alternative_route' | 'booking_timing';
      suggestion: string;
      potentialSavings?: number;
      confidence: number;
    }>;
  };
  
  model: {
    name: string;
    version: string;
    accuracy?: number;
    lastTrained?: Date;
    features: string[];
  };
  
  metadata: {
    processingTime: number;
    dataQuality: number;
    externalDataSources: string[];
  };
  
  createdAt: Date;
  validUntil: Date;
}

const PredictionDataSchema = new Schema<IPredictionData>({
  predictionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['price', 'demand', 'weather', 'event', 'recommendation'],
    index: true
  },
  route: {
    origin: String,
    destination: String
  },
  targetDate: {
    type: Date,
    required: true,
    index: true
  },
  inputFeatures: {
    type: Schema.Types.Mixed,
    required: true
  },
  predictions: {
    type: Schema.Types.Mixed,
    required: true
  },
  model: {
    name: { type: String, required: true },
    version: { type: String, required: true },
    accuracy: Number,
    lastTrained: Date,
    features: [String]
  },
  metadata: {
    processingTime: { type: Number, required: true },
    dataQuality: { type: Number, required: true },
    externalDataSources: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  }
});

PredictionDataSchema.index({ 
  'route.origin': 1, 
  'route.destination': 1, 
  targetDate: 1,
  type: 1
});

PredictionDataSchema.index({
  type: 1,
  'predictions.price.predicted': 1,
  createdAt: -1
});

export const PredictionData = mongoose.model<IPredictionData>('PredictionData', PredictionDataSchema);