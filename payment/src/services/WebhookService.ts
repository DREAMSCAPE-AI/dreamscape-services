/**
 * Webhook Service - Handles Stripe webhook events
 * Processes incoming webhook events and delegates to appropriate handlers
 */

import type Stripe from 'stripe';
import type { WebhookHandlerResult } from '../types/payment';
import stripeService from './StripeService';
import paymentService from './PaymentService';
import databaseService from './DatabaseService';

class WebhookService {
  /**
   * Process a Stripe webhook event
   * @param payload Raw request body
   * @param signature Stripe-Signature header
   */
  async processWebhook(payload: string | Buffer, signature: string): Promise<WebhookHandlerResult> {
    try {
      // Verify webhook signature and construct event
      const event = stripeService.constructWebhookEvent(payload, signature);

      console.log(`[WebhookService] Received webhook event: ${event.type} (${event.id})`);

      // ========== IDEMPOTENCE CHECK ==========
      // Check if this event has already been processed
      const alreadyProcessed = await databaseService.isEventProcessed(event.id);

      if (alreadyProcessed) {
        console.log(`[WebhookService] Event ${event.id} already processed, skipping`);
        return {
          success: true,
          message: `Webhook event ${event.id} already processed (idempotent)`,
        };
      }

      // Route to appropriate handler based on event type
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event);
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(event);
          break;

        default:
          console.log(`[WebhookService] Unhandled event type: ${event.type}`);
      }

      // Mark event as processed AFTER successful processing
      await databaseService.markEventAsProcessed(event.id, event.type, {
        created: event.created,
        livemode: event.livemode,
      });

      return {
        success: true,
        message: `Webhook event ${event.type} processed successfully`,
      };
    } catch (error) {
      console.error('[WebhookService] Error processing webhook:', error);
      return {
        success: false,
        message: 'Webhook processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle payment_intent.succeeded event
   * This is triggered when a payment is successful
   */
  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    console.log(`[WebhookService] Payment succeeded: ${paymentIntent.id}`);

    await paymentService.handlePaymentSucceeded(paymentIntent.id);
  }

  /**
   * Handle payment_intent.payment_failed event
   * This is triggered when a payment fails
   */
  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    console.log(`[WebhookService] Payment failed: ${paymentIntent.id}`);

    const failureReason = paymentIntent.last_payment_error?.message;

    await paymentService.handlePaymentFailed(paymentIntent.id, failureReason);
  }

  /**
   * Handle payment_intent.canceled event
   * This is triggered when a payment intent is canceled
   */
  private async handlePaymentIntentCanceled(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    console.log(`[WebhookService] Payment canceled: ${paymentIntent.id}`);

    await paymentService.handlePaymentCanceled(paymentIntent.id);
  }

  /**
   * Handle charge.refunded event
   * This is triggered when a charge is refunded
   */
  private async handleChargeRefunded(event: Stripe.Event): Promise<void> {
    const charge = event.data.object as Stripe.Charge;

    console.log(`[WebhookService] Charge refunded: ${charge.id}`);

    // Get payment intent ID from charge
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

    if (!paymentIntentId) {
      console.error(`[WebhookService] No payment intent found for charge ${charge.id}`);
      return;
    }

    // Handle refund through PaymentService
    await paymentService.handlePaymentRefunded(paymentIntentId);
  }

  /**
   * Handle charge.dispute.created event
   * This is triggered when a customer disputes a charge
   */
  private async handleDisputeCreated(event: Stripe.Event): Promise<void> {
    const dispute = event.data.object as Stripe.Dispute;

    console.log(`[WebhookService] Dispute created: ${dispute.id}`);
    console.warn(`⚠️ [WebhookService] Charge ${dispute.charge} has been disputed. Reason: ${dispute.reason}`);

    // TODO: Handle dispute notification
    // This should:
    // - Alert admins
    // - Create a support ticket
    // - Log the dispute for review
  }
}

export default new WebhookService();
