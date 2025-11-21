/**
 * Kafka Client for DreamScape Microservices
 * Provides singleton Kafka client with producer and consumer management
 */

import { Kafka, Producer, Consumer, Admin, logLevel, CompressionTypes, EachMessagePayload } from 'kafkajs';
import { createKafkaConfig, createConsumerConfig, createProducerConfig, KafkaTopic, ConsumerGroup, KAFKA_TOPICS } from './config';
import { BaseEvent } from './types';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Logger interface for Kafka client
 */
interface Logger {
  error: (message: string, extra?: Record<string, unknown>) => void;
  warn: (message: string, extra?: Record<string, unknown>) => void;
  info: (message: string, extra?: Record<string, unknown>) => void;
  debug: (message: string, extra?: Record<string, unknown>) => void;
}

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  error: (message, extra) => console.error(`[KAFKA ERROR] ${message}`, extra || ''),
  warn: (message, extra) => console.warn(`[KAFKA WARN] ${message}`, extra || ''),
  info: (message, extra) => console.info(`[KAFKA INFO] ${message}`, extra || ''),
  debug: (message, extra) => console.debug(`[KAFKA DEBUG] ${message}`, extra || ''),
};

/**
 * Message handler type for consuming messages
 */
export type MessageHandler<T = unknown> = (
  event: BaseEvent<T>,
  metadata: {
    topic: string;
    partition: number;
    offset: string;
    timestamp: string;
    headers: Record<string, string | undefined>;
  }
) => Promise<void>;

/**
 * Subscription configuration
 */
interface Subscription {
  topic: KafkaTopic;
  handler: MessageHandler;
  fromBeginning?: boolean;
}

/**
 * DreamScape Kafka Client
 */
export class KafkaClient {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private admin: Admin | null = null;
  private serviceName: string;
  private logger: Logger;
  private isConnected: boolean = false;
  private subscriptions: Map<string, Subscription[]> = new Map();

  constructor(serviceName: string, logger?: Logger) {
    this.serviceName = serviceName;
    this.logger = logger || defaultLogger;

    const config = createKafkaConfig(serviceName);

    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl as any,
      connectionTimeout: config.connectionTimeout,
      requestTimeout: config.requestTimeout,
      retry: config.retry,
      logLevel: this.getLogLevel(),
      logCreator: () => ({ namespace, level, log }) => {
        const { message, ...extra } = log;
        const logMethod = this.mapLogLevel(level);
        this.logger[logMethod](`[${namespace}] ${message}`, extra);
      },
    });
  }

  private getLogLevel(): logLevel {
    const level = process.env.KAFKA_LOG_LEVEL?.toLowerCase() || 'info';
    switch (level) {
      case 'error': return logLevel.ERROR;
      case 'warn': return logLevel.WARN;
      case 'info': return logLevel.INFO;
      case 'debug': return logLevel.DEBUG;
      default: return logLevel.INFO;
    }
  }

  private mapLogLevel(level: logLevel): LogLevel {
    switch (level) {
      case logLevel.ERROR: return 'error';
      case logLevel.WARN: return 'warn';
      case logLevel.INFO: return 'info';
      case logLevel.DEBUG: return 'debug';
      default: return 'info';
    }
  }

  /**
   * Connect the Kafka client (producer and admin)
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.warn('Kafka client already connected');
      return;
    }

    try {
      // Initialize producer
      const producerConfig = createProducerConfig();
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: producerConfig.allowAutoTopicCreation,
        transactionTimeout: producerConfig.transactionTimeout,
        idempotent: producerConfig.idempotent,
        maxInFlightRequests: producerConfig.maxInFlightRequests,
      });

      await this.producer.connect();
      this.logger.info(`Kafka producer connected for service: ${this.serviceName}`);

      // Initialize admin
      this.admin = this.kafka.admin();
      await this.admin.connect();
      this.logger.info('Kafka admin connected');

      this.isConnected = true;
    } catch (error) {
      this.logger.error('Failed to connect Kafka client', { error });
      throw error;
    }
  }

  /**
   * Disconnect the Kafka client
   */
  async disconnect(): Promise<void> {
    try {
      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        this.logger.info(`Consumer disconnected: ${groupId}`);
      }
      this.consumers.clear();

      // Disconnect producer
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
        this.logger.info('Kafka producer disconnected');
      }

      // Disconnect admin
      if (this.admin) {
        await this.admin.disconnect();
        this.admin = null;
        this.logger.info('Kafka admin disconnected');
      }

      this.isConnected = false;
    } catch (error) {
      this.logger.error('Error disconnecting Kafka client', { error });
      throw error;
    }
  }

  /**
   * Create topics if they don't exist
   */
  async createTopics(topics: KafkaTopic[], numPartitions: number = 3, replicationFactor: number = 1): Promise<void> {
    if (!this.admin) {
      throw new Error('Admin client not connected');
    }

    try {
      const existingTopics = await this.admin.listTopics();
      const topicsToCreate = topics.filter(topic => !existingTopics.includes(topic));

      if (topicsToCreate.length === 0) {
        this.logger.info('All topics already exist');
        return;
      }

      await this.admin.createTopics({
        topics: topicsToCreate.map(topic => ({
          topic,
          numPartitions,
          replicationFactor,
        })),
        waitForLeaders: true,
      });

      this.logger.info(`Created topics: ${topicsToCreate.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to create topics', { error });
      throw error;
    }
  }

  /**
   * Create all DreamScape topics
   */
  async createAllTopics(numPartitions: number = 3, replicationFactor: number = 1): Promise<void> {
    const allTopics = Object.values(KAFKA_TOPICS);
    await this.createTopics(allTopics, numPartitions, replicationFactor);
  }

  /**
   * Publish an event to a topic
   */
  async publish<T>(topic: KafkaTopic, event: BaseEvent<T>, key?: string): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not connected');
    }

    try {
      const message = {
        key: key || event.eventId,
        value: JSON.stringify(event),
        headers: {
          eventType: event.eventType,
          source: event.source,
          version: event.version,
          correlationId: event.correlationId || '',
          timestamp: event.timestamp,
        },
      };

      await this.producer.send({
        topic,
        messages: [message],
        compression: CompressionTypes.GZIP,
      });

      this.logger.debug(`Published event to ${topic}`, { eventId: event.eventId, eventType: event.eventType });
    } catch (error) {
      this.logger.error(`Failed to publish event to ${topic}`, { error, eventId: event.eventId });
      throw error;
    }
  }

  /**
   * Publish multiple events in a batch
   */
  async publishBatch<T>(topic: KafkaTopic, events: Array<{ event: BaseEvent<T>; key?: string }>): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not connected');
    }

    try {
      const messages = events.map(({ event, key }) => ({
        key: key || event.eventId,
        value: JSON.stringify(event),
        headers: {
          eventType: event.eventType,
          source: event.source,
          version: event.version,
          correlationId: event.correlationId || '',
          timestamp: event.timestamp,
        },
      }));

      await this.producer.send({
        topic,
        messages,
        compression: CompressionTypes.GZIP,
      });

      this.logger.debug(`Published batch of ${events.length} events to ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to publish batch to ${topic}`, { error });
      throw error;
    }
  }

  /**
   * Subscribe to a topic with a message handler
   */
  async subscribe(groupId: ConsumerGroup, subscriptions: Subscription[]): Promise<void> {
    try {
      const consumerConfig = createConsumerConfig(groupId);
      const consumer = this.kafka.consumer({
        groupId: consumerConfig.groupId,
        sessionTimeout: consumerConfig.sessionTimeout,
        heartbeatInterval: consumerConfig.heartbeatInterval,
        maxBytesPerPartition: consumerConfig.maxBytesPerPartition,
        minBytes: consumerConfig.minBytes,
        maxBytes: consumerConfig.maxBytes,
        maxWaitTimeInMs: consumerConfig.maxWaitTimeInMs,
      });

      await consumer.connect();
      this.logger.info(`Consumer connected: ${groupId}`);

      // Subscribe to all topics
      for (const subscription of subscriptions) {
        await consumer.subscribe({
          topic: subscription.topic,
          fromBeginning: subscription.fromBeginning ?? false,
        });
        this.logger.info(`Subscribed to topic: ${subscription.topic}`);
      }

      // Store subscriptions for message routing
      this.subscriptions.set(groupId, subscriptions);
      this.consumers.set(groupId, consumer);

      // Start consuming messages
      await consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(groupId, payload);
        },
      });
    } catch (error) {
      this.logger.error(`Failed to subscribe consumer: ${groupId}`, { error });
      throw error;
    }
  }

  /**
   * Handle incoming messages and route to appropriate handlers
   */
  private async handleMessage(groupId: string, payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const subscriptions = this.subscriptions.get(groupId);

    if (!subscriptions) {
      this.logger.warn(`No subscriptions found for group: ${groupId}`);
      return;
    }

    const subscription = subscriptions.find(sub => sub.topic === topic);
    if (!subscription) {
      this.logger.warn(`No handler found for topic: ${topic}`);
      return;
    }

    try {
      const value = message.value?.toString();
      if (!value) {
        this.logger.warn('Received message with empty value', { topic, partition });
        return;
      }

      const event: BaseEvent = JSON.parse(value);
      const headers: Record<string, string | undefined> = {};

      if (message.headers) {
        for (const [key, val] of Object.entries(message.headers)) {
          headers[key] = val?.toString();
        }
      }

      await subscription.handler(event, {
        topic,
        partition,
        offset: message.offset,
        timestamp: message.timestamp,
        headers,
      });

      this.logger.debug(`Processed message from ${topic}`, {
        eventId: event.eventId,
        partition,
        offset: message.offset
      });
    } catch (error) {
      this.logger.error(`Error processing message from ${topic}`, {
        error,
        partition,
        offset: message.offset
      });
      // In production, you might want to implement dead letter queue here
      throw error;
    }
  }

  /**
   * Get health status of the Kafka client
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      if (!this.admin) {
        return { healthy: false, details: { error: 'Admin not connected' } };
      }

      const cluster = await this.admin.describeCluster();
      const topics = await this.admin.listTopics();

      return {
        healthy: true,
        details: {
          clusterId: cluster.clusterId,
          brokers: cluster.brokers.length,
          controller: cluster.controller,
          topicsCount: topics.length,
          connectedConsumers: this.consumers.size,
          producerConnected: !!this.producer,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Get the underlying Kafka instance for advanced usage
   */
  getKafka(): Kafka {
    return this.kafka;
  }

  /**
   * Get the producer instance
   */
  getProducer(): Producer | null {
    return this.producer;
  }

  /**
   * Get a consumer by group ID
   */
  getConsumer(groupId: string): Consumer | undefined {
    return this.consumers.get(groupId);
  }
}

/**
 * Singleton instance management
 */
let kafkaClientInstance: KafkaClient | null = null;

/**
 * Get or create a singleton Kafka client
 */
export function getKafkaClient(serviceName?: string, logger?: Logger): KafkaClient {
  if (!kafkaClientInstance) {
    if (!serviceName) {
      throw new Error('Service name required for initial Kafka client creation');
    }
    kafkaClientInstance = new KafkaClient(serviceName, logger);
  }
  return kafkaClientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetKafkaClient(): void {
  kafkaClientInstance = null;
}
