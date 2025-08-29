import { Schema, model, Document } from 'mongoose';

export interface IFlightStatusData extends Document {
  statusId: string;
  
  // Flight identification
  carrierCode: string;
  flightNumber: string;
  flightDesignator: string; // carrierCode + flightNumber
  operatingCarrier?: string;
  
  // Route information
  originAirport: {
    iataCode: string;
    icaoCode?: string;
    name: string;
    city: string;
    country: string;
  };
  
  destinationAirport: {
    iataCode: string;
    icaoCode?: string;
    name: string;
    city: string;
    country: string;
  };
  
  // Aircraft information
  aircraftType?: string;
  aircraftRegistration?: string;
  tail?: string;
  
  // Schedule information
  scheduledDeparture: {
    dateTime: Date;
    terminal?: string;
    gate?: string;
  };
  
  scheduledArrival: {
    dateTime: Date;
    terminal?: string;
    gate?: string;
  };
  
  // Actual times
  actualDeparture?: {
    dateTime: Date;
    terminal?: string;
    gate?: string;
  };
  
  actualArrival?: {
    dateTime: Date;
    terminal?: string;
    gate?: string;
  };
  
  // Estimated times
  estimatedDeparture?: {
    dateTime: Date;
    terminal?: string;
    gate?: string;
  };
  
  estimatedArrival?: {
    dateTime: Date;
    terminal?: string;
    gate?: string;
  };
  
  // Flight status
  status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown';
  detailedStatus?: string;
  
  // Delays
  departureDelay?: {
    minutes: number;
    reason?: string;
    reasonCode?: string;
  };
  
  arrivalDelay?: {
    minutes: number;
    reason?: string;
    reasonCode?: string;
  };
  
  // Cancellation information
  cancellation?: {
    reason?: string;
    reasonCode?: string;
    timestamp: Date;
  };
  
  // Diversion information
  diversion?: {
    airportCode: string;
    airportName: string;
    reason?: string;
    timestamp: Date;
  };
  
  // Progress tracking (for active flights)
  progress?: {
    percentage: number; // 0-100
    currentAltitude?: number; // in feet
    currentSpeed?: number; // in knots
    currentPosition?: {
      latitude: number;
      longitude: number;
      timestamp: Date;
    };
  };
  
  // Service information
  serviceType?: string; // passenger, cargo, etc.
  codeShareFlights?: {
    carrierCode: string;
    flightNumber: string;
  }[];
  
  // Historical tracking
  statusHistory: {
    status: string;
    timestamp: Date;
    source: string;
    details?: string;
  }[];
  
  // Data quality and sources
  lastUpdated: Date;
  dataSource: string;
  confidence: number; // 0-100
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const FlightStatusDataSchema = new Schema<IFlightStatusData>({
  statusId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  
  // Flight identification
  carrierCode: { 
    type: String, 
    required: true, 
    uppercase: true,
    minlength: 2,
    maxlength: 3,
    index: true
  },
  flightNumber: { 
    type: String, 
    required: true,
    index: true
  },
  flightDesignator: { 
    type: String, 
    required: true, 
    index: true 
  },
  operatingCarrier: { 
    type: String, 
    uppercase: true 
  },
  
  // Route information
  originAirport: {
    iataCode: { type: String, required: true, uppercase: true },
    icaoCode: { type: String, uppercase: true },
    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true }
  },
  
  destinationAirport: {
    iataCode: { type: String, required: true, uppercase: true },
    icaoCode: { type: String, uppercase: true },
    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true }
  },
  
  // Aircraft information
  aircraftType: { type: String },
  aircraftRegistration: { type: String, uppercase: true },
  tail: { type: String, uppercase: true },
  
  // Schedule information
  scheduledDeparture: {
    dateTime: { type: Date, required: true, index: true },
    terminal: { type: String },
    gate: { type: String }
  },
  
  scheduledArrival: {
    dateTime: { type: Date, required: true, index: true },
    terminal: { type: String },
    gate: { type: String }
  },
  
  // Actual times
  actualDeparture: {
    dateTime: { type: Date },
    terminal: { type: String },
    gate: { type: String }
  },
  
  actualArrival: {
    dateTime: { type: Date },
    terminal: { type: String },
    gate: { type: String }
  },
  
  // Estimated times
  estimatedDeparture: {
    dateTime: { type: Date },
    terminal: { type: String },
    gate: { type: String }
  },
  
  estimatedArrival: {
    dateTime: { type: Date },
    terminal: { type: String },
    gate: { type: String }
  },
  
  // Flight status
  status: { 
    type: String, 
    required: true,
    enum: ['scheduled', 'active', 'landed', 'cancelled', 'diverted', 'unknown'],
    index: true
  },
  detailedStatus: { type: String },
  
  // Delays
  departureDelay: {
    minutes: { type: Number, min: 0 },
    reason: { type: String },
    reasonCode: { type: String }
  },
  
  arrivalDelay: {
    minutes: { type: Number, min: 0 },
    reason: { type: String },
    reasonCode: { type: String }
  },
  
  // Cancellation information
  cancellation: {
    reason: { type: String },
    reasonCode: { type: String },
    timestamp: { type: Date }
  },
  
  // Diversion information
  diversion: {
    airportCode: { type: String, uppercase: true },
    airportName: { type: String },
    reason: { type: String },
    timestamp: { type: Date }
  },
  
  // Progress tracking (for active flights)
  progress: {
    percentage: { type: Number, min: 0, max: 100 },
    currentAltitude: { type: Number, min: 0 },
    currentSpeed: { type: Number, min: 0 },
    currentPosition: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      timestamp: { type: Date }
    }
  },
  
  // Service information
  serviceType: { type: String, default: 'passenger' },
  codeShareFlights: [{
    carrierCode: { type: String, required: true, uppercase: true },
    flightNumber: { type: String, required: true }
  }],
  
  // Historical tracking
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    source: { type: String, required: true },
    details: { type: String }
  }],
  
  // Data quality and sources
  lastUpdated: { type: Date, required: true, default: Date.now, index: true },
  dataSource: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 100 },
  
  // Additional metadata
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'flight_status'
});

// Indexes for performance
FlightStatusDataSchema.index({ carrierCode: 1, flightNumber: 1, 'scheduledDeparture.dateTime': 1 });
FlightStatusDataSchema.index({ 'originAirport.iataCode': 1, 'destinationAirport.iataCode': 1 });
FlightStatusDataSchema.index({ status: 1, lastUpdated: -1 });
FlightStatusDataSchema.index({ 'scheduledDeparture.dateTime': 1, status: 1 });
FlightStatusDataSchema.index({ 'progress.currentPosition': '2dsphere' });

export const FlightStatusData = model<IFlightStatusData>('FlightStatusData', FlightStatusDataSchema);