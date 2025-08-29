import { Schema, model, Document } from 'mongoose';

export interface IBookingData extends Document {
  bookingId: string;
  orderId?: string;
  userId: string;
  type: 'flight' | 'hotel' | 'transfer' | 'activity';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  
  // Flight specific
  flightOfferId?: string;
  originLocationCode?: string;
  destinationLocationCode?: string;
  departureDate?: Date;
  returnDate?: Date;
  passengers?: {
    adults: number;
    children: number;
    infants: number;
  };
  
  // Hotel specific
  hotelId?: string;
  checkInDate?: Date;
  checkOutDate?: Date;
  rooms?: number;
  guests?: number;
  
  // Transfer specific
  transferType?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  transferDate?: Date;
  
  // Activity specific
  activityId?: string;
  activityDate?: Date;
  participants?: number;
  
  // Pricing
  totalPrice: number;
  currency: string;
  priceBreakdown?: {
    base: number;
    taxes: number;
    fees: number;
    discount?: number;
  };
  
  // Booking details
  bookingDate: Date;
  confirmedDate?: Date;
  cancelledDate?: Date;
  cancellationReason?: string;
  
  // Contact information
  contactInfo: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
  };
  
  // Additional data
  bookingReference?: string;
  supplierReference?: string;
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const BookingDataSchema = new Schema<IBookingData>({
  bookingId: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['flight', 'hotel', 'transfer', 'activity'],
    index: true 
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    index: true 
  },
  
  // Flight specific
  flightOfferId: { type: String },
  originLocationCode: { type: String },
  destinationLocationCode: { type: String },
  departureDate: { type: Date },
  returnDate: { type: Date },
  passengers: {
    adults: { type: Number, default: 1 },
    children: { type: Number, default: 0 },
    infants: { type: Number, default: 0 }
  },
  
  // Hotel specific
  hotelId: { type: String },
  checkInDate: { type: Date },
  checkOutDate: { type: Date },
  rooms: { type: Number },
  guests: { type: Number },
  
  // Transfer specific
  transferType: { type: String },
  pickupLocation: { type: String },
  dropoffLocation: { type: String },
  transferDate: { type: Date },
  
  // Activity specific
  activityId: { type: String },
  activityDate: { type: Date },
  participants: { type: Number },
  
  // Pricing
  totalPrice: { type: Number, required: true },
  currency: { type: String, required: true, default: 'EUR' },
  priceBreakdown: {
    base: { type: Number, required: true },
    taxes: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    discount: { type: Number }
  },
  
  // Booking details
  bookingDate: { type: Date, required: true, default: Date.now, index: true },
  confirmedDate: { type: Date },
  cancelledDate: { type: Date },
  cancellationReason: { type: String },
  
  // Contact information
  contactInfo: {
    email: { type: String, required: true },
    phone: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true }
  },
  
  // Additional data
  bookingReference: { type: String, unique: true, sparse: true },
  supplierReference: { type: String },
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'bookings'
});

// Indexes for performance
BookingDataSchema.index({ userId: 1, bookingDate: -1 });
BookingDataSchema.index({ type: 1, status: 1 });
BookingDataSchema.index({ departureDate: 1 }, { sparse: true });
BookingDataSchema.index({ checkInDate: 1 }, { sparse: true });
BookingDataSchema.index({ originLocationCode: 1, destinationLocationCode: 1 }, { sparse: true });

export const BookingData = model<IBookingData>('BookingData', BookingDataSchema);