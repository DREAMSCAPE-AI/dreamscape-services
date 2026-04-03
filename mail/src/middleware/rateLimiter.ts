import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import config from '../config';
import redisClient from '../config/redis';



const createRedisStore = () => {
  const client = redisClient.getClient();
  if (!client || !redisClient.isReady()) return undefined; // fallback memory
  return new RedisStore({
    sendCommand: (...args: string[]) => client.sendCommand(args),
    prefix: 'mail:rl:',
  });
};

export const createMailRateLimiter = () => {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    message: {
      success: false,
      error: 'Too many email requests, please try again later',
    },
  });
};