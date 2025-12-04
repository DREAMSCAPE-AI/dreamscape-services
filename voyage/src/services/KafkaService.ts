/**
 * Kafka Service for Voyage Service
 * Handles publishing voyage/booking events and consuming related events
 */

import {
  KafkaClient,
  getKafkaClient,
  KAFKA_TOPICS,
  CONSUMER_GROUPS,
  createEvent,
  type VoyageSearchPerformedPayload,
  type VoyageBookingCreatedPayload,
  type VoyageBookingConfirmedPayload,
  type VoyageBookingCancelledPayload,
  type VoyageBookingUpdatedPayload,
  type VoyageFlightSelectedPayload,
  type VoyageHotelSelectedPayload,
  type PaymentCompletedPayload,
  type PaymentFailedPayload,
  type UserCreatedPayload,
  type MessageHandler,
} from '@dreamscape/kafka';

const SERVICE_NAME = 'voyage-service';

class VoyageKafkaService {
  private client: KafkaClient | null = null;
  private isInitialized = false;

  /**
   * Initialize the Kafka client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[VoyageKafkaService] Already initialized');
      return;
    }

    try {
      this.client = getKafkaClient(SERVICE_NAME);
      await this.client.connect();
      this.isInitialized = true;
      console.log('[VoyageKafkaService] Kafka client initialized successfully');
    } catch (error) {
      console.error('[VoyageKafkaService] Failed to initialize Kafka client:', error);
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
      console.log('[VoyageKafkaService] Kafka client disconnected');
    }
  }

  /**
   * Publish search performed event
   */
  async publishSearchPerformed(payload: VoyageSearchPerformedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[VoyageKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'voyage.search.performed',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.VOYAGE_SEARCH_PERFORMED, event, payload.searchId);
    console.log(`[VoyageKafkaService] Published search performed event: ${payload.searchId}`);
  }

  /**
   * Publish booking created event
   */
  async publishBookingCreated(payload: VoyageBookingCreatedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[VoyageKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'voyage.booking.created',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.VOYAGE_BOOKING_CREATED, event, payload.bookingId);
    console.log(`[VoyageKafkaService] Published booking created event: ${payload.bookingId}`);
  }

  /**
   * Publish booking confirmed event
   */
  async publishBookingConfirmed(payload: VoyageBookingConfirmedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[VoyageKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'voyage.booking.confirmed',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.VOYAGE_BOOKING_CONFIRMED, event, payload.bookingId);
    console.log(`[VoyageKafkaService] Published booking confirmed event: ${payload.bookingId}`);
  }

  /**
   * Publish booking cancelled event
   */
  async publishBookingCancelled(payload: VoyageBookingCancelledPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[VoyageKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'voyage.booking.cancelled',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.VOYAGE_BOOKING_CANCELLED, event, payload.bookingId);
    console.log(`[VoyageKafkaService] Published booking cancelled event: ${payload.bookingId}`);
  }

  /**
   * Publish booking updated event
   */
  async publishBookingUpdated(payload: VoyageBookingUpdatedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[VoyageKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'voyage.booking.updated',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.VOYAGE_BOOKING_UPDATED, event, payload.bookingId);
    console.log(`[VoyageKafkaService] Published booking updated event: ${payload.bookingId}`);
  }

  /**
   * Publish flight selected event
   */
  async publishFlightSelected(payload: VoyageFlightSelectedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[VoyageKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'voyage.flight.selected',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.VOYAGE_FLIGHT_SELECTED, event, payload.userId);
    console.log(`[VoyageKafkaService] Published flight selected event for user: ${payload.userId}`);
  }

  /**
   * Publish hotel selected event
   */
  async publishHotelSelected(payload: VoyageHotelSelectedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[VoyageKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'voyage.hotel.selected',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.VOYAGE_HOTEL_SELECTED, event, payload.userId);
    console.log(`[VoyageKafkaService] Published hotel selected event for user: ${payload.userId}`);
  }

  /**
   * Subscribe to payment and user events
   */
  async subscribeToEvents(handlers: {
    onPaymentCompleted?: MessageHandler<PaymentCompletedPayload>;
    onPaymentFailed?: MessageHandler<PaymentFailedPayload>;
    onUserCreated?: MessageHandler<UserCreatedPayload>;
  }): Promise<void> {
    if (!this.client) {
      console.warn('[VoyageKafkaService] Client not initialized, cannot subscribe');
      return;
    }

    const subscriptions = [];

    if (handlers.onPaymentCompleted) {
      subscriptions.push({
        topic: KAFKA_TOPICS.PAYMENT_COMPLETED,
        handler: handlers.onPaymentCompleted,
      });
    }

    if (handlers.onPaymentFailed) {
      subscriptions.push({
        topic: KAFKA_TOPICS.PAYMENT_FAILED,
        handler: handlers.onPaymentFailed,
      });
    }

    if (handlers.onUserCreated) {
      subscriptions.push({
        topic: KAFKA_TOPICS.USER_CREATED,
        handler: handlers.onUserCreated,
      });
    }

    if (subscriptions.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.client.subscribe(CONSUMER_GROUPS.VOYAGE_SERVICE, subscriptions as any);
      console.log('[VoyageKafkaService] Subscribed to payment and user events');
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
export const voyageKafkaService = new VoyageKafkaService();
export default voyageKafkaService;
