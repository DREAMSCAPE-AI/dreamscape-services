// Extend Express Request type to include user property
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
        [key: string]: any;
      };
    }
  }
}

export {};
