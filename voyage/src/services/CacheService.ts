import Redis from 'ioredis';
import { config } from '@/config/environment';

/**
 * CacheService - Redis-based caching for Amadeus API responses
 * Ticket: DR-65US-VOYAGE-004 - Cache des Requêtes Amadeus
 *
 * Features:
 * - Automatic serialization/deserialization
 * - Configurable TTL per cache type
 * - Cache key generation with hashing
 * - Error handling with fallback
 * - Cache statistics tracking
 */
class CacheService {
  private redis: Redis;
  private isConnected = false;
  private cacheHits = 0;
  private cacheMisses = 0;

  // TTL configurations (in seconds)
  private readonly TTL_CONFIG = {
    // Flight data changes frequently - short TTL
    flights: 5 * 60, // 5 minutes
    flightOffers: 3 * 60, // 3 minutes

    // Location data is relatively static
    locations: 24 * 60 * 60, // 24 hours
    airports: 24 * 60 * 60, // 24 hours
    airlines: 7 * 24 * 60 * 60, // 7 days

    // Hotel data changes moderately
    hotels: 30 * 60, // 30 minutes
    hotelOffers: 15 * 60, // 15 minutes
    hotelDetails: 60 * 60, // 1 hour

    // Analytics and price data
    flightPrices: 60 * 60, // 1 hour
    analytics: 2 * 60 * 60, // 2 hours

    // Transfer and activity data
    transfers: 30 * 60, // 30 minutes
    activities: 60 * 60, // 1 hour

    // Default fallback
    default: 10 * 60, // 10 minutes
  };

  constructor() {
    try {
      this.redis = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err: Error) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (error: Error) => {
        console.error('❌ Redis connection error:', error.message);
        this.isConnected = false;
      });

      this.redis.on('ready', () => {
        console.log('✅ Redis is ready to accept commands');
        this.isConnected = true;
      });

      this.redis.on('close', () => {
        console.warn('⚠️ Redis connection closed');
        this.isConnected = false;
      });
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Generate a cache key from parameters
   */
  private generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    const paramsString = JSON.stringify(sortedParams);
    return `amadeus:${prefix}:${this.hashString(paramsString)}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get TTL for a specific cache type
   */
  private getTTL(cacheType: keyof typeof this.TTL_CONFIG): number {
    return this.TTL_CONFIG[cacheType] || this.TTL_CONFIG.default;
  }

  /**
   * Get data from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache read');
      return null;
    }

    try {
      const data = await this.redis.get(key);
      if (data) {
        this.cacheHits++;
        return JSON.parse(data) as T;
      }
      this.cacheMisses++;
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      this.cacheMisses++;
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache write');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('Cache write error:', error);
      return false;
    }
  }

  /**
   * Delete a specific cache entry
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries matching a pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error('Cache clear error:', error);
      return 0;
    }
  }

  /**
   * Generic cache wrapper for API calls
   */
  async cacheWrapper<T>(
    cacheType: keyof typeof this.TTL_CONFIG,
    params: Record<string, any>,
    apiCall: () => Promise<T>
  ): Promise<T> {
    const key = this.generateKey(cacheType, params);

    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached) {
      console.log(`✅ Cache HIT for ${cacheType}:`, key);
      return cached;
    }

    console.log(`❌ Cache MISS for ${cacheType}:`, key);

    // Call API
    const data = await apiCall();

    // Store in cache
    const ttl = this.getTTL(cacheType);
    await this.set(key, data, ttl);

    return data;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      connected: this.isConnected,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      total,
      hitRate: hitRate.toFixed(2) + '%',
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
      console.log('Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }

  /**
   * Ping Redis to check connection
   */
  async ping(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  }
}

export default new CacheService();
