/**
 * Payment Service - Business logic for payment processing
 * Handles payment records, database persistence, and Kafka events
 */

import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  PaymentConfirmation,
  RefundRequest,
  RefundResponse,
} from '../types/payment';
import stripeService from './StripeService';
import paymentKafkaService from './KafkaService';

class PaymentService {
  /**
   * Create a payment intent for a booking
   * This is called by voyage-service during checkout
   */
  async createPaymentIntent(
    request: CreatePaymentIntentRequest
  ): Promise<CreatePaymentIntentResponse> {
    try {
      console.log(`[PaymentService] Creating payment intent for booking ${request.bookingReference}`);

      // Create payment intent via Stripe
      const paymentIntent = await stripeService.createPaymentIntent(request);

      // TODO: Store payment record in database
      // await this.createPaymentRecord({
      //   paymentIntentId: paymentIntent.paymentIntentId,
      //   bookingId: request.bookingId,
      //   bookingReference: request.bookingReference,
      //   userId: request.userId,
      //   amount: request.amount,
      //   currency: request.currency,
      //   status: 'pending',
      // });

      console.log(`✅ [PaymentService] Payment intent created: ${paymentIntent.paymentIntentId}`);

      return paymentIntent;
    } catch (error) {
      console.error(`[PaymentService] Error creating payment intent:`, error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   * Called from webhook when payment succeeds
   */
  async handlePaymentSucceeded(paymentIntentId: string): Promise<void> {
    try {
      console.log(`[PaymentService] Processing successful payment: ${paymentIntentId}`);

      // Get payment intent details from Stripe
      const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

      const bookingId = paymentIntent.metadata.bookingId;
      const bookingReference = paymentIntent.metadata.bookingReference;
      const userId = paymentIntent.metadata.userId;

      if (!bookingId || !bookingReference || !userId) {
        throw new Error(`Missing metadata in payment intent ${paymentIntentId}`);
      }

      // TODO: Update payment record in database to 'succeeded'
      // await this.updatePaymentStatus(paymentIntentId, 'succeeded', {
      //   confirmedAt: new Date(),
      //   paymentMethod: paymentIntent.payment_method as string,
      // });

      // Publish payment.completed Kafka event
      try {
        await paymentKafkaService.publishPaymentCompleted({
          paymentId: paymentIntentId,
          bookingId,
          userId,
          amount: paymentIntent.amount / 100, // Convert cents to currency units
          currency: paymentIntent.currency.toUpperCase(),
          paymentMethod: paymentIntent.payment_method as string,
          completedAt: new Date().toISOString(),
        } as any);

        console.log(`📨 [PaymentService] Published payment.completed event for ${bookingReference}`);
      } catch (kafkaError) {
        console.error(`⚠️ [PaymentService] Failed to publish payment.completed event:`, kafkaError);
        // Don't throw - payment was successful, Kafka event is best-effort
      }

      console.log(`✅ [PaymentService] Payment ${paymentIntentId} processed successfully`);
    } catch (error) {
      console.error(`[PaymentService] Error handling payment success:`, error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   * Called from webhook when payment fails
   */
  async handlePaymentFailed(paymentIntentId: string, failureReason?: string): Promise<void> {
    try {
      console.log(`[PaymentService] Processing failed payment: ${paymentIntentId}`);

      // Get payment intent details from Stripe
      const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

      const bookingId = paymentIntent.metadata.bookingId;
      const bookingReference = paymentIntent.metadata.bookingReference;
      const userId = paymentIntent.metadata.userId;

      if (!bookingId || !bookingReference || !userId) {
        throw new Error(`Missing metadata in payment intent ${paymentIntentId}`);
      }

      const errorMessage = failureReason || paymentIntent.last_payment_error?.message || 'Payment failed';

      // TODO: Update payment record in database to 'failed'
      // await this.updatePaymentStatus(paymentIntentId, 'failed', {
      //   failureReason: errorMessage,
      // });

      // Publish payment.failed Kafka event
      try {
        await paymentKafkaService.publishPaymentFailed({
          paymentId: paymentIntentId,
          bookingId,
          bookingReference,
          userId,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
          reason: errorMessage,
          failedAt: new Date().toISOString(),
        } as any);

        console.log(`📨 [PaymentService] Published payment.failed event for ${bookingReference}`);
      } catch (kafkaError) {
        console.error(`⚠️ [PaymentService] Failed to publish payment.failed event:`, kafkaError);
      }

      console.log(`❌ [PaymentService] Payment ${paymentIntentId} failed: ${errorMessage}`);
    } catch (error) {
      console.error(`[PaymentService] Error handling payment failure:`, error);
      throw error;
    }
  }

  /**
   * Handle canceled payment
   * Called from webhook when payment is canceled
   */
  async handlePaymentCanceled(paymentIntentId: string): Promise<void> {
    try {
      console.log(`[PaymentService] Processing canceled payment: ${paymentIntentId}`);

      // Get payment intent details from Stripe
      const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

      const bookingId = paymentIntent.metadata.bookingId;
      const bookingReference = paymentIntent.metadata.bookingReference;
      const userId = paymentIntent.metadata.userId;

      if (!bookingId || !bookingReference || !userId) {
        throw new Error(`Missing metadata in payment intent ${paymentIntentId}`);
      }

      // TODO: Update payment record in database to 'canceled'
      // await this.updatePaymentStatus(paymentIntentId, 'canceled');

      console.log(`🚫 [PaymentService] Payment ${paymentIntentId} canceled`);
    } catch (error) {
      console.error(`[PaymentService] Error handling payment cancellation:`, error);
      throw error;
    }
  }

  /**
   * Process a refund
   */
  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      console.log(`[PaymentService] Processing refund for payment ${request.paymentIntentId}`);

      // Create refund in Stripe
      const refund = await stripeService.createRefund(request);

      // TODO: Update payment record in database
      // await this.updatePaymentStatus(request.paymentIntentId, 'refunded', {
      //   refundedAt: new Date(),
      // });

      // TODO: Publish payment.refunded Kafka event
      // await paymentKafkaService.publishPaymentRefunded({
      //   refundId: refund.refundId,
      //   paymentId: request.paymentIntentId,
      //   bookingId: request.bookingId,
      //   userId: request.userId,
      //   amount: refund.amount / 100,
      //   currency: refund.currency.toUpperCase(),
      //   reason: refund.reason,
      //   refundedAt: new Date().toISOString(),
      // });

      console.log(`✅ [PaymentService] Refund processed: ${refund.refundId}`);

      return refund;
    } catch (error) {
      console.error(`[PaymentService] Error processing refund:`, error);
      throw error;
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      console.log(`[PaymentService] Canceling payment intent: ${paymentIntentId}`);

      await stripeService.cancelPaymentIntent(paymentIntentId);

      // TODO: Update payment record in database
      // await this.updatePaymentStatus(paymentIntentId, 'canceled');

      console.log(`✅ [PaymentService] Payment intent canceled: ${paymentIntentId}`);
    } catch (error) {
      console.error(`[PaymentService] Error canceling payment intent:`, error);
      throw error;
    }
  }

  /**
   * Get publishable key for frontend
   */
  getPublishableKey(): string {
    return stripeService.getPublishableKey();
  }

  // TODO: Database methods (when Prisma schema is ready)
  // private async createPaymentRecord(data: any): Promise<void> { }
  // private async updatePaymentStatus(paymentIntentId: string, status: string, updates?: any): Promise<void> { }
  // async getPaymentByIntent(paymentIntentId: string): Promise<PaymentRecord | null> { }
  // async getPaymentsByBooking(bookingId: string): Promise<PaymentRecord[]> { }
  // async getPaymentsByUser(userId: string): Promise<PaymentRecord[]> { }
}

export default new PaymentService();
