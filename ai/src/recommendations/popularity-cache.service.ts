/**
 * Popularity Cache Service
 *
 * Manages Redis caching for popularity-based recommendations
 * to avoid expensive recalculations on every request.
 *
 * Cache structure:
 * - popularity:top:global → Top 50 global destinations
 * - popularity:top:segment:{segment} → Top 30 per segment
 * - popularity:top:category:{category} → Top 20 per category
 * - popularity:scores:all → Complete scores map
 * - popularity:metadata → Cache metadata
 *
 * @module recommendations/popularity-cache
 */

import Redis from 'ioredis';
import { UserSegment } from '../segments/types/segment.types';
import { PopularityCacheMetadata } from './types/popularity.types';

export class PopularityCacheService {
  private redis: Redis;

  // TTL values (seconds)
  private readonly TTL_GLOBAL = 86400; // 24 hours
  private readonly TTL_SEGMENT = 43200; // 12 hours
  private readonly TTL_CATEGORY = 43200; // 12 hours
  private readonly TTL_SCORES = 86400; // 24 hours

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

    this.redis.on('connect', () => {
      console.log('✓ Redis connected (Popularity Cache)');
    });

    this.redis.on('error', (err) => {
      console.error('✗ Redis error:', err);
    });
  }

  /**
   * Cache top global destinations
   */
  async cacheTopDestinations(destinations: any[], ttl?: number): Promise<void> {
    const key = 'popularity:top:global';
    await this.redis.setex(key, ttl || this.TTL_GLOBAL, JSON.stringify(destinations));
    await this.updateMetadata({ itemCount: destinations.length, scope: 'global' });
  }

  /**
   * Get cached top global destinations
   */
  async getTopDestinations(): Promise<any[] | null> {
    const key = 'popularity:top:global';
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache top destinations for a specific segment
   */
  async cacheTopBySegment(segment: UserSegment, destinations: any[]): Promise<void> {
    const key = `popularity:top:segment:${segment}`;
    await this.redis.setex(key, this.TTL_SEGMENT, JSON.stringify(destinations));
  }

  /**
   * Get cached top destinations for segment
   */
  async getTopBySegment(segment: UserSegment): Promise<any[] | null> {
    const key = `popularity:top:segment:${segment}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache top destinations by category
   */
  async cacheTopByCategory(category: string, destinations: any[]): Promise<void> {
    const key = `popularity:top:category:${category}`;
    await this.redis.setex(key, this.TTL_CATEGORY, JSON.stringify(destinations));
  }

  /**
   * Get cached top destinations by category
   */
  async getTopByCategory(category: string): Promise<any[] | null> {
    const key = `popularity:top:category:${category}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache complete popularity scores map
   */
  async cacheAllScores(scores: Map<string, number>): Promise<void> {
    const key = 'popularity:scores:all';
    const obj = Object.fromEntries(scores);
    await this.redis.setex(key, this.TTL_SCORES, JSON.stringify(obj));
  }

  /**
   * Get cached scores map
   */
  async getAllScores(): Promise<Map<string, number> | null> {
    const key = 'popularity:scores:all';
    const cached = await this.redis.get(key);
    if (!cached) return null;

    const obj = JSON.parse(cached);
    return new Map(Object.entries(obj).map(([k, v]) => [k, v as number]));
  }

  /**
   * Invalidate a specific destination cache
   */
  async invalidateDestination(destinationId: string): Promise<void> {
    // This destination might be in any cache, so invalidate all
    await this.invalidateAll();
  }

  /**
   * Invalidate segment cache
   */
  async invalidateSegment(segment: UserSegment): Promise<void> {
    const key = `popularity:top:segment:${segment}`;
    await this.redis.del(key);
  }

  /**
   * Invalidate category cache
   */
  async invalidateCategory(category: string): Promise<void> {
    const key = `popularity:top:category:${category}`;
    await this.redis.del(key);
  }

  /**
   * Invalidate all popularity caches
   */
  async invalidateAll(): Promise<void> {
    const keys = await this.redis.keys('popularity:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
      console.log(`✓ Invalidated ${keys.length} popularity cache keys`);
    }
  }

  /**
   * Warm up cache with fresh data
   *
   * Called by RefreshPopularityJob after score recalculation
   */
  async warmupCache(popularityService: any): Promise<void> {
    console.log('[Cache Warmup] Starting...');
    const startTime = Date.now();

    try {
      // 1. Cache global top 50
      const globalTop = await popularityService.getTopDestinations(50);
      await this.cacheTopDestinations(globalTop);
      console.log(`  ✓ Cached ${globalTop.length} global destinations`);

      // 2. Cache top per segment (all 8 segments)
      const segments = Object.values(UserSegment);
      for (const segment of segments) {
        const segmentTop = await popularityService.getTopBySegment(segment, 30);
        await this.cacheTopBySegment(segment, segmentTop);
      }
      console.log(`  ✓ Cached ${segments.length} segment caches`);

      // 3. Cache popular categories
      const categories = ['BEACH', 'CITY', 'MOUNTAIN', 'NATURE', 'CULTURAL'];
      for (const category of categories) {
        const categoryTop = await popularityService.getTopByCategory(category, 20);
        await this.cacheTopByCategory(category, categoryTop);
      }
      console.log(`  ✓ Cached ${categories.length} category caches`);

      const duration = Date.now() - startTime;
      console.log(`[Cache Warmup] ✓ Completed in ${duration}ms`);
    } catch (error) {
      console.error('[Cache Warmup] ✗ Error:', error);
      throw error;
    }
  }

  /**
   * Get cache metadata
   */
  async getMetadata(): Promise<PopularityCacheMetadata | null> {
    const key = 'popularity:metadata';
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Update cache metadata
   */
  private async updateMetadata(update: Partial<PopularityCacheMetadata>): Promise<void> {
    const key = 'popularity:metadata';
    const existing = await this.getMetadata();

    const metadata: PopularityCacheMetadata = {
      lastUpdated: new Date(),
      ttl: this.TTL_GLOBAL,
      itemCount: update.itemCount || existing?.itemCount || 0,
      algorithmVersion: '1.0.0',
      ...update,
    };

    await this.redis.setex(key, this.TTL_GLOBAL, JSON.stringify(metadata));
  }

  /**
   * Calculate cache hit rate
   */
  async calculateHitRate(): Promise<number> {
    const info = await this.redis.info('stats');
    const lines = info.split('\r\n');

    let hits = 0;
    let misses = 0;

    for (const line of lines) {
      if (line.startsWith('keyspace_hits:')) {
        hits = parseInt(line.split(':')[1]);
      }
      if (line.startsWith('keyspace_misses:')) {
        misses = parseInt(line.split(':')[1]);
      }
    }

    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    keys: number;
    memory: string;
    hitRate: number;
    metadata: PopularityCacheMetadata | null;
  }> {
    const keys = await this.redis.keys('popularity:*');
    const info = await this.redis.info('memory');
    const memoryLine = info.split('\r\n').find((l) => l.startsWith('used_memory_human:'));
    const memory = memoryLine ? memoryLine.split(':')[1] : 'unknown';
    const hitRate = await this.calculateHitRate();
    const metadata = await this.getMetadata();

    return {
      keys: keys.length,
      memory,
      hitRate,
      metadata,
    };
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
