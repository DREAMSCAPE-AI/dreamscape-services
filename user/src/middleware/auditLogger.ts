import { Request, Response, NextFunction } from 'express';
import { prisma } from '@dreamscape/db';
import { AuthRequest } from './auth';

// Routes that should be audited for data access tracking
const AUDITED_ROUTES = [
  { path: '/api/v1/users/profile', resource: 'UserProfile' },
  { path: '/api/v1/users/favorites', resource: 'Favorite' },
  { path: '/api/v1/users/history', resource: 'UserHistory' },
  { path: '/api/v1/users/onboarding', resource: 'TravelOnboardingProfile' },
  { path: '/api/v1/users/gdpr', resource: 'GdprData' },
];

// Map HTTP methods to DataAccessAction enum values
const ACTION_MAP: Record<string, 'READ' | 'CREATE' | 'UPDATE' | 'DELETE'> = {
  GET: 'READ',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Audit Logger Middleware
 *
 * Automatically logs access to sensitive user data routes into the DataAccessLog table.
 * Logs are created asynchronously after the response completes to avoid blocking requests.
 *
 * @param req - Express request with AuthRequest interface
 * @param res - Express response
 * @param next - Express next function
 */
export const auditLogger = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Check if the request path matches any audited route
  const matchedRoute = AUDITED_ROUTES.find(route =>
    req.originalUrl.startsWith(route.path)
  );

  // Only log if route matches AND user is authenticated
  if (matchedRoute && req.user) {
    const userId = req.user.id;
    const action = ACTION_MAP[req.method] || 'READ';
    const resource = matchedRoute.resource;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const endpoint = req.originalUrl;
    const method = req.method;

    // Log after response is sent (non-blocking)
    res.on('finish', async () => {
      try {
        await prisma.dataAccessLog.create({
          data: {
            userId,
            accessorId: userId,
            accessorType: 'user',
            action,
            resource,
            ipAddress,
            userAgent,
            endpoint,
            method,
          },
        });
      } catch (error) {
        // Silently fail - never block the request due to audit logging errors
        console.error('Audit logging failed:', error);
      }
    });
  }

  // Continue with request processing immediately
  next();
};
