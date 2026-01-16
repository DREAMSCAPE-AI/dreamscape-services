/**
 * Kafka Service for Auth Service
 * Handles publishing authentication events
 */

import {
  KafkaClient,
  getKafkaClient,
  KAFKA_TOPICS,
  CONSUMER_GROUPS,
  createEvent,
  type KafkaTopic,
  type AuthLoginPayload,
  type AuthLogoutPayload,
  type AuthTokenRefreshedPayload,
  type AuthPasswordChangedPayload,
  type AuthPasswordResetRequestedPayload,
  type AuthAccountLockedPayload,
  type UserCreatedPayload,
  type MessageHandler,
} from '@dreamscape/kafka';

const SERVICE_NAME = 'auth-service';

class AuthKafkaService {
  private client: KafkaClient | null = null;
  private isInitialized = false;

  /**
   * Initialize the Kafka client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[AuthKafkaService] Already initialized');
      return;
    }

    try {
      this.client = getKafkaClient(SERVICE_NAME);
      await this.client.connect();
      this.isInitialized = true;
      console.log('[AuthKafkaService] Kafka client initialized successfully');
    } catch (error) {
      console.error('[AuthKafkaService] Failed to initialize Kafka client:', error);
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
      console.log('[AuthKafkaService] Kafka client disconnected');
    }
  }

  /**
   * Publish user login event
   */
  async publishLogin(payload: AuthLoginPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AuthKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'auth.login',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AUTH_LOGIN, event, payload.userId);
    console.log(`[AuthKafkaService] Published login event for user: ${payload.userId}`);
  }

  /**
   * Publish user logout event
   */
  async publishLogout(payload: AuthLogoutPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AuthKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'auth.logout',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AUTH_LOGOUT, event, payload.userId);
    console.log(`[AuthKafkaService] Published logout event for user: ${payload.userId}`);
  }

  /**
   * Publish token refreshed event
   */
  async publishTokenRefreshed(payload: AuthTokenRefreshedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AuthKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'auth.token.refreshed',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AUTH_TOKEN_REFRESHED, event, payload.userId);
    console.log(`[AuthKafkaService] Published token refresh event for user: ${payload.userId}`);
  }

  /**
   * Publish password changed event
   */
  async publishPasswordChanged(payload: AuthPasswordChangedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AuthKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'auth.password.changed',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AUTH_PASSWORD_CHANGED, event, payload.userId);
    console.log(`[AuthKafkaService] Published password changed event for user: ${payload.userId}`);
  }

  /**
   * Publish password reset requested event
   */
  async publishPasswordResetRequested(payload: AuthPasswordResetRequestedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AuthKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'auth.password.reset.requested',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AUTH_PASSWORD_RESET_REQUESTED, event, payload.userId);
    console.log(`[AuthKafkaService] Published password reset request event for user: ${payload.userId}`);
  }

  /**
   * Publish account locked event
   */
  async publishAccountLocked(payload: AuthAccountLockedPayload, correlationId?: string): Promise<void> {
    if (!this.client) {
      console.warn('[AuthKafkaService] Client not initialized, skipping publish');
      return;
    }

    const event = createEvent(
      'auth.account.locked',
      SERVICE_NAME,
      payload,
      { correlationId }
    );

    await this.client.publish(KAFKA_TOPICS.AUTH_ACCOUNT_LOCKED, event, payload.userId);
    console.log(`[AuthKafkaService] Published account locked event for user: ${payload.userId}`);
  }

  /**
   * Subscribe to user events from User Service
   */
  async subscribeToUserEvents(handlers: {
    onUserCreated?: MessageHandler<UserCreatedPayload>;
  }): Promise<void> {
    if (!this.client) {
      console.warn('[AuthKafkaService] Client not initialized, cannot subscribe');
      return;
    }

    const subscriptions: Array<{ topic: KafkaTopic; handler: MessageHandler<any> }> = [];

    if (handlers.onUserCreated) {
      subscriptions.push({
        topic: KAFKA_TOPICS.USER_CREATED,
        handler: handlers.onUserCreated as MessageHandler<any>,
      });
    }

    if (subscriptions.length > 0) {
      await this.client.subscribe(CONSUMER_GROUPS.AUTH_SERVICE, subscriptions);
      console.log('[AuthKafkaService] Subscribed to user events');
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
export const authKafkaService = new AuthKafkaService();
export default authKafkaService;
