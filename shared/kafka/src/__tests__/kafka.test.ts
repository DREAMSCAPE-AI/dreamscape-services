/**
 * Kafka Unit Tests
 * Tests for the shared Kafka configuration and utilities
 */

import {
  KAFKA_TOPICS,
  CONSUMER_GROUPS,
  createKafkaConfig,
  createConsumerConfig,
  createProducerConfig,
  createEvent,
  generateEventId,
  validateEvent,
  parseEvent,
  createCorrelationId,
  sortEventsByTimestamp,
  filterEventsByTimeRange,
  batchEventsByKey,
} from '../index';

describe('Kafka Configuration', () => {
  describe('KAFKA_TOPICS', () => {
    it('should have all user event topics', () => {
      expect(KAFKA_TOPICS.USER_CREATED).toBe('dreamscape.user.created');
      expect(KAFKA_TOPICS.USER_UPDATED).toBe('dreamscape.user.updated');
      expect(KAFKA_TOPICS.USER_DELETED).toBe('dreamscape.user.deleted');
      expect(KAFKA_TOPICS.USER_PROFILE_UPDATED).toBe('dreamscape.user.profile.updated');
      expect(KAFKA_TOPICS.USER_PREFERENCES_UPDATED).toBe('dreamscape.user.preferences.updated');
    });

    it('should have all auth event topics', () => {
      expect(KAFKA_TOPICS.AUTH_LOGIN).toBe('dreamscape.auth.login');
      expect(KAFKA_TOPICS.AUTH_LOGOUT).toBe('dreamscape.auth.logout');
      expect(KAFKA_TOPICS.AUTH_TOKEN_REFRESHED).toBe('dreamscape.auth.token.refreshed');
      expect(KAFKA_TOPICS.AUTH_PASSWORD_CHANGED).toBe('dreamscape.auth.password.changed');
      expect(KAFKA_TOPICS.AUTH_ACCOUNT_LOCKED).toBe('dreamscape.auth.account.locked');
    });

    it('should have all voyage event topics', () => {
      expect(KAFKA_TOPICS.VOYAGE_SEARCH_PERFORMED).toBe('dreamscape.voyage.search.performed');
      expect(KAFKA_TOPICS.VOYAGE_BOOKING_CREATED).toBe('dreamscape.voyage.booking.created');
      expect(KAFKA_TOPICS.VOYAGE_BOOKING_CONFIRMED).toBe('dreamscape.voyage.booking.confirmed');
      expect(KAFKA_TOPICS.VOYAGE_BOOKING_CANCELLED).toBe('dreamscape.voyage.booking.cancelled');
    });

    it('should have all payment event topics', () => {
      expect(KAFKA_TOPICS.PAYMENT_INITIATED).toBe('dreamscape.payment.initiated');
      expect(KAFKA_TOPICS.PAYMENT_COMPLETED).toBe('dreamscape.payment.completed');
      expect(KAFKA_TOPICS.PAYMENT_FAILED).toBe('dreamscape.payment.failed');
      expect(KAFKA_TOPICS.PAYMENT_REFUNDED).toBe('dreamscape.payment.refunded');
    });

    it('should have all AI event topics', () => {
      expect(KAFKA_TOPICS.AI_RECOMMENDATION_REQUESTED).toBe('dreamscape.ai.recommendation.requested');
      expect(KAFKA_TOPICS.AI_RECOMMENDATION_GENERATED).toBe('dreamscape.ai.recommendation.generated');
      expect(KAFKA_TOPICS.AI_PREDICTION_MADE).toBe('dreamscape.ai.prediction.made');
    });
  });

  describe('CONSUMER_GROUPS', () => {
    it('should have all service consumer groups', () => {
      expect(CONSUMER_GROUPS.AUTH_SERVICE).toBe('dreamscape-auth-service-group');
      expect(CONSUMER_GROUPS.USER_SERVICE).toBe('dreamscape-user-service-group');
      expect(CONSUMER_GROUPS.VOYAGE_SERVICE).toBe('dreamscape-voyage-service-group');
      expect(CONSUMER_GROUPS.PAYMENT_SERVICE).toBe('dreamscape-payment-service-group');
      expect(CONSUMER_GROUPS.AI_SERVICE).toBe('dreamscape-ai-service-group');
    });
  });

  describe('createKafkaConfig', () => {
    beforeEach(() => {
      delete process.env.KAFKA_BROKERS;
      delete process.env.KAFKA_SSL;
      delete process.env.KAFKA_SASL_USERNAME;
      delete process.env.KAFKA_SASL_PASSWORD;
    });

    it('should create default config with localhost broker', () => {
      const config = createKafkaConfig('test-service');

      expect(config.clientId).toBe('dreamscape-test-service');
      expect(config.brokers).toEqual(['localhost:9092']);
      expect(config.ssl).toBeUndefined();
      expect(config.sasl).toBeUndefined();
    });

    it('should use custom brokers from environment', () => {
      process.env.KAFKA_BROKERS = 'broker1:9092,broker2:9092';

      const config = createKafkaConfig('test-service');

      expect(config.brokers).toEqual(['broker1:9092', 'broker2:9092']);
    });

    it('should enable SSL when configured', () => {
      process.env.KAFKA_SSL = 'true';

      const config = createKafkaConfig('test-service');

      expect(config.ssl).toBe(true);
    });

    it('should configure SASL when credentials provided', () => {
      process.env.KAFKA_SASL_USERNAME = 'user';
      process.env.KAFKA_SASL_PASSWORD = 'pass';

      const config = createKafkaConfig('test-service');

      expect(config.sasl).toEqual({
        mechanism: 'plain',
        username: 'user',
        password: 'pass',
      });
    });
  });

  describe('createConsumerConfig', () => {
    it('should create consumer config with group ID', () => {
      const config = createConsumerConfig(CONSUMER_GROUPS.AUTH_SERVICE);

      expect(config.groupId).toBe('dreamscape-auth-service-group');
      expect(config.sessionTimeout).toBeDefined();
      expect(config.heartbeatInterval).toBeDefined();
    });
  });

  describe('createProducerConfig', () => {
    it('should create producer config', () => {
      const config = createProducerConfig();

      expect(config).toBeDefined();
      expect(typeof config.allowAutoTopicCreation).toBe('boolean');
    });
  });
});

describe('Event Utilities', () => {
  describe('generateEventId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate valid UUID format', () => {
      const id = generateEventId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect(id).toMatch(uuidRegex);
    });
  });

  describe('createEvent', () => {
    it('should create event with required fields', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const event = createEvent('user.created', 'test-service', payload);

      expect(event.eventId).toBeDefined();
      expect(event.eventType).toBe('user.created');
      expect(event.source).toBe('test-service');
      expect(event.payload).toEqual(payload);
      expect(event.timestamp).toBeDefined();
      expect(event.version).toBe('1.0');
    });

    it('should include optional fields when provided', () => {
      const payload = { userId: '123' };
      const event = createEvent('user.created', 'test-service', payload, {
        correlationId: 'corr-123',
        causationId: 'cause-456',
        metadata: { environment: 'test' },
        version: '2.0',
      });

      expect(event.correlationId).toBe('corr-123');
      expect(event.causationId).toBe('cause-456');
      expect(event.metadata).toEqual({ environment: 'test' });
      expect(event.version).toBe('2.0');
    });

    it('should generate valid timestamp', () => {
      const event = createEvent('test', 'test-service', {});
      const timestamp = new Date(event.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('validateEvent', () => {
    it('should return true for valid events', () => {
      const event = createEvent('test', 'test-service', { data: 'test' });

      expect(validateEvent(event)).toBe(true);
    });

    it('should return false for null', () => {
      expect(validateEvent(null)).toBe(false);
    });

    it('should return false for objects missing required fields', () => {
      expect(validateEvent({})).toBe(false);
      expect(validateEvent({ eventId: '123' })).toBe(false);
      expect(validateEvent({ eventId: '123', eventType: 'test' })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(validateEvent('string')).toBe(false);
      expect(validateEvent(123)).toBe(false);
      expect(validateEvent(undefined)).toBe(false);
    });
  });

  describe('parseEvent', () => {
    it('should parse valid JSON string to event', () => {
      const originalEvent = createEvent('test', 'test-service', { data: 'test' });
      const jsonString = JSON.stringify(originalEvent);

      const parsedEvent = parseEvent(jsonString);

      expect(parsedEvent).toEqual(originalEvent);
    });

    it('should parse Buffer to event', () => {
      const originalEvent = createEvent('test', 'test-service', { data: 'test' });
      const buffer = Buffer.from(JSON.stringify(originalEvent));

      const parsedEvent = parseEvent(buffer);

      expect(parsedEvent).toEqual(originalEvent);
    });

    it('should return null for null input', () => {
      expect(parseEvent(null)).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      expect(parseEvent('not valid json')).toBeNull();
    });
  });

  describe('createCorrelationId', () => {
    it('should create correlation ID with prefix', () => {
      const corrId = createCorrelationId();

      expect(corrId).toMatch(/^corr-/);
    });

    it('should generate unique correlation IDs', () => {
      const id1 = createCorrelationId();
      const id2 = createCorrelationId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('sortEventsByTimestamp', () => {
    it('should sort events ascending by default', () => {
      const events = [
        createEvent('test', 'service', { order: 2 }),
        createEvent('test', 'service', { order: 1 }),
        createEvent('test', 'service', { order: 3 }),
      ];

      // Manually set timestamps to ensure order
      events[0].timestamp = '2024-01-02T00:00:00.000Z';
      events[1].timestamp = '2024-01-01T00:00:00.000Z';
      events[2].timestamp = '2024-01-03T00:00:00.000Z';

      const sorted = sortEventsByTimestamp(events, 'asc');

      expect((sorted[0].payload as { order: number }).order).toBe(1);
      expect((sorted[1].payload as { order: number }).order).toBe(2);
      expect((sorted[2].payload as { order: number }).order).toBe(3);
    });

    it('should sort events descending when specified', () => {
      const events = [
        createEvent('test', 'service', { order: 2 }),
        createEvent('test', 'service', { order: 1 }),
        createEvent('test', 'service', { order: 3 }),
      ];

      events[0].timestamp = '2024-01-02T00:00:00.000Z';
      events[1].timestamp = '2024-01-01T00:00:00.000Z';
      events[2].timestamp = '2024-01-03T00:00:00.000Z';

      const sorted = sortEventsByTimestamp(events, 'desc');

      expect((sorted[0].payload as { order: number }).order).toBe(3);
      expect((sorted[1].payload as { order: number }).order).toBe(2);
      expect((sorted[2].payload as { order: number }).order).toBe(1);
    });

    it('should not mutate original array', () => {
      const events = [createEvent('test', 'service', {})];
      const original = [...events];

      sortEventsByTimestamp(events, 'asc');

      expect(events).toEqual(original);
    });
  });

  describe('filterEventsByTimeRange', () => {
    it('should filter events within time range', () => {
      const events = [
        createEvent('test', 'service', { id: 1 }),
        createEvent('test', 'service', { id: 2 }),
        createEvent('test', 'service', { id: 3 }),
      ];

      events[0].timestamp = '2024-01-01T00:00:00.000Z';
      events[1].timestamp = '2024-01-15T00:00:00.000Z';
      events[2].timestamp = '2024-02-01T00:00:00.000Z';

      const start = new Date('2024-01-10T00:00:00.000Z');
      const end = new Date('2024-01-20T00:00:00.000Z');

      const filtered = filterEventsByTimeRange(events, start, end);

      expect(filtered).toHaveLength(1);
      expect((filtered[0].payload as { id: number }).id).toBe(2);
    });

    it('should include events on boundary dates', () => {
      const events = [createEvent('test', 'service', { id: 1 })];
      events[0].timestamp = '2024-01-15T00:00:00.000Z';

      const start = new Date('2024-01-15T00:00:00.000Z');
      const end = new Date('2024-01-15T00:00:00.000Z');

      const filtered = filterEventsByTimeRange(events, start, end);

      expect(filtered).toHaveLength(1);
    });
  });

  describe('batchEventsByKey', () => {
    it('should batch events by extracted key', () => {
      const events = [
        createEvent('test', 'service', { userId: 'user1', data: 'a' }),
        createEvent('test', 'service', { userId: 'user2', data: 'b' }),
        createEvent('test', 'service', { userId: 'user1', data: 'c' }),
      ];

      const batches = batchEventsByKey(events, (event) => {
        return (event.payload as { userId: string }).userId;
      });

      expect(batches.size).toBe(2);
      expect(batches.get('user1')?.length).toBe(2);
      expect(batches.get('user2')?.length).toBe(1);
    });

    it('should return empty map for empty array', () => {
      const batches = batchEventsByKey([], () => 'key');

      expect(batches.size).toBe(0);
    });
  });
});
