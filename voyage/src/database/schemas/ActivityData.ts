import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityData extends Document {
  searchId: string;
  searchParams: {
    location: {
      latitude: number;
      longitude: number;
      radius?: number;
      cityCode?: string;
    };
    date?: Date;
    categories?: string[];
    priceRange?: {
      min: number;
      max: number;
      currency: string;
    };
  };
  activities: Array<{
    id: string;
    name: string;
    description: string;
    shortDescription?: string;
    category: string;
    subcategories?: string[];
    location: {
      address?: string;
      city: string;
      country: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
    };
    duration?: {
      value: number;
      unit: 'hours' | 'days' | 'minutes';
    };
    price: {
      currency: string;
      amount: string;
      priceType: 'per_person' | 'per_group' | 'per_booking';
    };
    availability: Array<{
      date: Date;
      startTime?: string;
      endTime?: string;
      availableSpots?: number;
    }>;
    images: string[];
    rating?: {
      average: number;
      count: number;
      reviews?: Array<{
        rating: number;
        comment?: string;
        author?: string;
        date: Date;
      }>;
    };
    provider: {
      name: string;
      contact?: {
        phone?: string;
        email?: string;
        website?: string;
      };
    };
    cancellationPolicy?: {
      type: 'free' | 'moderate' | 'strict';
      deadline?: string;
      refundPercentage?: number;
    };
    inclusions?: string[];
    exclusions?: string[];
    requirements?: {
      ageLimit?: {
        min?: number;
        max?: number;
      };
      fitnessLevel?: 'low' | 'moderate' | 'high';
      equipment?: string[];
    };
    languages?: string[];
  }>;
  meta?: {
    count: number;
    totalResults?: number;
    page?: number;
    pageSize?: number;
  };
  createdAt: Date;
  expiresAt: Date;
}

const ActivityDataSchema = new Schema<IActivityData>({
  searchId: {
    type: String,
    required: true,
    index: true
  },
  searchParams: {
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      radius: { type: Number },
      cityCode: { type: String }
    },
    date: { type: Date },
    categories: [String],
    priceRange: {
      min: Number,
      max: Number,
      currency: String
    }
  },
  activities: [{
    type: Schema.Types.Mixed,
    required: true
  }],
  meta: {
    type: Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  }
});

ActivityDataSchema.index({
  'searchParams.location': '2dsphere',
  'searchParams.date': 1
});

ActivityDataSchema.index({
  'activities.category': 1,
  'activities.price.amount': 1
});

export const ActivityData = mongoose.model<IActivityData>('ActivityData', ActivityDataSchema);