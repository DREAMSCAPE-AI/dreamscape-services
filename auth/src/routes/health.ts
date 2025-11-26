import { Router, Request, Response } from 'express';
import {
  HealthChecker,
  ComponentType,
  createPostgreSQLCheck,
  createRedisCheck,
} from '../../../shared/health';
import { DatabaseService } from '../database/DatabaseService';
import redisClient from '../config/redis';
import prisma from '../database/prisma';

const router = Router();

/**
 * Health Check Configuration - INFRA-013.1
 * Auth Service health checks
 */
const createHealthChecker = () => {
  return new HealthChecker({
    serviceName: 'auth-service',
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
              status: 'healthy' as const,
              message: 'PostgreSQL connection successful',
              details: {
                connected: true,
                responseTime,
              },
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              status: 'unhealthy' as const,
              message: `PostgreSQL connection failed: ${errorMessage}`,
              details: {
                connected: false,
                error: errorMessage,
              },
            };
          }
        },
      },
      // Redis - NON-CRITICAL (dégradé si down)
      {
        name: 'Redis Cache',
        type: ComponentType.CACHE,
        critical: false,
        timeout: 2000,
        check: createRedisCheck(redisClient),
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
      `🏥 [Auth] Health check completed in ${totalTime}ms - Status: ${healthReport.status}`
    );

    res.status(statusCode).json(healthReport);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`💥 [Auth] Health check failed in ${totalTime}ms:`, error);

    res.status(500).json({
      status: 'error',
      service: 'auth-service',
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
    service: 'auth-service',
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
    const dbService = DatabaseService.getInstance();

    // Vérifier que la DB est initialisée
    const dbReady = dbService.isReady ? dbService.isReady() : false;

    // Vérifier Redis (non-critique)
    const redisReady = redisClient.isReady;

    if (dbReady) {
      res.status(200).json({
        ready: true,
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        dependencies: {
          postgresql: dbReady,
          redis: redisReady,
        },
      });
    } else {
      res.status(503).json({
        ready: false,
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        reason: 'PostgreSQL not ready',
        dependencies: {
          postgresql: dbReady,
          redis: redisReady,
        },
      });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      reason: 'Service initialization error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
