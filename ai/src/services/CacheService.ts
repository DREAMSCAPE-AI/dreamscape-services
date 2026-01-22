/**
 * IA-001: Cache Service for Recommendations
 * Ensures API response times < 500ms by caching results
 */

import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

export class CacheService {
  private readonly TTL_RECOMMENDATIONS = 1800; // 30 minutes
  private readonly TTL_USER_VECTOR = 3600; // 1 hour
  private readonly TTL_ITEM_VECTOR = 7200; // 2 hours

  /**
   * Get cached recommendations for a user
   */
  async getRecommendations(userId: string): Promise<any[] | null> {
    try {
      const cached = await redis.get(`recommendations:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache recommendations for a user
   */
  async setRecommendations(userId: string, recommendations: any[]): Promise<void> {
    try {
      await redis.setex(
        `recommendations:${userId}`,
        this.TTL_RECOMMENDATIONS,
        JSON.stringify(recommendations)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate user recommendations cache
   */
  async invalidateUserRecommendations(userId: string): Promise<void> {
    try {
      await redis.del(`recommendations:${userId}`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Get cached user vector
   */
  async getUserVector(userId: string): Promise<number[] | null> {
    try {
      const cached = await redis.get(`user_vector:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache user vector
   */
  async setUserVector(userId: string, vector: number[]): Promise<void> {
    try {
      await redis.setex(
        `user_vector:${userId}`,
        this.TTL_USER_VECTOR,
        JSON.stringify(vector)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Get trending destinations from cache
   */
  async getTrending(): Promise<any[] | null> {
    try {
      const cached = await redis.get('trending:destinations');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache trending destinations
   */
  async setTrending(destinations: any[]): Promise<void> {
    try {
      await redis.setex(
        'trending:destinations',
        300, // 5 minutes for trending
        JSON.stringify(destinations)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Warm up cache with popular destinations
   */
  async warmUpCache(itemVectors: any[]): Promise<void> {
    try {
      // Cache top destinations
      const top = itemVectors
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, 50);

      await redis.setex(
        'cache:popular_destinations',
        this.TTL_ITEM_VECTOR,
        JSON.stringify(top)
      );

      console.log('Cache warmed up with', top.length, 'popular destinations');
    } catch (error) {
      console.error('Cache warm-up error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const info = await redis.info('stats');
      const keys = await redis.dbsize();

      return {
        totalKeys: keys,
        info,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  /**
   * Clear all recommendation caches
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await redis.keys('recommendations:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      console.log('Cleared', keys.length, 'recommendation caches');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

export default new CacheService();
