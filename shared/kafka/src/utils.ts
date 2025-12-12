/**
 * Utility functions for Kafka event handling
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseEvent } from './types';

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return uuidv4();
}

/**
 * Create a base event with common fields populated
 */
export function createEvent<T>(
  eventType: string,
  source: string,
  payload: T,
  options?: {
    correlationId?: string;
    causationId?: string;
    metadata?: Record<string, unknown>;
    version?: string;
  }
): BaseEvent<T> {
  return {
    eventId: generateEventId(),
    eventType,
    timestamp: new Date().toISOString(),
    version: options?.version || '1.0',
    source,
    correlationId: options?.correlationId,
    causationId: options?.causationId,
    metadata: options?.metadata,
    payload,
  };
}

/**
 * Delay execution for a specified duration
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 10000,
    factor = 2,
  } = options;

  let lastError: Error | undefined;
  let currentDelay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * factor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Parse a Kafka message value to an event
 */
export function parseEvent<T>(value: string | Buffer | null): BaseEvent<T> | null {
  if (!value) return null;

  try {
    const str = typeof value === 'string' ? value : value.toString();
    return JSON.parse(str) as BaseEvent<T>;
  } catch {
    return null;
  }
}

/**
 * Validate an event structure
 */
export function validateEvent<T>(event: unknown): event is BaseEvent<T> {
  if (!event || typeof event !== 'object') return false;

  const e = event as Record<string, unknown>;
  return (
    typeof e.eventId === 'string' &&
    typeof e.eventType === 'string' &&
    typeof e.timestamp === 'string' &&
    typeof e.version === 'string' &&
    typeof e.source === 'string' &&
    e.payload !== undefined
  );
}

/**
 * Create a dead letter event wrapper
 */
export function createDeadLetterEvent<T>(
  originalEvent: BaseEvent<T>,
  error: Error,
  topic: string,
  partition: number,
  offset: string
): BaseEvent<{
  originalEvent: BaseEvent<T>;
  error: { message: string; stack?: string };
  failedTopic: string;
  failedPartition: number;
  failedOffset: string;
  failedAt: string;
}> {
  return createEvent(
    'dead_letter.event',
    'kafka-error-handler',
    {
      originalEvent,
      error: {
        message: error.message,
        stack: error.stack,
      },
      failedTopic: topic,
      failedPartition: partition,
      failedOffset: offset,
      failedAt: new Date().toISOString(),
    },
    {
      correlationId: originalEvent.correlationId,
      causationId: originalEvent.eventId,
    }
  );
}

/**
 * Batch events by a key extractor function
 */
export function batchEventsByKey<T>(
  events: BaseEvent<T>[],
  keyExtractor: (event: BaseEvent<T>) => string
): Map<string, BaseEvent<T>[]> {
  const batches = new Map<string, BaseEvent<T>[]>();

  for (const event of events) {
    const key = keyExtractor(event);
    const batch = batches.get(key) || [];
    batch.push(event);
    batches.set(key, batch);
  }

  return batches;
}

/**
 * Filter events by time range
 */
export function filterEventsByTimeRange<T>(
  events: BaseEvent<T>[],
  startTime: Date,
  endTime: Date
): BaseEvent<T>[] {
  return events.filter(event => {
    const eventTime = new Date(event.timestamp);
    return eventTime >= startTime && eventTime <= endTime;
  });
}

/**
 * Sort events by timestamp
 */
export function sortEventsByTimestamp<T>(
  events: BaseEvent<T>[],
  order: 'asc' | 'desc' = 'asc'
): BaseEvent<T>[] {
  return [...events].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return order === 'asc' ? timeA - timeB : timeB - timeA;
  });
}

/**
 * Create a correlation ID for tracking related events
 */
export function createCorrelationId(): string {
  return `corr-${uuidv4()}`;
}

/**
 * Extract user ID from event payload if present
 */
export function extractUserId<T>(event: BaseEvent<T>): string | undefined {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.userId === 'string') {
    return payload.userId;
  }
  return undefined;
}
