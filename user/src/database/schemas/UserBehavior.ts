import mongoose, { Schema, Document } from 'mongoose';

export interface IUserBehavior extends Document {
  userId: string;
  sessionId: string;
  
  profile: {
    travelFrequency: 'rare' | 'occasional' | 'frequent' | 'business';
    preferredBookingTime: 'last_minute' | 'advance' | 'flexible';
    pricesensitivity: 'low' | 'medium' | 'high';
    devicePreference: 'mobile' | 'desktop' | 'mixed';
  };
  
  searchPatterns: {
    commonRoutes: Array<{
      origin: string;
      destination: string;
      frequency: number;
      lastSearched: Date;
    }>;
    preferredTimes: {
      departureHour: number[];
      returnHour: number[];
      daysOfWeek: number[];
    };
    searchRadius: {
      flexible: boolean;
      alternativeAirports: boolean;
      maxDetour: number;
    };
  };
  
  bookingBehavior: {
    conversionRate: number;
    averageDecisionTime: number;
    priceDropThreshold: number;
    bookingStage: Array<{
      stage: 'search' | 'compare' | 'select' | 'abandon' | 'book';
      timestamp: Date;
      duration: number;
    }>;
  };
  
  preferences: {
    airlines: {
      preferred: string[];
      avoided: string[];
    };
    cabinClass: string[];
    seatPreferences: string[];
    mealPreferences: string[];
    loyaltyPrograms: Array<{
      airline: string;
      memberId: string;
      tier: string;
    }>;
  };
  
  personalDetails: {
    ageGroup: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
    travelPurpose: 'leisure' | 'business' | 'mixed';
    groupSize: {
      average: number;
      common: number[];
    };
    budget: {
      range: {
        min: number;
        max: number;
        currency: string;
      };
      flexibility: 'strict' | 'flexible' | 'very_flexible';
    };
  };
  
  interactions: {
    clicks: Array<{
      element: string;
      page: string;
      timestamp: Date;
      context?: any;
    }>;
    dwellTime: Array<{
      page: string;
      duration: number;
      timestamp: Date;
    }>;
    scrollBehavior: Array<{
      page: string;
      maxScroll: number;
      timestamp: Date;
    }>;
  };
  
  sentiment: {
    satisfaction: number;
    feedback: Array<{
      rating: number;
      comment?: string;
      category: string;
      timestamp: Date;
    }>;
    issues: Array<{
      type: string;
      description: string;
      resolved: boolean;
      timestamp: Date;
    }>;
  };
  
  predictions: {
    nextTripProbability: number;
    likelyDestinations: Array<{
      destination: string;
      probability: number;
      reasoning: string[];
    }>;
    pricePoint: number;
    bookingWindow: number;
  };
  
  createdAt: Date;
  lastUpdated: Date;
  dataRetentionExpiry: Date;
}

const UserBehaviorSchema = new Schema<IUserBehavior>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  profile: {
    travelFrequency: {
      type: String,
      enum: ['rare', 'occasional', 'frequent', 'business']
    },
    preferredBookingTime: {
      type: String,
      enum: ['last_minute', 'advance', 'flexible']
    },
    priceSenitivity: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    devicePreference: {
      type: String,
      enum: ['mobile', 'desktop', 'mixed']
    }
  },
  searchPatterns: {
    type: Schema.Types.Mixed
  },
  bookingBehavior: {
    type: Schema.Types.Mixed
  },
  preferences: {
    type: Schema.Types.Mixed
  },
  personalDetails: {
    type: Schema.Types.Mixed
  },
  interactions: {
    type: Schema.Types.Mixed
  },
  sentiment: {
    type: Schema.Types.Mixed
  },
  predictions: {
    type: Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  dataRetentionExpiry: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  }
});

UserBehaviorSchema.index({
  userId: 1,
  'profile.travelFrequency': 1,
  lastUpdated: -1
});

UserBehaviorSchema.index({
  'searchPatterns.commonRoutes.origin': 1,
  'searchPatterns.commonRoutes.destination': 1
});

export const UserBehavior = mongoose.model<IUserBehavior>('UserBehavior', UserBehaviorSchema);