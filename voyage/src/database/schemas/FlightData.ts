import mongoose, { Schema, Document } from 'mongoose';

// Interface for Flight Offer data from Amadeus API
export interface IFlightData extends Document {
  searchId: string;
  searchParams: {
    origin: string;
    destination: string;
    departureDate: Date;
    returnDate?: Date;
    passengers: {
      adults: number;
      children: number;
      infants: number;
    };
    cabinClass?: string;
  };
  offers: Array<{
    id: string;
    source: string;
    instantTicketingRequired: boolean;
    nonHomogeneous: boolean;
    oneWay: boolean;
    lastTicketingDate?: string;
    numberOfBookableSeats?: number;
    itineraries: Array<{
      duration: string;
      segments: Array<{
        departure: {
          iataCode: string;
          terminal?: string;
          at: string;
        };
        arrival: {
          iataCode: string;
          terminal?: string;
          at: string;
        };
        carrierCode: string;
        number: string;
        aircraft: {
          code: string;
        };
        operating?: {
          carrierCode: string;
        };
        duration: string;
        id: string;
        numberOfStops: number;
        blacklistedInEU: boolean;
      }>;
    }>;
    price: {
      currency: string;
      total: string;
      base: string;
      fees: Array<{
        amount: string;
        type: string;
      }>;
      grandTotal: string;
    };
    pricingOptions: {
      fareType: Array<string>;
      includedCheckedBagsOnly: boolean;
    };
    validatingAirlineCodes: Array<string>;
    travelerPricings: Array<{
      travelerId: string;
      fareOption: string;
      travelerType: string;
      price: {
        currency: string;
        total: string;
        base: string;
      };
      fareDetailsBySegment: Array<{
        segmentId: string;
        cabin: string;
        fareBasis: string;
        brandedFare?: string;
        class: string;
        includedCheckedBags: {
          quantity: number;
        };
      }>;
    }>;
  }>;
  meta?: {
    count: number;
    links?: {
      self: string;
    };
  };
  dictionaries?: {
    locations: Record<string, any>;
    aircraft: Record<string, any>;
    currencies: Record<string, any>;
    carriers: Record<string, any>;
  };
  createdAt: Date;
  expiresAt: Date;
}

const FlightDataSchema = new Schema<IFlightData>({
  searchId: {
    type: String,
    required: true,
    index: true
  },
  searchParams: {
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    departureDate: { type: Date, required: true },
    returnDate: { type: Date },
    passengers: {
      adults: { type: Number, required: true },
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 }
    },
    cabinClass: { type: String }
  },
  offers: [{
    type: Schema.Types.Mixed,
    required: true
  }],
  meta: {
    type: Schema.Types.Mixed
  },
  dictionaries: {
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

// Compound indexes for efficient querying
FlightDataSchema.index({ 
  'searchParams.origin': 1, 
  'searchParams.destination': 1, 
  'searchParams.departureDate': 1 
});

export const FlightData = mongoose.model<IFlightData>('FlightData', FlightDataSchema);
