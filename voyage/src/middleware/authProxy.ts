import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

const AUTH_SERVICE_URL = process.env.VITE_AUTH_SERVICE_URL;

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
        message: 'Access token required' 
      });
      return;
    }

    // Verify token with auth-service
    const response = await axios.post(`${AUTH_SERVICE_URL}/v1/auth/verify-token`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    });

    if (response.data.success && response.data.data.user) {
      req.user = response.data.data.user;
      next();
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        res.status(401).json({ 
          success: false, 
          message: 'Invalid or expired token' 
        });
        return;
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'TIMEOUT') {
        res.status(503).json({ 
          success: false, 
          message: 'Authentication service unavailable' 
        });
        return;
      }
    }

    console.error('Auth proxy error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
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

    const response = await axios.post(`${AUTH_SERVICE_URL}/v1/auth/verify-token`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    });

    if (response.data.success && response.data.data.user) {
      req.user = response.data.data.user;
    }
  } catch (error) {
    // For optional auth, we don't return errors, just continue without user
    console.log('Optional auth failed, continuing without user');
  }
  
  next();
};