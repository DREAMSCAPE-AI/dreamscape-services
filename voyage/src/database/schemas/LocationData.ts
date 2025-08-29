import { Schema, model, Document } from 'mongoose';

export interface ILocationData extends Document {
  locationId: string;
  name: string;
  type: 'city' | 'airport' | 'region' | 'country' | 'point_of_interest';
  
  // Geographic information
  coordinates: {
    latitude: number;
    longitude: number;
  };
  
  // Hierarchical location data
  city?: string;
  region?: string;
  country: string;
  countryCode: string;
  continent?: string;
  
  // Airport-specific (if type is airport)
  iataCode?: string;
  icaoCode?: string;
  
  // City-specific (if type is city)
  cityCode?: string;
  population?: number;
  
  // Tourism and travel information
  timeZone: string;
  currency?: string;
  languages?: string[];
  
  // Travel relevance
  isPopularDestination: boolean;
  isCapital?: boolean;
  touristRating?: number;
  
  // Search and matching
  aliases?: string[];
  searchKeywords?: string[];
  
  // Related locations
  nearbyAirports?: {
    iataCode: string;
    name: string;
    distance: number; // in kilometers
  }[];
  
  nearbyLocations?: {
    locationId: string;
    name: string;
    distance: number; // in kilometers
    type: string;
  }[];
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  // Status
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const LocationDataSchema = new Schema<ILocationData>({
  locationId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  name: { type: String, required: true, index: true },
  type: { 
    type: String, 
    required: true,
    enum: ['city', 'airport', 'region', 'country', 'point_of_interest'],
    index: true
  },
  
  // Geographic information
  coordinates: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 }
  },
  
  // Hierarchical location data
  city: { type: String },
  region: { type: String },
  country: { type: String, required: true },
  countryCode: { 
    type: String, 
    required: true, 
    uppercase: true,
    minlength: 2,
    maxlength: 3,
    index: true
  },
  continent: { type: String },
  
  // Airport-specific (if type is airport)
  iataCode: { 
    type: String, 
    uppercase: true,
    minlength: 3,
    maxlength: 3,
    sparse: true,
    unique: true
  },
  icaoCode: { 
    type: String, 
    uppercase: true,
    minlength: 4,
    maxlength: 4,
    sparse: true,
    unique: true
  },
  
  // City-specific (if type is city)
  cityCode: { 
    type: String, 
    uppercase: true,
    sparse: true
  },
  population: { type: Number, min: 0 },
  
  // Tourism and travel information
  timeZone: { type: String, required: true },
  currency: { type: String, uppercase: true, minlength: 3, maxlength: 3 },
  languages: [{ type: String }],
  
  // Travel relevance
  isPopularDestination: { type: Boolean, default: false, index: true },
  isCapital: { type: Boolean, default: false },
  touristRating: { type: Number, min: 0, max: 10 },
  
  // Search and matching
  aliases: [{ type: String }],
  searchKeywords: [{ type: String }],
  
  // Related locations
  nearbyAirports: [{
    iataCode: { type: String, required: true, uppercase: true },
    name: { type: String, required: true },
    distance: { type: Number, required: true, min: 0 }
  }],
  
  nearbyLocations: [{
    locationId: { type: String, required: true },
    name: { type: String, required: true },
    distance: { type: Number, required: true, min: 0 },
    type: { type: String, required: true }
  }],
  
  // Additional metadata
  metadata: { type: Schema.Types.Mixed },
  
  // Status
  isActive: { type: Boolean, required: true, default: true, index: true }
}, {
  timestamps: true,
  collection: 'locations'
});

// Indexes for performance
LocationDataSchema.index({ coordinates: '2dsphere' }); // Geospatial index
LocationDataSchema.index({ type: 1, countryCode: 1, isActive: 1 });
LocationDataSchema.index({ name: 'text', aliases: 'text', searchKeywords: 'text' });
LocationDataSchema.index({ isPopularDestination: 1, touristRating: -1 });
LocationDataSchema.index({ iataCode: 1 }, { sparse: true });
LocationDataSchema.index({ cityCode: 1 }, { sparse: true });

export const LocationData = model<ILocationData>('LocationData', LocationDataSchema);