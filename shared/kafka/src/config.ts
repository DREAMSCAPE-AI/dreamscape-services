/**
 * Kafka Configuration for DreamScape Microservices
 * Centralized configuration for Kafka connection and topics
 */

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
    maxRetryTime?: number;
    factor?: number;
    multiplier?: number;
  };
}

export interface ConsumerConfig {
  groupId: string;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  maxBytesPerPartition?: number;
  minBytes?: number;
  maxBytes?: number;
  maxWaitTimeInMs?: number;
}

export interface ProducerConfig {
  allowAutoTopicCreation?: boolean;
  transactionTimeout?: number;
  idempotent?: boolean;
  maxInFlightRequests?: number;
}

/**
 * DreamScape Kafka Topics
 * Centralized topic definitions for event-driven architecture
 */
export const KAFKA_TOPICS = {
  // User Events
  USER_CREATED: 'dreamscape.user.created',
  USER_UPDATED: 'dreamscape.user.updated',
  USER_DELETED: 'dreamscape.user.deleted',
  USER_PROFILE_UPDATED: 'dreamscape.user.profile.updated',
  USER_PREFERENCES_UPDATED: 'dreamscape.user.preferences.updated',

  // Auth Events
  AUTH_LOGIN: 'dreamscape.auth.login',
  AUTH_LOGOUT: 'dreamscape.auth.logout',
  AUTH_TOKEN_REFRESHED: 'dreamscape.auth.token.refreshed',
  AUTH_PASSWORD_CHANGED: 'dreamscape.auth.password.changed',
  AUTH_PASSWORD_RESET_REQUESTED: 'dreamscape.auth.password.reset.requested',
  AUTH_ACCOUNT_LOCKED: 'dreamscape.auth.account.locked',

  // Voyage/Booking Events
  VOYAGE_SEARCH_PERFORMED: 'dreamscape.voyage.search.performed',
  VOYAGE_BOOKING_CREATED: 'dreamscape.voyage.booking.created',
  VOYAGE_BOOKING_CONFIRMED: 'dreamscape.voyage.booking.confirmed',
  VOYAGE_BOOKING_CANCELLED: 'dreamscape.voyage.booking.cancelled',
  VOYAGE_BOOKING_UPDATED: 'dreamscape.voyage.booking.updated',
  VOYAGE_FLIGHT_SELECTED: 'dreamscape.voyage.flight.selected',
  VOYAGE_HOTEL_SELECTED: 'dreamscape.voyage.hotel.selected',

  // Payment Events
  PAYMENT_INITIATED: 'dreamscape.payment.initiated',
  PAYMENT_COMPLETED: 'dreamscape.payment.completed',
  PAYMENT_FAILED: 'dreamscape.payment.failed',
  PAYMENT_REFUNDED: 'dreamscape.payment.refunded',
  PAYMENT_PARTIAL_REFUND: 'dreamscape.payment.partial.refund',

  // AI/Recommendation Events
  AI_RECOMMENDATION_REQUESTED: 'dreamscape.ai.recommendation.requested',
  AI_RECOMMENDATION_GENERATED: 'dreamscape.ai.recommendation.generated',
  AI_PREDICTION_MADE: 'dreamscape.ai.prediction.made',
  AI_USER_BEHAVIOR_ANALYZED: 'dreamscape.ai.user.behavior.analyzed',

  // Notification Events (for future notification service)
  NOTIFICATION_EMAIL_REQUESTED: 'dreamscape.notification.email.requested',
  NOTIFICATION_SMS_REQUESTED: 'dreamscape.notification.sms.requested',
  NOTIFICATION_PUSH_REQUESTED: 'dreamscape.notification.push.requested',

  // Analytics Events
  ANALYTICS_EVENT_TRACKED: 'dreamscape.analytics.event.tracked',
  ANALYTICS_PAGE_VIEW: 'dreamscape.analytics.page.view',
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

/**
 * Consumer Group IDs for each service
 */
export const CONSUMER_GROUPS = {
  AUTH_SERVICE: 'dreamscape-auth-service-group',
  USER_SERVICE: 'dreamscape-user-service-group',
  VOYAGE_SERVICE: 'dreamscape-voyage-service-group',
  PAYMENT_SERVICE: 'dreamscape-payment-service-group',
  AI_SERVICE: 'dreamscape-ai-service-group',
  NOTIFICATION_SERVICE: 'dreamscape-notification-service-group',
  ANALYTICS_SERVICE: 'dreamscape-analytics-service-group',
} as const;

export type ConsumerGroup = typeof CONSUMER_GROUPS[keyof typeof CONSUMER_GROUPS];

/**
 * Default Kafka configuration factory
 */
export function createKafkaConfig(serviceName: string): KafkaConfig {
  const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];

  const config: KafkaConfig = {
    clientId: `dreamscape-${serviceName}`,
    brokers,
    connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '10000', 10),
    requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000', 10),
    retry: {
      initialRetryTime: 100,
      retries: 8,
      maxRetryTime: 30000,
      factor: 0.2,
      multiplier: 2,
    },
  };

  // SSL Configuration
  if (process.env.KAFKA_SSL === 'true') {
    config.ssl = true;
  }

  // SASL Authentication
  if (process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
    config.sasl = {
      mechanism: (process.env.KAFKA_SASL_MECHANISM as 'plain' | 'scram-sha-256' | 'scram-sha-512') || 'plain',
      username: process.env.KAFKA_SASL_USERNAME,
      password: process.env.KAFKA_SASL_PASSWORD,
    };
  }

  return config;
}

/**
 * Create consumer configuration
 */
export function createConsumerConfig(groupId: ConsumerGroup): ConsumerConfig {
  return {
    groupId,
    sessionTimeout: parseInt(process.env.KAFKA_SESSION_TIMEOUT || '30000', 10),
    heartbeatInterval: parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL || '3000', 10),
    maxBytesPerPartition: parseInt(process.env.KAFKA_MAX_BYTES_PER_PARTITION || '1048576', 10), // 1MB
    minBytes: parseInt(process.env.KAFKA_MIN_BYTES || '1', 10),
    maxBytes: parseInt(process.env.KAFKA_MAX_BYTES || '10485760', 10), // 10MB
    maxWaitTimeInMs: parseInt(process.env.KAFKA_MAX_WAIT_TIME || '5000', 10),
  };
}

/**
 * Create producer configuration
 */
export function createProducerConfig(): ProducerConfig {
  return {
    allowAutoTopicCreation: process.env.KAFKA_AUTO_CREATE_TOPICS === 'true',
    transactionTimeout: parseInt(process.env.KAFKA_TRANSACTION_TIMEOUT || '60000', 10),
    idempotent: process.env.KAFKA_IDEMPOTENT === 'true',
    maxInFlightRequests: parseInt(process.env.KAFKA_MAX_IN_FLIGHT_REQUESTS || '5', 10),
  };
}
