/**
 * Kafka Event Types for DreamScape Microservices
 * Type-safe event definitions for event-driven architecture
 */

/**
 * Base event structure for all Kafka messages
 */
export interface BaseEvent<T = unknown> {
  eventId: string;
  eventType: string;
  timestamp: string;
  version: string;
  source: string;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
  payload: T;
}

/**
 * User Events
 */
export interface UserCreatedPayload {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface UserUpdatedPayload {
  userId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  updatedAt: string;
}

export interface UserDeletedPayload {
  userId: string;
  deletedAt: string;
  reason?: string;
}

export interface UserProfileUpdatedPayload {
  userId: string;
  profile: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    dateOfBirth?: string;
    nationality?: string;
  };
  updatedAt: string;
}

export interface UserPreferencesUpdatedPayload {
  userId: string;
  preferences: {
    language?: string;
    currency?: string;
    notifications?: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    travelPreferences?: {
      seatPreference?: string;
      mealPreference?: string;
      classPreference?: string;
    };
  };
  updatedAt: string;
}

/**
 * Auth Events
 */
export interface AuthLoginPayload {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  loginAt: string;
  method: 'password' | 'oauth' | 'token';
}

export interface AuthLogoutPayload {
  userId: string;
  sessionId: string;
  logoutAt: string;
  reason?: 'user_initiated' | 'session_expired' | 'forced';
}

export interface AuthTokenRefreshedPayload {
  userId: string;
  sessionId: string;
  refreshedAt: string;
  expiresAt: string;
}

export interface AuthPasswordChangedPayload {
  userId: string;
  changedAt: string;
  method: 'user_initiated' | 'admin_reset' | 'forgot_password';
}

export interface AuthPasswordResetRequestedPayload {
  userId: string;
  email: string;
  requestedAt: string;
  expiresAt: string;
  resetToken: string;
}

export interface AuthAccountLockedPayload {
  userId: string;
  lockedAt: string;
  reason: 'too_many_attempts' | 'suspicious_activity' | 'admin_action';
  unlockAt?: string;
}

/**
 * Voyage/Booking Events
 */
export interface VoyageSearchPerformedPayload {
  searchId: string;
  userId?: string;
  sessionId: string;
  searchType: 'flight' | 'hotel' | 'package';
  criteria: {
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    passengers?: number;
    rooms?: number;
    class?: string;
  };
  resultsCount: number;
  searchedAt: string;
}

export interface VoyageBookingCreatedPayload {
  bookingId: string;
  userId: string;
  bookingType: 'flight' | 'hotel' | 'package';
  status: 'pending' | 'confirmed';
  totalAmount: number;
  currency: string;
  items: Array<{
    type: string;
    reference: string;
    description: string;
    price: number;
  }>;
  travelers: Array<{
    firstName: string;
    lastName: string;
    type: 'adult' | 'child' | 'infant';
  }>;
  createdAt: string;
}

export interface VoyageBookingConfirmedPayload {
  bookingId: string;
  userId: string;
  confirmationNumber: string;
  confirmedAt: string;
  paymentId: string;
}

export interface VoyageBookingCancelledPayload {
  bookingId: string;
  userId: string;
  cancelledAt: string;
  reason: string;
  refundAmount?: number;
  cancellationFee?: number;
}

export interface VoyageBookingUpdatedPayload {
  bookingId: string;
  userId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  updatedAt: string;
}

export interface VoyageFlightSelectedPayload {
  userId: string;
  sessionId: string;
  flightId: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  currency: string;
  selectedAt: string;
}

export interface VoyageHotelSelectedPayload {
  userId: string;
  sessionId: string;
  hotelId: string;
  hotelName: string;
  location: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  price: number;
  currency: string;
  selectedAt: string;
}

/**
 * Payment Events
 */
export interface PaymentInitiatedPayload {
  paymentId: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer' | 'crypto';
  initiatedAt: string;
}

export interface PaymentCompletedPayload {
  paymentId: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  transactionId: string;
  completedAt: string;
}

export interface PaymentFailedPayload {
  paymentId: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  errorCode: string;
  errorMessage: string;
  failedAt: string;
}

export interface PaymentRefundedPayload {
  paymentId: string;
  bookingId: string;
  userId: string;
  refundAmount: number;
  currency: string;
  refundId: string;
  reason: string;
  refundedAt: string;
}

/**
 * AI/Recommendation Events
 */
export interface AIRecommendationRequestedPayload {
  requestId: string;
  userId: string;
  recommendationType: 'destination' | 'hotel' | 'flight' | 'package' | 'activity';
  context: {
    budget?: { min: number; max: number; currency: string };
    dates?: { start: string; end: string };
    travelers?: number;
    preferences?: string[];
    previousSearches?: string[];
  };
  requestedAt: string;
}

export interface AIRecommendationGeneratedPayload {
  requestId: string;
  userId: string;
  recommendations: Array<{
    id: string;
    type: string;
    score: number;
    details: Record<string, unknown>;
  }>;
  model: string;
  generatedAt: string;
  processingTimeMs: number;
}

export interface AIPredictionMadePayload {
  predictionId: string;
  userId?: string;
  predictionType: 'price' | 'demand' | 'availability' | 'cancellation_risk';
  subject: {
    type: string;
    id: string;
  };
  prediction: {
    value: unknown;
    confidence: number;
    validUntil: string;
  };
  model: string;
  predictedAt: string;
}

export interface AIUserBehaviorAnalyzedPayload {
  analysisId: string;
  userId: string;
  behaviorType: 'search_pattern' | 'booking_pattern' | 'preference_change';
  insights: Array<{
    type: string;
    description: string;
    confidence: number;
    data: Record<string, unknown>;
  }>;
  analyzedAt: string;
}

/**
 * DR-274 : AI Recommendation Interaction Event
 * Tracks user interactions with recommendations (view, click, book, reject)
 */
export interface AIRecommendationInteractedPayload {
  interactionId: string;
  recommendationId: string;
  userId: string;
  itemId: string;
  itemType: 'destination' | 'hotel' | 'flight' | 'activity' | 'package';
  action: 'viewed' | 'clicked' | 'booked' | 'rejected';
  score?: number;          // Score initial de la recommandation
  contextType?: string;    // Type de contexte (general, seasonal, weather, etc.)
  rating?: number;         // Note utilisateur après interaction (1-5)
  metadata?: Record<string, unknown>; // Données additionnelles (temps passé, scroll depth, etc.)
  interactedAt: string;
}

/**
 * Notification Events
 */
export interface NotificationEmailRequestedPayload {
  notificationId: string;
  userId: string;
  email: string;
  templateId: string;
  subject: string;
  variables: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  requestedAt: string;
}

export interface NotificationSMSRequestedPayload {
  notificationId: string;
  userId: string;
  phone: string;
  templateId: string;
  variables: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  requestedAt: string;
}

export interface NotificationPushRequestedPayload {
  notificationId: string;
  userId: string;
  deviceTokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  requestedAt: string;
}

/**
 * GDPR/Compliance Events
 */
export interface GdprConsentUpdatedPayload {
  userId: string;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  preferences: boolean;
  updatedAt: string;
  ipAddress?: string;
}

export interface GdprExportRequestedPayload {
  requestId: string;
  userId: string;
  requestedAt: string;
  expiresAt: string;
}

export interface GdprDeletionRequestedPayload {
  requestId: string;
  userId: string;
  reason?: string;
  requestedAt: string;
}

/**
 * Analytics Events
 */
export interface AnalyticsEventTrackedPayload {
  eventId: string;
  userId?: string;
  sessionId: string;
  eventName: string;
  eventCategory: string;
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
  properties: Record<string, unknown>;
  trackedAt: string;
}

export interface AnalyticsPageViewPayload {
  pageViewId: string;
  userId?: string;
  sessionId: string;
  pageUrl: string;
  pagePath: string;
  pageTitle: string;
  referrer?: string;
  viewedAt: string;
  duration?: number;
}

/**
 * Event Type Mappings
 */
export type UserCreatedEvent = BaseEvent<UserCreatedPayload>;
export type UserUpdatedEvent = BaseEvent<UserUpdatedPayload>;
export type UserDeletedEvent = BaseEvent<UserDeletedPayload>;
export type UserProfileUpdatedEvent = BaseEvent<UserProfileUpdatedPayload>;
export type UserPreferencesUpdatedEvent = BaseEvent<UserPreferencesUpdatedPayload>;

export type AuthLoginEvent = BaseEvent<AuthLoginPayload>;
export type AuthLogoutEvent = BaseEvent<AuthLogoutPayload>;
export type AuthTokenRefreshedEvent = BaseEvent<AuthTokenRefreshedPayload>;
export type AuthPasswordChangedEvent = BaseEvent<AuthPasswordChangedPayload>;
export type AuthPasswordResetRequestedEvent = BaseEvent<AuthPasswordResetRequestedPayload>;
export type AuthAccountLockedEvent = BaseEvent<AuthAccountLockedPayload>;

export type VoyageSearchPerformedEvent = BaseEvent<VoyageSearchPerformedPayload>;
export type VoyageBookingCreatedEvent = BaseEvent<VoyageBookingCreatedPayload>;
export type VoyageBookingConfirmedEvent = BaseEvent<VoyageBookingConfirmedPayload>;
export type VoyageBookingCancelledEvent = BaseEvent<VoyageBookingCancelledPayload>;
export type VoyageBookingUpdatedEvent = BaseEvent<VoyageBookingUpdatedPayload>;
export type VoyageFlightSelectedEvent = BaseEvent<VoyageFlightSelectedPayload>;
export type VoyageHotelSelectedEvent = BaseEvent<VoyageHotelSelectedPayload>;

export type PaymentInitiatedEvent = BaseEvent<PaymentInitiatedPayload>;
export type PaymentCompletedEvent = BaseEvent<PaymentCompletedPayload>;
export type PaymentFailedEvent = BaseEvent<PaymentFailedPayload>;
export type PaymentRefundedEvent = BaseEvent<PaymentRefundedPayload>;

export type AIRecommendationRequestedEvent = BaseEvent<AIRecommendationRequestedPayload>;
export type AIRecommendationGeneratedEvent = BaseEvent<AIRecommendationGeneratedPayload>;
export type AIPredictionMadeEvent = BaseEvent<AIPredictionMadePayload>;
export type AIUserBehaviorAnalyzedEvent = BaseEvent<AIUserBehaviorAnalyzedPayload>;
export type AIRecommendationInteractedEvent = BaseEvent<AIRecommendationInteractedPayload>;

export type NotificationEmailRequestedEvent = BaseEvent<NotificationEmailRequestedPayload>;
export type NotificationSMSRequestedEvent = BaseEvent<NotificationSMSRequestedPayload>;
export type NotificationPushRequestedEvent = BaseEvent<NotificationPushRequestedPayload>;

export type GdprConsentUpdatedEvent = BaseEvent<GdprConsentUpdatedPayload>;
export type GdprExportRequestedEvent = BaseEvent<GdprExportRequestedPayload>;
export type GdprDeletionRequestedEvent = BaseEvent<GdprDeletionRequestedPayload>;

export type AnalyticsEventTrackedEvent = BaseEvent<AnalyticsEventTrackedPayload>;
export type AnalyticsPageViewEvent = BaseEvent<AnalyticsPageViewPayload>;
