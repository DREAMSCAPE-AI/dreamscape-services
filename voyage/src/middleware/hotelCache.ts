import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';
import crypto from 'crypto';

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
  HOTEL_SEARCH: 300,      // 5 minutes - search results change frequently
  HOTEL_DETAILS: 900,     // 15 minutes - details are more stable
  HOTEL_LIST: 3600,       // 1 hour - hotel lists are quite stable
  LOCATION_SEARCH: 86400, // 24 hours - location data rarely changes
};

const CACHE_PREFIX = 'voyage:hotel:';

/**
 * Generate a unique cache key based on request parameters
 */
function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  // Sort params for consistent key generation
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        acc[key] = params[key];
      }
      return acc;
    }, {} as Record<string, unknown>);

  const paramsString = JSON.stringify(sortedParams);

  // Use hash for long keys
  if (paramsString.length > 100) {
    const hash = crypto.createHash('md5').update(paramsString).digest('hex');
    return `${CACHE_PREFIX}${prefix}:${hash}`;
  }

  return `${CACHE_PREFIX}${prefix}:${paramsString}`;
}

/**
 * Hotel search cache middleware
 * Caches search results for 5 minutes to improve performance
 */
export async function hotelSearchCache(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip cache if Redis not available
  if (!redisClient.isReady()) {
    next();
    return;
  }

  const startTime = Date.now();
  const cacheKey = generateCacheKey('search', req.query);

  try {
    // Try to get cached response
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      const cached = JSON.parse(cachedData);
      const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();

      // Set cache headers
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Age', `${Math.round(cacheAge / 1000)}s`);
      res.set('X-Response-Time', `${Date.now() - startTime}ms`);

      console.log(`[HotelCache] HIT for search - ${Date.now() - startTime}ms`);
      res.status(200).json(cached.data);
      return;
    }

    // Cache miss - store original json method
    res.set('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          data: body,
          cachedAt: new Date().toISOString(),
        };

        // Cache asynchronously
        redisClient
          .set(cacheKey, JSON.stringify(cacheData), CACHE_TTL.HOTEL_SEARCH)
          .then(() => console.log(`[HotelCache] Cached search results`))
          .catch((err) => console.error('[HotelCache] Cache set error:', err));
      }

      res.set('X-Response-Time', `${Date.now() - startTime}ms`);
      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error('[HotelCache] Error:', error);
    next();
  }
}

/**
 * Hotel details cache middleware
 * Caches hotel details for 15 minutes
 */
export async function hotelDetailsCache(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!redisClient.isReady()) {
    next();
    return;
  }

  const startTime = Date.now();
  const cacheKey = generateCacheKey('details', {
    hotelId: req.params.hotelId,
    ...req.query
  });

  try {
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      const cached = JSON.parse(cachedData);
      res.set('X-Cache', 'HIT');
      res.set('X-Response-Time', `${Date.now() - startTime}ms`);
      console.log(`[HotelCache] HIT for details - ${Date.now() - startTime}ms`);
      res.status(200).json(cached.data);
      return;
    }

    res.set('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          data: body,
          cachedAt: new Date().toISOString(),
        };

        redisClient
          .set(cacheKey, JSON.stringify(cacheData), CACHE_TTL.HOTEL_DETAILS)
          .catch((err) => console.error('[HotelCache] Cache set error:', err));
      }

      res.set('X-Response-Time', `${Date.now() - startTime}ms`);
      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error('[HotelCache] Error:', error);
    next();
  }
}

/**
 * Hotel list cache middleware
 * Caches hotel lists for 1 hour
 */
export async function hotelListCache(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!redisClient.isReady()) {
    next();
    return;
  }

  const startTime = Date.now();
  const cacheKey = generateCacheKey('list', req.query);

  try {
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      const cached = JSON.parse(cachedData);
      res.set('X-Cache', 'HIT');
      res.set('X-Response-Time', `${Date.now() - startTime}ms`);
      console.log(`[HotelCache] HIT for list - ${Date.now() - startTime}ms`);
      res.status(200).json(cached.data);
      return;
    }

    res.set('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          data: body,
          cachedAt: new Date().toISOString(),
        };

        redisClient
          .set(cacheKey, JSON.stringify(cacheData), CACHE_TTL.HOTEL_LIST)
          .catch((err) => console.error('[HotelCache] Cache set error:', err));
      }

      res.set('X-Response-Time', `${Date.now() - startTime}ms`);
      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error('[HotelCache] Error:', error);
    next();
  }
}

/**
 * Cache invalidation helper for hotels
 */
export class HotelCacheInvalidator {
  static async invalidateSearch(): Promise<number> {
    try {
      const client = redisClient.getClient();
      if (!client) return 0;

      const keys = await client.keys(`${CACHE_PREFIX}search:*`);
      if (keys.length === 0) return 0;

      await client.del(keys);
      console.log(`[HotelCache] Invalidated ${keys.length} search cache entries`);
      return keys.length;
    } catch (error) {
      console.error('[HotelCache] Invalidation error:', error);
      return 0;
    }
  }

  static async invalidateAll(): Promise<number> {
    try {
      const client = redisClient.getClient();
      if (!client) return 0;

      const keys = await client.keys(`${CACHE_PREFIX}*`);
      if (keys.length === 0) return 0;

      await client.del(keys);
      console.log(`[HotelCache] Invalidated ${keys.length} total cache entries`);
      return keys.length;
    } catch (error) {
      console.error('[HotelCache] Invalidation error:', error);
      return 0;
    }
  }
}

export default {
  hotelSearchCache,
  hotelDetailsCache,
  hotelListCache,
  HotelCacheInvalidator,
  CACHE_TTL,
};
