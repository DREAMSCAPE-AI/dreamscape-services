import { Request, Response, NextFunction } from 'express';
import config from '../config';

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({ success: false, message: 'API key is missing' });
    return;
  }

  if (apiKey !== config.auth.apiKey) {
    res.status(401).json({ success: false, message: 'Invalid API key' });
    return;
  }

  next();
};