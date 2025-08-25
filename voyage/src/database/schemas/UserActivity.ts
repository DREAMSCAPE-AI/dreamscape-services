import mongoose, { Schema, Document } from 'mongoose';

export interface IUserActivity extends Document {
  userId?: string;
  sessionId: string;
  activityType: 'search' | 'view' | 'click' | 'booking_attempt' | 'booking_complete' | 'page_view';
  
  details: {
    searchParams?: {
      origin?: string;
      destination?: string;
      departureDate?: Date;
      returnDate?: Date;
      passengers?: any;
      cabinClass?: string;
    };
    
    flightId?: string;
    offerId?: string;
    price?: {
      amount: number;
      currency: string;
    };
    
    bookingReference?: string;
    
    page?: string;
    referrer?: string;
    
    userAgent?: string;
    ipAddress?: string;
    country?: string;
    city?: string;
  };
  
  timestamp: Date;
  duration?: number;
}

const UserActivitySchema = new Schema<IUserActivity>({
  userId: {
    type: String,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  activityType: {
    type: String,
    required: true,
    enum: ['search', 'view', 'click', 'booking_attempt', 'booking_complete', 'page_view'],
    index: true
  },
  details: {
    type: Schema.Types.Mixed,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number
  }
});

UserActivitySchema.index({ userId: 1, timestamp: -1 });
UserActivitySchema.index({ sessionId: 1, timestamp: -1 });
UserActivitySchema.index({ activityType: 1, timestamp: -1 });
UserActivitySchema.index({ 'details.searchParams.origin': 1, 'details.searchParams.destination': 1 });
UserActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

export const UserActivity = mongoose.model<IUserActivity>('UserActivity', UserActivitySchema);