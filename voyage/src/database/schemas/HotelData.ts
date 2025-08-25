import mongoose, { Schema, Document } from 'mongoose';

export interface IHotelData extends Document {
  searchId: string;
  searchParams: {
    location: {
      latitude: number;
      longitude: number;
      radius?: number;
    };
    checkInDate: Date;
    checkOutDate: Date;
    rooms: {
      adults: number;
      children?: number;
    };
    amenities?: string[];
  };
  hotels: Array<{
    id: string;
    name: string;
    rating: number;
    description?: string;
    address: {
      street?: string;
      city: string;
      postalCode?: string;
      country: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
    };
    amenities: string[];
    contact: {
      phone?: string;
      email?: string;
      website?: string;
    };
    images: string[];
    rooms: Array<{
      id: string;
      type: string;
      description: string;
      amenities: string[];
      maxOccupancy: number;
      beds: Array<{
        type: string;
        count: number;
      }>;
      area?: {
        value: number;
        unit: 'SQM' | 'SQF';
      };
      price: {
        currency: string;
        total: string;
        base: string;
        taxes?: string;
        fees?: Array<{
          type: string;
          amount: string;
        }>;
      };
    }>;
    cancellationPolicy?: {
      type: string;
      deadline?: string;
      penalty?: {
        amount: string;
        currency: string;
      };
    };
  }>;
  meta?: {
    count: number;
    links?: {
      self: string;
      next?: string;
    };
  };
  createdAt: Date;
  expiresAt: Date;
}

const HotelDataSchema = new Schema<IHotelData>({
  searchId: {
    type: String,
    required: true,
    index: true
  },
  searchParams: {
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      radius: { type: Number }
    },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    rooms: {
      adults: { type: Number, required: true },
      children: { type: Number }
    },
    amenities: [String]
  },
  hotels: [{
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

HotelDataSchema.index({
  'searchParams.location': '2dsphere',
  'searchParams.checkInDate': 1,
  'searchParams.checkOutDate': 1
});

export const HotelData = mongoose.model<IHotelData>('HotelData', HotelDataSchema);