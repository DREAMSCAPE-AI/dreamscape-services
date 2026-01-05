/**
 * Kafka Service for Payment Service
 * Handles publishing payment events and consuming booking events
 */

import {
  KafkaClient,
  getKafkaClient,
  KAFKA_TOPICS,
  CONSUMER_GROUPS,
  createEvent,
  type PaymentInitiatedPayload,
  type PaymentCompletedPayload,
  type PaymentFailedPayload,
  type PaymentRefundedPayload,
  type VoyageBookingCreatedPayload,
  type VoyageBookingCancelledPayload,
  type MessageHandler,
} from '@dreamscape/kafka';

const SERVICE_NAME = 'payment-service';

class PaymentKafkaService {
  private client: KafkaClient | null = null;
  private isInitialized = false;

  /**
   * Initialize the Kafka client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[PaymentKafkaService] Already initialized');
      return;
    }

    try {
      this.client = getKafkaClient(SERVICE_NAME);
      await this.client.connect();
      this.isInitialized = true;
      console.log('[PaymentKafkaService] Kafka client initialized successfully');
    } catch (error) {
      console.error('[PaymentKafkaService] Failed to initialize Kafka client:', error);
      throw error;
    }
  }

  /**
   * Shutdown the Kafka client
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isInitialized = false;
      console.log('[PaymentKafkaService] Kafka client disconnected');
    }
  }

  /**
   * Publish payment initiated event
   */
  async publishPaymentInitiated(payload: PaymentInitiatedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[PaymentKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'payment.initiated',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.PAYMENT_INITIATED, event, payload.paymentId);
    console.log(`[PaymentKafkaService] Published payment initiated event: ${payload.paymentId}`);
  }

  /**
   * Publish payment completed event
   */
  async publishPaymentCompleted(payload: PaymentCompletedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[PaymentKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'payment.completed',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.PAYMENT_COMPLETED, event, payload.paymentId);
    console.log(`[PaymentKafkaService] Published payment completed event: ${payload.paymentId}`);
  }

  /**
   * Publish payment failed event
   */
  async publishPaymentFailed(payload: PaymentFailedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[PaymentKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'payment.failed',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.PAYMENT_FAILED, event, payload.paymentId);
    console.log(`[PaymentKafkaService] Published payment failed event: ${payload.paymentId}`);
  }

  /**
   * Publish payment refunded event
   */
  async publishPaymentRefunded(payload: PaymentRefundedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[PaymentKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'payment.refunded',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.PAYMENT_REFUNDED, event, payload.paymentId);
    console.log(`[PaymentKafkaService] Published payment refunded event: ${payload.paymentId}`);
  }

  /**
   * Subscribe to booking events from Voyage Service
   */
  async subscribeToBookingEvents(handlers: {
    onBookingCreated?: MessageHandler<VoyageBookingCreatedPayload>;
    onBookingCancelled?: MessageHandler<VoyageBookingCancelledPayload>;
  }): Promise<void> {
    if (!this.client) {
      console.warn('[PaymentKafkaService] Client not initialized, cannot subscribe');
      return;
    }

    const subscriptions = [];

    if (handlers.onBookingCreated) {
      subscriptions.push({
        topic: KAFKA_TOPICS.VOYAGE_BOOKING_CREATED,
        handler: handlers.onBookingCreated,
      });
    }

    if (handlers.onBookingCancelled) {
      subscriptions.push({
        topic: KAFKA_TOPICS.VOYAGE_BOOKING_CANCELLED,
        handler: handlers.onBookingCancelled,
      });
    }

    if (subscriptions.length > 0) {
      // @ts-ignore - Type mismatch with Kafka client subscription types
      await this.client.subscribe(CONSUMER_GROUPS.PAYMENT_SERVICE, subscriptions);
      console.log('[PaymentKafkaService] Subscribed to booking events');
    }
  }

  /**
   * Health check for Kafka connection
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    if (!this.client) {
      return { healthy: false, details: { error: 'Client not initialized' } };
    }
    return this.client.healthCheck();
  }
}

// Export singleton instance
export const paymentKafkaService = new PaymentKafkaService();
export default paymentKafkaService;
