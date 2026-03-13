import rateLimit from 'express-rate-limit';
import config from '../config';

export const mailRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many email requests, please try again later',
  },
});
