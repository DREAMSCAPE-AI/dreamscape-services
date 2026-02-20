/**
 * Kafka Service for AI Service
 * Handles publishing AI/recommendation events and consuming user behavior events
 */

import {
  KafkaClient,
  getKafkaClient,
  KAFKA_TOPICS,
  CONSUMER_GROUPS,
  createEvent,
  type AIRecommendationRequestedPayload,
  type AIRecommendationGeneratedPayload,
  type AIRecommendationInteractedPayload, // DR-274
  type AIPredictionMadePayload,
  type AIUserBehaviorAnalyzedPayload,
  type VoyageSearchPerformedPayload,
  type VoyageFlightSelectedPayload,
  type VoyageHotelSelectedPayload,
  type VoyageBookingCreatedPayload,
  type UserPreferencesUpdatedPayload,
  type UserProfileUpdatedPayload,
  type MessageHandler,
} from '@dreamscape/kafka';

const SERVICE_NAME = 'ai-service';

class AIKafkaService {
  private client: KafkaClient | null = null;
  private isInitialized = false;

  /**
   * Initialize the Kafka client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[AIKafkaService] Already initialized');
      return;
    }

    try {
      this.client = getKafkaClient(SERVICE_NAME);
      await this.client.connect();
      this.isInitialized = true;
      console.log('[AIKafkaService] Kafka client initialized successfully');
    } catch (error) {
      console.error('[AIKafkaService] Failed to initialize Kafka client:', error);
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
      console.log('[AIKafkaService] Kafka client disconnected');
    }
  }

  /**
   * Publish recommendation requested event
   */
  async publishRecommendationRequested(payload: AIRecommendationRequestedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AIKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'ai.recommendation.requested',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AI_RECOMMENDATION_REQUESTED, event, payload.requestId);
    console.log(`[AIKafkaService] Published recommendation requested event: ${payload.requestId}`);
  }

  /**
   * Publish recommendation generated event
   */
  async publishRecommendationGenerated(payload: AIRecommendationGeneratedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AIKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'ai.recommendation.generated',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AI_RECOMMENDATION_GENERATED, event, payload.requestId);
    console.log(`[AIKafkaService] Published recommendation generated event: ${payload.requestId}`);
  }

  /**
   * Publish recommendation interacted event
   * DR-274: Track user interactions with recommendations
   */
  async publishRecommendationInteracted(payload: AIRecommendationInteractedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AIKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'ai.recommendation.interacted',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AI_RECOMMENDATION_INTERACTED, event, payload.interactionId);
    console.log(`[AIKafkaService] Published recommendation interaction event: ${payload.action} on ${payload.recommendationId}`);
  }

  /**
   * Publish prediction made event
   */
  async publishPredictionMade(payload: AIPredictionMadePayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AIKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'ai.prediction.made',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AI_PREDICTION_MADE, event, payload.predictionId);
    console.log(`[AIKafkaService] Published prediction made event: ${payload.predictionId}`);
  }

  /**
   * Publish user behavior analyzed event
   */
  async publishUserBehaviorAnalyzed(payload: AIUserBehaviorAnalyzedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AIKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'ai.user.behavior.analyzed',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AI_USER_BEHAVIOR_ANALYZED, event, payload.userId);
    console.log(`[AIKafkaService] Published user behavior analyzed event for user: ${payload.userId}`);
  }

  /**
   * Subscribe to voyage and user events for AI analysis
   */
  async subscribeToEvents(handlers: {
    onSearchPerformed?: MessageHandler<VoyageSearchPerformedPayload>;
    onFlightSelected?: MessageHandler<VoyageFlightSelectedPayload>;
    onHotelSelected?: MessageHandler<VoyageHotelSelectedPayload>;
    onBookingCreated?: MessageHandler<VoyageBookingCreatedPayload>;
    onUserPreferencesUpdated?: MessageHandler<UserPreferencesUpdatedPayload>;
    onUserProfileUpdated?: MessageHandler<UserProfileUpdatedPayload>;
  }): Promise<void> {
    if (!this.client) {
      console.warn('[AIKafkaService] Client not initialized, cannot subscribe');
      return;
    }

    const subscriptions = [];

    if (handlers.onSearchPerformed) {
      subscriptions.push({
        topic: KAFKA_TOPICS.VOYAGE_SEARCH_PERFORMED,
        handler: handlers.onSearchPerformed,
      });
    }

    if (handlers.onFlightSelected) {
      subscriptions.push({
        topic: KAFKA_TOPICS.VOYAGE_FLIGHT_SELECTED,
        handler: handlers.onFlightSelected,
      });
    }

    if (handlers.onHotelSelected) {
      subscriptions.push({
        topic: KAFKA_TOPICS.VOYAGE_HOTEL_SELECTED,
        handler: handlers.onHotelSelected,
      });
    }

    if (handlers.onBookingCreated) {
      subscriptions.push({
        topic: KAFKA_TOPICS.VOYAGE_BOOKING_CREATED,
        handler: handlers.onBookingCreated,
      });
    }

    if (handlers.onUserPreferencesUpdated) {
      subscriptions.push({
        topic: KAFKA_TOPICS.USER_PREFERENCES_UPDATED,
        handler: handlers.onUserPreferencesUpdated,
      });
    }

    if (handlers.onUserProfileUpdated) {
      subscriptions.push({
        topic: KAFKA_TOPICS.USER_PROFILE_UPDATED,
        handler: handlers.onUserProfileUpdated,
      });
    }

    if (subscriptions.length > 0) {
      await this.client.subscribe(CONSUMER_GROUPS.AI_SERVICE, subscriptions);
      console.log('[AIKafkaService] Subscribed to voyage and user events');
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
export const aiKafkaService = new AIKafkaService();
export default aiKafkaService;
