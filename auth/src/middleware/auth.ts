import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@dreamscape/db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export interface DecodedToken {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    const blacklistedToken = await prisma.tokenBlacklist.findUnique({
      where: { token }
    });

    if (blacklistedToken) {
      res.status(401).json({ 
        success: false, 
        message: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ 
        success: false, 
        message: 'JWT secret not configured' 
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as DecodedToken;

    if (decoded.type !== 'access') {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true}
    });

    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
      return;
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ 
        success: false, 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    console.error('Authentication error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const blacklistedToken = await prisma.tokenBlacklist.findUnique({
      where: { token }
    });

    if (blacklistedToken) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as DecodedToken;

    if (decoded.type === 'access') {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      });

      if (user) {
        req.user = { id: user.id, email: user.email };
      }
    }

    next();
  } catch (error) {
    next();
  }
};

export const authenticateRefreshToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ 
        success: false, 
        message: 'Refresh token required',
        code: 'REFRESH_TOKEN_MISSING'
      });
      return;
    }

    const jwtSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ 
        success: false, 
        message: 'JWT secret not configured' 
      });
      return;
    }

    const decoded = jwt.verify(refreshToken, jwtSecret) as DecodedToken;

    if (decoded.type !== 'refresh') {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid refresh token type',
        code: 'INVALID_REFRESH_TOKEN'
      });
      return;
    }

    const sessionRecord = await prisma.session.findFirst({
      where: { 
        token: refreshToken,
        userId: decoded.userId,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (!sessionRecord) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
      return;
    }

    req.user = { id: sessionRecord.user.id, email: sessionRecord.user.email };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ 
        success: false, 
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
      return;
    }

    console.error('Refresh token authentication error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};