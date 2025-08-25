import mongoose, { Schema, Document } from 'mongoose';

export interface ITransferData extends Document {
  searchId: string;
  searchParams: {
    startLocation: {
      latitude: number;
      longitude: number;
      address?: string;
      airportCode?: string;
    };
    endLocation: {
      latitude: number;
      longitude: number;
      address?: string;
      airportCode?: string;
    };
    transferType: 'airport_to_city' | 'city_to_airport' | 'point_to_point' | 'hourly';
    passengers: number;
    luggage?: number;
    transferDate: Date;
    transferTime?: string;
    serviceLevel?: 'economy' | 'business' | 'luxury';
  };
  transfers: Array<{
    id: string;
    provider: {
      name: string;
      rating?: number;
      contact?: {
        phone?: string;
        email?: string;
      };
    };
    vehicle: {
      type: 'car' | 'van' | 'bus' | 'luxury_car' | 'limousine';
      category: string;
      description?: string;
      capacity: {
        passengers: number;
        luggage: number;
      };
      features: string[];
      images?: string[];
    };
    route: {
      distance: {
        value: number;
        unit: 'km' | 'miles';
      };
      duration: {
        estimated: number;
        unit: 'minutes';
      };
      waypoints?: Array<{
        latitude: number;
        longitude: number;
        address?: string;
      }>;
    };
    pricing: {
      currency: string;
      basePrice: string;
      totalPrice: string;
      priceBreakdown?: Array<{
        type: string;
        amount: string;
        description?: string;
      }>;
      cancellationFee?: string;
    };
    schedule: {
      pickupTime: string;
      arrivalTime: string;
      waitingTime?: number;
    };
    booking: {
      availability: boolean;
      instantConfirmation: boolean;
      advanceBookingRequired?: number;
    };
    policies: {
      cancellation: {
        type: 'free' | 'charged';
        deadline?: string;
        fee?: string;
      };
      modification: {
        allowed: boolean;
        fee?: string;
        deadline?: string;
      };
      waitingTime: {
        included: number;
        additionalFee?: string;
      };
    };
  }>;
  meta?: {
    searchDuration: number;
    resultsCount: number;
    currency: string;
  };
  createdAt: Date;
  expiresAt: Date;
}

const TransferDataSchema = new Schema<ITransferData>({
  searchId: {
    type: String,
    required: true,
    index: true
  },
  searchParams: {
    startLocation: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: String,
      airportCode: String
    },
    endLocation: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: String,
      airportCode: String
    },
    transferType: {
      type: String,
      required: true,
      enum: ['airport_to_city', 'city_to_airport', 'point_to_point', 'hourly']
    },
    passengers: { type: Number, required: true },
    luggage: Number,
    transferDate: { type: Date, required: true },
    transferTime: String,
    serviceLevel: {
      type: String,
      enum: ['economy', 'business', 'luxury']
    }
  },
  transfers: [{
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

TransferDataSchema.index({
  'searchParams.startLocation': '2dsphere'
});

TransferDataSchema.index({
  'searchParams.endLocation': '2dsphere'
});

TransferDataSchema.index({
  'searchParams.transferType': 1,
  'searchParams.transferDate': 1
});

export const TransferData = mongoose.model<ITransferData>('TransferData', TransferDataSchema);