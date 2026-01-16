/**
 * Payment Service Types
 */

import type Stripe from 'stripe';

/**
 * Payment Intent creation request
 */
export interface CreatePaymentIntentRequest {
  amount: number; // in cents (e.g., 50000 = €500.00)
  currency: string; // e.g., "eur", "usd"
  bookingId: string;
  bookingReference: string;
  userId: string;
  metadata?: Record<string, string>;
}

/**
 * Payment Intent response
 */
export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Payment confirmation data
 */
export interface PaymentConfirmation {
  paymentIntentId: string;
  bookingId: string;
  bookingReference: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'canceled';
  stripePaymentMethod?: string;
  failureReason?: string;
}

/**
 * Refund request
 */
export interface RefundRequest {
  paymentIntentId: string;
  amount?: number; // Optional: partial refund amount in cents
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  bookingId: string;
  userId: string;
}

/**
 * Refund response
 */
export interface RefundResponse {
  refundId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
}

/**
 * Payment record for database
 */
export interface PaymentRecord {
  id: string;
  paymentIntentId: string;
  bookingId: string;
  bookingReference: string;
  userId: string;
  amount: number; // in cents
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  paymentMethod?: string;
  failureReason?: string;
  stripeCustomerId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  refundedAt?: Date;
}

/**
 * Webhook event types we handle
 */
export type StripeWebhookEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'charge.refunded'
  | 'charge.dispute.created';

/**
 * Webhook event handler result
 */
export interface WebhookHandlerResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Payment method types supported
 */
export type PaymentMethodType = 'card' | 'sepa_debit' | 'ideal' | 'bancontact';

/**
 * Payment status for frontend display
 */
export interface PaymentStatus {
  paymentIntentId: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  amount: number;
  currency: string;
  clientSecret?: string;
  nextAction?: Stripe.PaymentIntent.NextAction;
  error?: {
    code: string;
    message: string;
  };
}
