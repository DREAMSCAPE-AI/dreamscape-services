import { Schema, model, Document } from 'mongoose';

export interface IAirportData extends Document {
  iataCode: string;
  icaoCode?: string;
  name: string;
  cityName: string;
  countryName: string;
  countryCode: string;
  
  // Geographic information
  location: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  elevation?: number;
  
  // Airport details
  airportType: 'large_airport' | 'medium_airport' | 'small_airport' | 'heliport' | 'seaplane_base';
  isHub: boolean;
  hubFor?: string[]; // Array of airline codes
  
  // Terminal information
  terminals?: {
    terminalId: string;
    terminalName: string;
    gates?: number;
  }[];
  
  // Services and facilities
  services?: {
    wifi: boolean;
    restaurants: boolean;
    shops: boolean;
    lounges: boolean;
    parking: boolean;
    rentalCars: boolean;
    publicTransport: boolean;
    hotels: boolean;
  };
  
  // Operational information
  runways?: {
    runwayId: string;
    length: number;
    width: number;
    surface: string;
  }[];
  
  // Contact and website information
  website?: string;
  phone?: string;
  email?: string;
  
  // Traffic information
  annualPassengers?: number;
  annualFlights?: number;
  
  // Status
  isActive: boolean;
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const AirportDataSchema = new Schema<IAirportData>({
  iataCode: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    uppercase: true,
    minlength: 3,
    maxlength: 3
  },
  icaoCode: { 
    type: String, 
    unique: true,
    sparse: true,
    uppercase: true,
    minlength: 4,
    maxlength: 4
  },
  name: { type: String, required: true, index: true },
  cityName: { type: String, required: true, index: true },
  countryName: { type: String, required: true },
  countryCode: { 
    type: String, 
    required: true, 
    uppercase: true,
    minlength: 2,
    maxlength: 2,
    index: true
  },
  
  // Geographic information
  location: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 }
  },
  timezone: { type: String, required: true },
  elevation: { type: Number }, // in meters
  
  // Airport details
  airportType: { 
    type: String, 
    required: true,
    enum: ['large_airport', 'medium_airport', 'small_airport', 'heliport', 'seaplane_base']
  },
  isHub: { type: Boolean, default: false, index: true },
  hubFor: [{ type: String, uppercase: true }],
  
  // Terminal information
  terminals: [{
    terminalId: { type: String, required: true },
    terminalName: { type: String, required: true },
    gates: { type: Number, min: 0 }
  }],
  
  // Services and facilities
  services: {
    wifi: { type: Boolean, default: false },
    restaurants: { type: Boolean, default: false },
    shops: { type: Boolean, default: false },
    lounges: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    rentalCars: { type: Boolean, default: false },
    publicTransport: { type: Boolean, default: false },
    hotels: { type: Boolean, default: false }
  },
  
  // Operational information
  runways: [{
    runwayId: { type: String, required: true },
    length: { type: Number, required: true, min: 0 }, // in meters
    width: { type: Number, required: true, min: 0 }, // in meters
    surface: { type: String, required: true }
  }],
  
  // Contact and website information
  website: { type: String },
  phone: { type: String },
  email: { type: String },
  
  // Traffic information
  annualPassengers: { type: Number, min: 0 },
  annualFlights: { type: Number, min: 0 },
  
  // Status
  isActive: { type: Boolean, required: true, default: true, index: true },
  
  // Additional metadata
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'airports'
});

// Indexes for performance
AirportDataSchema.index({ location: '2dsphere' }); // Geospatial index
AirportDataSchema.index({ countryCode: 1, isActive: 1 });
AirportDataSchema.index({ cityName: 'text', name: 'text' });
AirportDataSchema.index({ airportType: 1, isHub: 1 });

export const AirportData = model<IAirportData>('AirportData', AirportDataSchema);