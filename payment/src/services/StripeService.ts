/**
 * Stripe Service - Handles all Stripe API interactions
 * Encapsulates Stripe SDK calls for payment processing
 */

import Stripe from 'stripe';
import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  RefundRequest,
  RefundResponse
} from '../types/payment';

class StripeService {
  private stripe: Stripe | null = null;
  private isInitialized = false;

  /**
   * Initialize Stripe with secret key
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[StripeService] Already initialized');
      return;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured in environment variables');
    }

    if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
      throw new Error('Invalid STRIPE_SECRET_KEY format');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16', // Stripe API version (matches installed package)
      typescript: true,
    });

    this.isInitialized = true;

    const mode = secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE';
    console.log(`✅ [StripeService] Initialized in ${mode} mode`);
  }

  /**
   * Get Stripe instance (ensures initialized)
   */
  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not initialized. Call initialize() first.');
    }
    return this.stripe;
  }

  /**
   * Create a Payment Intent
   * @param request Payment intent creation request
   * @returns Payment intent with client secret
   */
  async createPaymentIntent(
    request: CreatePaymentIntentRequest
  ): Promise<CreatePaymentIntentResponse> {
    try {
      const stripe = this.getStripe();

      console.log(`[StripeService] Creating Payment Intent for booking ${request.bookingReference}`);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: request.amount, // Amount in cents
        currency: request.currency.toLowerCase(),
        metadata: {
          bookingId: request.bookingId,
          bookingReference: request.bookingReference,
          userId: request.userId,
          ...request.metadata,
        },
        description: `Booking ${request.bookingReference}`,
        automatic_payment_methods: {
          enabled: true, // Enable all available payment methods
        },
      });

      console.log(`✅ [StripeService] Payment Intent created: ${paymentIntent.id}`);

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      console.error('[StripeService] Error creating Payment Intent:', error);
      throw this.handleStripeError(error);
    }
  }

  /**
   * Retrieve a Payment Intent
   * @param paymentIntentId Payment Intent ID
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = this.getStripe();
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error(`[StripeService] Error retrieving Payment Intent ${paymentIntentId}:`, error);
      throw this.handleStripeError(error);
    }
  }

  /**
   * Cancel a Payment Intent
   * @param paymentIntentId Payment Intent ID
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = this.getStripe();
      console.log(`[StripeService] Canceling Payment Intent ${paymentIntentId}`);

      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

      console.log(`✅ [StripeService] Payment Intent canceled: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      console.error(`[StripeService] Error canceling Payment Intent ${paymentIntentId}:`, error);
      throw this.handleStripeError(error);
    }
  }

  /**
   * Create a refund
   * @param request Refund request
   */
  async createRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const stripe = this.getStripe();

      console.log(`[StripeService] Creating refund for Payment Intent ${request.paymentIntentId}`);

      // Get the payment intent to find the charge
      const paymentIntent = await stripe.paymentIntents.retrieve(request.paymentIntentId);

      if (!paymentIntent.latest_charge) {
        throw new Error('No charge found for this payment intent');
      }

      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: request.paymentIntentId,
      };

      if (request.amount) {
        refundParams.amount = request.amount;
      }

      if (request.reason) {
        refundParams.reason = request.reason;
      }

      const refund = await stripe.refunds.create(refundParams);

      console.log(`✅ [StripeService] Refund created: ${refund.id}`);

      return {
        refundId: refund.id,
        paymentIntentId: request.paymentIntentId,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status!,
        reason: refund.reason || undefined,
      };
    } catch (error) {
      console.error(`[StripeService] Error creating refund for ${request.paymentIntentId}:`, error);
      throw this.handleStripeError(error);
    }
  }

  /**
   * Construct webhook event from request
   * Verifies the webhook signature
   * @param payload Request body (raw)
   * @param signature Stripe signature header
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      const stripe = this.getStripe();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
      }

      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('[StripeService] Webhook signature verification failed:', error);
      throw error;
    }
  }

  /**
   * Update Payment Intent metadata
   * @param paymentIntentId Payment Intent ID
   * @param metadata New metadata to set
   */
  async updatePaymentIntentMetadata(
    paymentIntentId: string,
    metadata: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = this.getStripe();
      console.log(`[StripeService] Updating metadata for Payment Intent ${paymentIntentId}`);

      const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
        metadata,
      });

      console.log(`✅ [StripeService] Payment Intent metadata updated: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      console.error(`[StripeService] Error updating Payment Intent metadata ${paymentIntentId}:`, error);
      throw this.handleStripeError(error);
    }
  }

  /**
   * Get publishable key for frontend
   */
  getPublishableKey(): string {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      throw new Error('STRIPE_PUBLISHABLE_KEY is not configured');
    }

    return publishableKey;
  }

  /**
   * Handle Stripe errors and convert to app errors
   */
  private handleStripeError(error: any): Error {
    if (error instanceof Stripe.errors.StripeError) {
      return new Error(`Stripe Error: ${error.message}`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Unknown Stripe error occurred');
  }

  /**
   * Health check - verifies Stripe connection
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      if (!this.isInitialized) {
        return {
          healthy: false,
          details: { error: 'Stripe not initialized' },
        };
      }

      const stripe = this.getStripe();

      // Try to retrieve balance to test connection
      const balance = await stripe.balance.retrieve();

      return {
        healthy: true,
        details: {
          available: balance.available,
          pending: balance.pending,
          livemode: balance.livemode,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

// Export singleton instance
export const stripeService = new StripeService();
export default stripeService;
