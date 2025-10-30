import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';
import * as jwt from 'jsonwebtoken';

interface SessionData {
  userId: string;
  email: string;
  createdAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

export class SessionManager {
  /**
   * Create a new session in Redis
   */
  static async createSession(
    userId: string,
    email: string,
    token: string,
    req: Request
  ): Promise<boolean> {
    try {
      const sessionData: SessionData = {
        userId,
        email,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      const sessionKey = `${SESSION_PREFIX}${token}`;
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

      // Store session data
      const stored = await redisClient.set(
        sessionKey,
        JSON.stringify(sessionData),
        SESSION_TTL
      );

      if (!stored) {
        return false;
      }

      // Add token to user's session set
      const client = redisClient.getClient();
      if (client) {
        await client.sAdd(userSessionsKey, token);
        await redisClient.expire(userSessionsKey, SESSION_TTL);
      }

      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      return false;
    }
  }

  /**
   * Get session data from Redis
   */
  static async getSession(token: string): Promise<SessionData | null> {
    try {
      const sessionKey = `${SESSION_PREFIX}${token}`;
      const data = await redisClient.get(sessionKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as SessionData;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Update session last activity timestamp
   */
  static async updateSessionActivity(token: string): Promise<boolean> {
    try {
      const sessionData = await this.getSession(token);

      if (!sessionData) {
        return false;
      }

      sessionData.lastActivity = Date.now();
      const sessionKey = `${SESSION_PREFIX}${token}`;

      return await redisClient.set(
        sessionKey,
        JSON.stringify(sessionData),
        SESSION_TTL
      );
    } catch (error) {
      console.error('Error updating session activity:', error);
      return false;
    }
  }

  /**
   * Delete a specific session
   */
  static async deleteSession(token: string, userId?: string): Promise<boolean> {
    try {
      const sessionKey = `${SESSION_PREFIX}${token}`;

      // If userId not provided, get it from session
      if (!userId) {
        const sessionData = await this.getSession(token);
        if (sessionData) {
          userId = sessionData.userId;
        }
      }

      // Delete session
      await redisClient.del(sessionKey);

      // Remove from user's session set
      if (userId) {
        const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
        const client = redisClient.getClient();
        if (client) {
          await client.sRem(userSessionsKey, token);
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  /**
   * Delete all sessions for a user (useful for logout all devices)
   */
  static async deleteAllUserSessions(userId: string): Promise<boolean> {
    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      const client = redisClient.getClient();

      if (!client) {
        return false;
      }

      // Get all session tokens for this user
      const tokens = await client.sMembers(userSessionsKey);

      // Delete each session
      for (const token of tokens) {
        const sessionKey = `${SESSION_PREFIX}${token}`;
        await redisClient.del(sessionKey);
      }

      // Delete the user sessions set
      await redisClient.del(userSessionsKey);

      return true;
    } catch (error) {
      console.error('Error deleting all user sessions:', error);
      return false;
    }
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      const client = redisClient.getClient();

      if (!client) {
        return [];
      }

      const tokens = await client.sMembers(userSessionsKey);
      const sessions: SessionData[] = [];

      for (const token of tokens) {
        const sessionData = await this.getSession(token);
        if (sessionData) {
          sessions.push(sessionData);
        }
      }

      return sessions;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Check if a token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const blacklistKey = `blacklist:${token}`;
      return await redisClient.exists(blacklistKey);
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false;
    }
  }

  /**
   * Blacklist a token (for logout)
   */
  static async blacklistToken(token: string, ttl?: number): Promise<boolean> {
    try {
      const blacklistKey = `blacklist:${token}`;

      // If no TTL provided, try to extract expiry from JWT
      let tokenTtl = ttl;
      if (!tokenTtl) {
        try {
          const decoded = jwt.decode(token) as any;
          if (decoded && decoded.exp) {
            const now = Math.floor(Date.now() / 1000);
            tokenTtl = decoded.exp - now;
          }
        } catch (e) {
          // If can't decode, use default TTL
          tokenTtl = SESSION_TTL;
        }
      }

      return await redisClient.set(blacklistKey, '1', tokenTtl || SESSION_TTL);
    } catch (error) {
      console.error('Error blacklisting token:', error);
      return false;
    }
  }
}

/**
 * Middleware to validate session from Redis
 */
export const validateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    // Check if token is blacklisted
    const isBlacklisted = await SessionManager.isTokenBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    // Get session data
    const sessionData = await SessionManager.getSession(token);
    if (!sessionData) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    // Update session activity
    await SessionManager.updateSessionActivity(token);

    // Attach session data to request
    (req as any).session = sessionData;

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
