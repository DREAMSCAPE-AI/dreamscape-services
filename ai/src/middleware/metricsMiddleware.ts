/**
 * Prometheus Metrics Middleware - INFRA-013.2
 *
 * This middleware automatically collects metrics for all HTTP requests.
 * Metrics are exposed via the /metrics endpoint for Prometheus scraping.
 */

import { Request, Response, NextFunction } from 'express';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSizeBytes,
  httpResponseSizeBytes,
} from '../config/metrics';

/**
 * Normalize route paths to prevent cardinality explosion
 * Example: /api/v1/ai/recommendations/123 -> /api/v1/ai/recommendations/:id
 */
function normalizeRoute(path: string): string {
  // Replace UUIDs
  let normalized = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':uuid'
  );

  // Replace numeric IDs
  normalized = normalized.replace(/\/\d+/g, '/:id');

  // Replace common patterns
  normalized = normalized.replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token');

  return normalized;
}

/**
 * Get request size in bytes
 */
function getRequestSize(req: Request): number {
  return parseInt(req.get('content-length') || '0', 10);
}

/**
 * Get response size in bytes (approximate)
 */
function getResponseSize(res: Response): number {
  return parseInt(res.get('content-length') || '0', 10);
}

/**
 * Metrics collection middleware
 *
 * Collects:
 * - Total request count
 * - Request duration
 * - Request/response sizes
 * - Status codes
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip metrics collection for /metrics endpoint itself
  if (req.path === '/metrics' || req.path.startsWith('/metrics/')) {
    return next();
  }

  // Record start time
  const startTime = Date.now();

  // Get normalized route
  const route = normalizeRoute(req.path);
  const method = req.method;

  // Record request size
  const requestSize = getRequestSize(req);
  if (requestSize > 0) {
    httpRequestSizeBytes.labels(method, route).observe(requestSize);
  }

  // Hook into response finish event
  res.on('finish', () => {
    // Calculate duration in seconds
    const duration = (Date.now() - startTime) / 1000;

    // Get status code
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestsTotal.labels(method, route, statusCode).inc();
    httpRequestDuration.labels(method, route, statusCode).observe(duration);

    // Record response size
    const responseSize = getResponseSize(res);
    if (responseSize > 0) {
      httpResponseSizeBytes.labels(method, route).observe(responseSize);
    }
  });

  next();
}

/**
 * Request logging middleware (optional, for debugging)
 * Can be enabled in development mode
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development' && req.path !== '/metrics') {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(
        `[METRICS] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      );
    });
  }

  next();
}
