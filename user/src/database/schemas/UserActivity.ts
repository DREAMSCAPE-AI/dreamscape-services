import mongoose, { Schema, Document } from 'mongoose';

// Interface for user activity tracking
export interface IUserActivity extends Document {
  userId?: string; // Optional for anonymous users
  sessionId: string;
  activityType: 'search' | 'view' | 'click' | 'booking_attempt' | 'booking_complete' | 'page_view';
  
  // Activity details
  details: {
    // For search activities
    searchParams?: {
      origin?: string;
      destination?: string;
      departureDate?: Date;
      returnDate?: Date;
      passengers?: any;
      cabinClass?: string;
    };
    
    // For flight view/click activities
    flightId?: string;
    offerId?: string;
    price?: {
      amount: number;
      currency: string;
    };
    
    // For booking activities
    bookingReference?: string;
    
    // For page view activities
    page?: string;
    referrer?: string;
    
    // General metadata
    userAgent?: string;
    ipAddress?: string;
    country?: string;
    city?: string;
  };
  
  // Timestamps
  timestamp: Date;
  duration?: number; // Time spent on activity in seconds
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

// Compound indexes for analytics queries
UserActivitySchema.index({ userId: 1, timestamp: -1 });
UserActivitySchema.index({ sessionId: 1, timestamp: -1 });
UserActivitySchema.index({ activityType: 1, timestamp: -1 });
UserActivitySchema.index({ 'details.searchParams.origin': 1, 'details.searchParams.destination': 1 });

// TTL index to automatically delete old activity data (90 days)
UserActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

export const UserActivity = mongoose.model<IUserActivity>('UserActivity', UserActivitySchema);
