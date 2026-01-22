import { Router, Request, Response } from 'express';
import {
  HealthChecker,
  ComponentType,
  HealthStatus,
} from '../../../shared/health';
import { prisma } from '@dreamscape/db';

const router = Router();

/**
 * Health Check Configuration - INFRA-013.1
 * User Service health checks
 */
const createHealthChecker = () => {
  return new HealthChecker({
    serviceName: 'user-service',
    serviceVersion: process.env.npm_package_version || '1.0.0',
    includeMetadata: true,
    checks: [
      // PostgreSQL - CRITICAL
      {
        name: 'PostgreSQL',
        type: ComponentType.DATABASE,
        critical: true,
        timeout: 3000,
        check: async () => {
          try {
            const startTime = Date.now();
            await prisma.$queryRaw`SELECT 1 AS health_check`;
            const responseTime = Date.now() - startTime;

            return {
              name: 'PostgreSQL',
              type: ComponentType.DATABASE,
              status: HealthStatus.HEALTHY,
              message: 'PostgreSQL connection successful',
              responseTime,
              timestamp: new Date(),
              details: {
                connected: true,
                responseTime,
              },
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              name: 'PostgreSQL',
              type: ComponentType.DATABASE,
              status: HealthStatus.UNHEALTHY,
              message: `PostgreSQL connection failed: ${errorMessage}`,
              timestamp: new Date(),
              details: {
                connected: false,
                error: errorMessage,
              },
            };
          }
        },
      },
      // Filesystem check for uploads directory
      {
        name: 'Uploads Directory',
        type: ComponentType.FILESYSTEM,
        critical: false,
        timeout: 2000,
        check: async () => {
          try {
            const fs = await import('fs/promises');
            const startTime = Date.now();
            await fs.access('uploads/avatars');
            const responseTime = Date.now() - startTime;

            return {
              name: 'Uploads Directory',
              type: ComponentType.FILESYSTEM,
              status: HealthStatus.HEALTHY,
              message: 'Uploads directory accessible',
              responseTime,
              timestamp: new Date(),
              details: {
                path: 'uploads/avatars',
                accessible: true,
                responseTime,
              },
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              name: 'Uploads Directory',
              type: ComponentType.FILESYSTEM,
              status: HealthStatus.DEGRADED,
              message: `Uploads directory not accessible: ${errorMessage}`,
              timestamp: new Date(),
              details: {
                path: 'uploads/avatars',
                accessible: false,
                error: errorMessage,
              },
            };
          }
        },
      },
    ],
  });
};

/**
 * GET /health
 * Full health check endpoint - INFRA-013.1
 *
 * Returns:
 * - 200: All critical services healthy
 * - 206: Critical services healthy, optional services degraded
 * - 503: Critical services unhealthy
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const healthChecker = createHealthChecker();
    const healthReport = await healthChecker.performHealthCheck(5000);

    const statusCode = HealthChecker.getHttpStatus(healthReport.status);
    const totalTime = Date.now() - startTime;

    console.log(
      `🏥 [User] Health check completed in ${totalTime}ms - Status: ${healthReport.status}`
    );

    res.status(statusCode).json(healthReport);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`💥 [User] Health check failed in ${totalTime}ms:`, error);

    res.status(500).json({
      status: 'error',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

/**
 * GET /health/live
 * Liveness probe - INFRA-013.1
 * Simple check if the service is alive
 *
 * Returns:
 * - 200: Service is running
 */
router.get('/live', (req: Request, res: Response): void => {
  res.status(200).json({
    alive: true,
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

/**
 * GET /health/ready
 * Readiness probe - INFRA-013.1
 * Check if service is ready to accept traffic
 *
 * Returns:
 * - 200: Service ready
 * - 503: Service not ready
 */
router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    // Vérifier que PostgreSQL est accessible
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      ready: true,
      service: 'user-service',
      timestamp: new Date().toISOString(),
      dependencies: {
        postgresql: true,
      },
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      service: 'user-service',
      timestamp: new Date().toISOString(),
      reason: 'PostgreSQL not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      dependencies: {
        postgresql: false,
      },
    });
  }
});

export default router;
