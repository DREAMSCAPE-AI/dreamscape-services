import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
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

    const decoded = jwt.verify(token, jwtSecret) as { 
      userId: string; 
      email: string; 
    };

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true }
    });

    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
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

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as { 
      userId: string; 
      email: string; 
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true }
    });

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // For optional auth, we don't return errors, just continue without user
    next();
  }
};
