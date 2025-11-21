/**
 * @dreamscape/kafka
 * Shared Kafka configuration and client for DreamScape microservices
 */

// Configuration exports
export {
  KAFKA_TOPICS,
  CONSUMER_GROUPS,
  createKafkaConfig,
  createConsumerConfig,
  createProducerConfig,
  type KafkaConfig,
  type ConsumerConfig,
  type ProducerConfig,
  type KafkaTopic,
  type ConsumerGroup,
} from './config';

// Client exports
export {
  KafkaClient,
  getKafkaClient,
  resetKafkaClient,
  type MessageHandler,
} from './client';

// Type exports
export * from './types';

// Utility exports
export {
  generateEventId,
  createEvent,
  delay,
  retryWithBackoff,
  parseEvent,
  validateEvent,
  createDeadLetterEvent,
  batchEventsByKey,
  filterEventsByTimeRange,
  sortEventsByTimestamp,
  createCorrelationId,
  extractUserId,
} from './utils';
