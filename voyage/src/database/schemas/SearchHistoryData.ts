import { Schema, model, Document } from 'mongoose';

export interface ISearchHistoryData extends Document {
  searchId: string;
  userId?: string;
  sessionId?: string;
  
  // Search type and parameters
  searchType: 'flight' | 'hotel' | 'transfer' | 'activity' | 'destination' | 'inspiration';
  searchParameters: Record<string, any>;
  
  // Common search fields
  originLocation?: string;
  destinationLocation?: string;
  departureDate?: Date;
  returnDate?: Date;
  passengers?: {
    adults: number;
    children: number;
    infants: number;
  };
  
  // Hotel specific
  checkInDate?: Date;
  checkOutDate?: Date;
  rooms?: number;
  guests?: number;
  
  // Results information
  resultsCount?: number;
  searchDuration?: number; // in milliseconds
  hasResults: boolean;
  
  // User interaction
  interactionEvents?: {
    eventType: 'view' | 'click' | 'book' | 'save' | 'share';
    timestamp: Date;
    itemId?: string;
    metadata?: Record<string, any>;
  }[];
  
  // Search context
  userAgent?: string;
  ipAddress?: string;
  referer?: string;
  
  // Geographic context
  userLocation?: {
    country?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  
  // Pricing context
  currency?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
  
  // Search quality metrics
  abandonedSearch: boolean;
  conversionEvent?: {
    type: 'booking' | 'inquiry' | 'save';
    timestamp: Date;
    bookingId?: string;
  };
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const SearchHistoryDataSchema = new Schema<ISearchHistoryData>({
  searchId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  userId: { type: String, index: true },
  sessionId: { type: String, index: true },
  
  // Search type and parameters
  searchType: { 
    type: String, 
    required: true,
    enum: ['flight', 'hotel', 'transfer', 'activity', 'destination', 'inspiration'],
    index: true
  },
  searchParameters: { type: Schema.Types.Mixed, required: true },
  
  // Common search fields
  originLocation: { type: String },
  destinationLocation: { type: String },
  departureDate: { type: Date, index: true },
  returnDate: { type: Date },
  passengers: {
    adults: { type: Number, default: 1 },
    children: { type: Number, default: 0 },
    infants: { type: Number, default: 0 }
  },
  
  // Hotel specific
  checkInDate: { type: Date },
  checkOutDate: { type: Date },
  rooms: { type: Number },
  guests: { type: Number },
  
  // Results information
  resultsCount: { type: Number, min: 0 },
  searchDuration: { type: Number, min: 0 }, // in milliseconds
  hasResults: { type: Boolean, required: true, default: false, index: true },
  
  // User interaction
  interactionEvents: [{
    eventType: { 
      type: String, 
      required: true,
      enum: ['view', 'click', 'book', 'save', 'share']
    },
    timestamp: { type: Date, required: true, default: Date.now },
    itemId: { type: String },
    metadata: { type: Schema.Types.Mixed }
  }],
  
  // Search context
  userAgent: { type: String },
  ipAddress: { type: String },
  referer: { type: String },
  
  // Geographic context
  userLocation: {
    country: { type: String },
    city: { type: String },
    coordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 }
    }
  },
  
  // Pricing context
  currency: { type: String, uppercase: true, minlength: 3, maxlength: 3 },
  priceRange: {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 }
  },
  
  // Search quality metrics
  abandonedSearch: { type: Boolean, required: true, default: false, index: true },
  conversionEvent: {
    type: { 
      type: String,
      enum: ['booking', 'inquiry', 'save']
    },
    timestamp: { type: Date },
    bookingId: { type: String }
  },
  
  // Additional metadata
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'search_history'
});

// Indexes for performance and analytics
SearchHistoryDataSchema.index({ userId: 1, createdAt: -1 });
SearchHistoryDataSchema.index({ searchType: 1, createdAt: -1 });
SearchHistoryDataSchema.index({ originLocation: 1, destinationLocation: 1 });
SearchHistoryDataSchema.index({ departureDate: 1, searchType: 1 });
SearchHistoryDataSchema.index({ hasResults: 1, abandonedSearch: 1 });
SearchHistoryDataSchema.index({ sessionId: 1, createdAt: 1 });
SearchHistoryDataSchema.index({ 'userLocation.coordinates': '2dsphere' });

export const SearchHistoryData = model<ISearchHistoryData>('SearchHistoryData', SearchHistoryDataSchema);