/**
 * Kafka Service for User Service
 * Handles publishing user events and consuming auth events
 */

import {
  KafkaClient,
  getKafkaClient,
  KAFKA_TOPICS,
  CONSUMER_GROUPS,
  createEvent,
  type UserCreatedPayload,
  type UserUpdatedPayload,
  type UserDeletedPayload,
  type UserProfileUpdatedPayload,
  type UserPreferencesUpdatedPayload,
  type AuthLoginPayload,
  type AuthLogoutPayload,
  type MessageHandler,
} from '@dreamscape/kafka';

const SERVICE_NAME = 'user-service';

class UserKafkaService {
  private client: KafkaClient | null = null;
  private isInitialized = false;

  /**
   * Initialize the Kafka client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[UserKafkaService] Already initialized');
      return;
    }

    try {
      this.client = getKafkaClient(SERVICE_NAME);
      await this.client.connect();
      this.isInitialized = true;
      console.log('[UserKafkaService] Kafka client initialized successfully');
    } catch (error) {
      console.error('[UserKafkaService] Failed to initialize Kafka client:', error);
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
      console.log('[UserKafkaService] Kafka client disconnected');
    }
  }

  /**
   * Publish user created event
   */
  async publishUserCreated(payload: UserCreatedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[UserKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'user.created',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.USER_CREATED, event, payload.userId);
    console.log(`[UserKafkaService] Published user created event for user: ${payload.userId}`);
  }

  /**
   * Publish user updated event
   */
  async publishUserUpdated(payload: UserUpdatedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[UserKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'user.updated',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.USER_UPDATED, event, payload.userId);
    console.log(`[UserKafkaService] Published user updated event for user: ${payload.userId}`);
  }

  /**
   * Publish user deleted event
   */
  async publishUserDeleted(payload: UserDeletedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[UserKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'user.deleted',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.USER_DELETED, event, payload.userId);
    console.log(`[UserKafkaService] Published user deleted event for user: ${payload.userId}`);
  }

  /**
   * Publish user profile updated event
   */
  async publishProfileUpdated(payload: UserProfileUpdatedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[UserKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'user.profile.updated',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.USER_PROFILE_UPDATED, event, payload.userId);
    console.log(`[UserKafkaService] Published profile updated event for user: ${payload.userId}`);
  }

  /**
   * Publish user preferences updated event
   */
  async publishPreferencesUpdated(payload: UserPreferencesUpdatedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[UserKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'user.preferences.updated',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.USER_PREFERENCES_UPDATED, event, payload.userId);
    console.log(`[UserKafkaService] Published preferences updated event for user: ${payload.userId}`);
  }

  /**
   * Subscribe to auth events from Auth Service
   */
  async subscribeToAuthEvents(handlers: {
    onLogin?: MessageHandler<AuthLoginPayload>;
    onLogout?: MessageHandler<AuthLogoutPayload>;
  }): Promise<void> {
    if (!this.client) {
      console.warn('[UserKafkaService] Client not initialized, cannot subscribe');
      return;
    }

    const subscriptions = [];

    if (handlers.onLogin) {
      subscriptions.push({
        topic: KAFKA_TOPICS.AUTH_LOGIN,
        handler: handlers.onLogin,
      });
    }

    if (handlers.onLogout) {
      subscriptions.push({
        topic: KAFKA_TOPICS.AUTH_LOGOUT,
        handler: handlers.onLogout,
      });
    }

    if (subscriptions.length > 0) {
      await this.client.subscribe(CONSUMER_GROUPS.USER_SERVICE, subscriptions);
      console.log('[UserKafkaService] Subscribed to auth events');
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
export const userKafkaService = new UserKafkaService();
export default userKafkaService;
