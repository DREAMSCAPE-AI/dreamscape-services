import { createClient, RedisClientType } from 'redis';

class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Redis client already connected');
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis: Too many reconnection attempts');
              return new Error('Too many reconnection attempts');
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          },
          connectTimeout: 10000,
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client connecting...');
      });

      this.client.on('ready', () => {
        console.log('Redis Client ready');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('Redis Client reconnecting...');
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('Redis Client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
        console.log('Redis client disconnected gracefully');
      } catch (error) {
        console.error('Error disconnecting Redis client:', error);
        // Force disconnect if graceful quit fails
        await this.client.disconnect();
      }
    }
  }

  public getClient(): RedisClientType | null {
    return this.client;
  }

  public isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Cache operations
  public async get(key: string): Promise<string | null> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping get operation');
      return null;
    }
    try {
      return await this.client!.get(key);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping set operation');
      return false;
    }
    try {
      if (ttl) {
        await this.client!.setEx(key, ttl, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping del operation');
      return false;
    }
    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping exists operation');
      return false;
    }
    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  public async incr(key: string): Promise<number | null> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping incr operation');
      return null;
    }
    try {
      return await this.client!.incr(key);
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error);
      return null;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping expire operation');
      return false;
    }
    try {
      await this.client!.expire(key, seconds);
      return true;
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  public async ttl(key: string): Promise<number | null> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping ttl operation');
      return null;
    }
    try {
      return await this.client!.ttl(key);
    } catch (error) {
      console.error(`Redis TTL error for key ${key}:`, error);
      return null;
    }
  }

  // Hash operations for sessions
  public async hSet(key: string, field: string, value: string): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping hSet operation');
      return false;
    }
    try {
      await this.client!.hSet(key, field, value);
      return true;
    } catch (error) {
      console.error(`Redis HSET error for key ${key}:`, error);
      return false;
    }
  }

  public async hGet(key: string, field: string): Promise<string | undefined> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping hGet operation');
      return undefined;
    }
    try {
      return await this.client!.hGet(key, field);
    } catch (error) {
      console.error(`Redis HGET error for key ${key}:`, error);
      return undefined;
    }
  }

  public async hGetAll(key: string): Promise<Record<string, string> | null> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping hGetAll operation');
      return null;
    }
    try {
      return await this.client!.hGetAll(key);
    } catch (error) {
      console.error(`Redis HGETALL error for key ${key}:`, error);
      return null;
    }
  }

  public async hDel(key: string, field: string): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping hDel operation');
      return false;
    }
    try {
      await this.client!.hDel(key, field);
      return true;
    } catch (error) {
      console.error(`Redis HDEL error for key ${key}:`, error);
      return false;
    }
  }
}

export default RedisClient.getInstance();
