/**
 * Raw Body Middleware
 * Captures the raw request body for Stripe webhook signature verification
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to capture raw body for webhook endpoints
 * This is necessary because Stripe requires the raw body to verify signatures
 */
export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.originalUrl === '/api/v1/payment/webhook') {
    let data = '';

    req.setEncoding('utf8');

    req.on('data', (chunk: string) => {
      data += chunk;
    });

    req.on('end', () => {
      (req as any).rawBody = data;
      next();
    });
  } else {
    next();
  }
}
