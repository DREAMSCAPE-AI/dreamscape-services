import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';
import * as crypto from 'crypto';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  excludeQuery?: boolean; // Exclude query params from cache key
  varyBy?: string[]; // Additional request properties to vary cache by (e.g., ['user-agent', 'accept-language'])
}

const DEFAULT_TTL = 60 * 5; // 5 minutes
const CACHE_PREFIX = 'cache:';

/**
 * Generate a cache key based on request
 */
function generateCacheKey(req: Request, options: CacheOptions = {}): string {
  const { keyPrefix = '', excludeQuery = false, varyBy = [] } = options;

  const parts = [CACHE_PREFIX, keyPrefix, req.method, req.path];

  // Include query params if not excluded
  if (!excludeQuery && Object.keys(req.query).length > 0) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .reduce((acc, key) => {
        acc[key] = req.query[key];
        return acc;
      }, {} as Record<string, any>);
    parts.push(JSON.stringify(sortedQuery));
  }

  // Include additional vary-by headers/properties
  for (const header of varyBy) {
    const value = req.get(header) || req.body?.[header] || '';
    if (value) {
      parts.push(`${header}:${value}`);
    }
  }

  // Create hash for long keys
  const keyString = parts.join(':');
  if (keyString.length > 100) {
    const hash = crypto.createHash('md5').update(keyString).digest('hex');
    return `${CACHE_PREFIX}${keyPrefix}:${hash}`;
  }

  return keyString;
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const { ttl = DEFAULT_TTL } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    // Skip if Redis not available
    if (!redisClient.isReady()) {
      next();
      return;
    }

    try {
      const cacheKey = generateCacheKey(req, options);

      // Try to get cached response
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        const cached = JSON.parse(cachedData);

        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);

        // Restore cached headers
        if (cached.headers) {
          Object.entries(cached.headers).forEach(([key, value]) => {
            res.set(key, value as string);
          });
        }

        // Send cached response
        res.status(cached.status || 200).json(cached.body);
        return;
      }

      // Cache miss - intercept response
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache the response
      res.json = function (body: any): Response {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = {
            status: res.statusCode,
            body,
            headers: {
              'content-type': res.get('content-type'),
            },
            cachedAt: new Date().toISOString(),
          };

          // Cache asynchronously (don't wait)
          redisClient
            .set(cacheKey, JSON.stringify(cacheData), ttl)
            .catch((err) => console.error('Cache set error:', err));
        }

        // Call original json method
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache invalidation helper
 */
export class CacheInvalidator {
  /**
   * Invalidate cache by pattern
   */
  static async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const client = redisClient.getClient();
      if (!client) {
        return 0;
      }

      const keys = await client.keys(`${CACHE_PREFIX}${pattern}*`);
      if (keys.length === 0) {
        return 0;
      }

      await client.del(keys);
      return keys.length;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache for specific path
   */
  static async invalidatePath(path: string, method: string = 'GET'): Promise<number> {
    const pattern = `${method}:${path}`;
    return await this.invalidateByPattern(pattern);
  }

  /**
   * Invalidate all cache
   */
  static async invalidateAll(): Promise<number> {
    return await this.invalidateByPattern('');
  }

  /**
   * Invalidate cache by key prefix
   */
  static async invalidateByPrefix(prefix: string): Promise<number> {
    return await this.invalidateByPattern(prefix);
  }
}

/**
 * Pre-configured cache middleware for common use cases
 */
export const cache = {
  /**
   * Short-lived cache (1 minute)
   */
  short: cacheMiddleware({ ttl: 60 }),

  /**
   * Medium-lived cache (5 minutes)
   */
  medium: cacheMiddleware({ ttl: 300 }),

  /**
   * Long-lived cache (1 hour)
   */
  long: cacheMiddleware({ ttl: 3600 }),

  /**
   * Very long-lived cache (24 hours)
   */
  veryLong: cacheMiddleware({ ttl: 86400 }),

  /**
   * Custom cache with options
   */
  custom: (options: CacheOptions) => cacheMiddleware(options),
};
