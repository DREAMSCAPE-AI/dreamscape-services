import { Schema, model, Document } from 'mongoose';

export interface IAirlineData extends Document {
  airlineCode: string;
  airlineName: string;
  businessName?: string;
  logoUrl?: string;
  
  // Contact information
  website?: string;
  phone?: string;
  email?: string;
  
  // Operational details
  countryCode: string;
  headquarters?: string;
  foundedYear?: number;
  fleetSize?: number;
  destinations?: number;
  
  // Service information
  checkinUrl?: string;
  baggageInfo?: {
    carryOnWeight?: string;
    carryOnDimensions?: string;
    checkedBaggageWeight?: string;
    checkedBaggageFees?: Record<string, number>;
  };
  
  // Meal services
  mealServices?: string[];
  
  // Alliance information
  alliance?: string;
  
  // Status and ratings
  isActive: boolean;
  safetyRating?: number;
  customerRating?: number;
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const AirlineDataSchema = new Schema<IAirlineData>({
  airlineCode: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    uppercase: true,
    minlength: 2,
    maxlength: 3
  },
  airlineName: { type: String, required: true, index: true },
  businessName: { type: String },
  logoUrl: { type: String },
  
  // Contact information
  website: { type: String },
  phone: { type: String },
  email: { type: String },
  
  // Operational details
  countryCode: { 
    type: String, 
    required: true, 
    uppercase: true,
    minlength: 2,
    maxlength: 2
  },
  headquarters: { type: String },
  foundedYear: { type: Number, min: 1900 },
  fleetSize: { type: Number, min: 0 },
  destinations: { type: Number, min: 0 },
  
  // Service information
  checkinUrl: { type: String },
  baggageInfo: {
    carryOnWeight: { type: String },
    carryOnDimensions: { type: String },
    checkedBaggageWeight: { type: String },
    checkedBaggageFees: { type: Schema.Types.Mixed }
  },
  
  // Meal services
  mealServices: [{ type: String }],
  
  // Alliance information
  alliance: { type: String, enum: ['Star Alliance', 'SkyTeam', 'Oneworld', 'None'] },
  
  // Status and ratings
  isActive: { type: Boolean, required: true, default: true, index: true },
  safetyRating: { type: Number, min: 0, max: 10 },
  customerRating: { type: Number, min: 0, max: 5 },
  
  // Additional metadata
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'airlines'
});

// Indexes for performance
AirlineDataSchema.index({ countryCode: 1, isActive: 1 });
AirlineDataSchema.index({ airlineName: 'text' });
AirlineDataSchema.index({ alliance: 1 }, { sparse: true });

export const AirlineData = model<IAirlineData>('AirlineData', AirlineDataSchema);