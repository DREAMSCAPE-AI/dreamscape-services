import { Router, Request, Response } from 'express';
import DatabaseService, { type DatabaseHealth } from '../database/DatabaseService';

const router = Router();

// Types pour les réponses API
interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    api: {
      status: 'healthy';
      uptime: number;
      version: string;
      environment: string;
    };
    postgresql: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      connected: boolean;
      error?: string;
    };
  };
  overall: {
    ready: boolean;
    critical_services_up: boolean;
  };
}

interface ErrorResponse {
  status: 'error';
  timestamp: string;
  error: string;
  services: {
    api: {
      status: 'healthy';
      uptime: number;
      version: string;
      environment: string;
    };
    postgresql: {
      status: 'unhealthy';
      connected: boolean;
    };
  };
}

/**
 * Health check endpoint
 * GET /api/health
 * 
 * Status Codes:
 * - 200: All critical services healthy
 * - 206: Critical services healthy, optional services degraded  
 * - 503: Critical services unhealthy
 * - 500: Health check failed
 */
router.get('/', async (req: Request, res: Response<HealthResponse | ErrorResponse>): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const dbService = DatabaseService.getInstance();
    
    // Check if service is ready
    const readiness = dbService.isReady();
    if (!readiness.ready) {
      const errorResponse: ErrorResponse = {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Database service not initialized',
        services: {
          api: {
            status: 'healthy',
            uptime: Math.round(process.uptime()),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
          },
          postgresql: {
            status: 'unhealthy',
            connected: false
          }
        }
      };
      res.status(503).json(errorResponse);
      return;
    }

    // Perform health checks with timeout
    const dbHealth: DatabaseHealth = await dbService.healthCheck(3000);
    
    // Determine overall status
    let overallStatus: HealthResponse['status'] = 'healthy';
    let statusCode = 200;

    if (!dbHealth.postgresql) {
      overallStatus = 'unhealthy';
      statusCode = 503;
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'healthy',
          uptime: Math.round(process.uptime()),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        },
        postgresql: {
          status: dbHealth.details.postgresql.status,
          responseTime: dbHealth.details.postgresql.responseTime,
          connected: dbHealth.details.postgresql.connected,
          error: dbHealth.details.postgresql.error
        }
      },
      overall: {
        ready: dbHealth.overall,
        critical_services_up: dbHealth.postgresql
      }
    };

    const totalTime = Date.now() - startTime;
    console.log(`🏥 Health check completed in ${totalTime}ms - Status: ${overallStatus}`);
    
    res.status(statusCode).json(response);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const totalTime = Date.now() - startTime;
    
    console.error(`💥 Health check failed in ${totalTime}ms:`, errorMessage);
    
    const errorResponse: ErrorResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: {
        api: {
          status: 'healthy',
          uptime: Math.round(process.uptime()),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        },
        postgresql: {
          status: 'unhealthy',
          connected: false
        }
      }
    };

    res.status(500).json(errorResponse);
  }
});

/**
 * Readiness probe endpoint
 * GET /api/health/ready
 * 
 * Simple check if the service is ready to accept traffic
 */
router.get('/ready', (req: Request, res: Response): void => {
  try {
    const dbService = DatabaseService.getInstance();
    const readiness = dbService.isReady();
    
    if (readiness.ready) {
      res.status(200).json({
        ready: true,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        reason: 'Database not ready'
      });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      reason: 'Service not initialized'
    });
  }
});

/**
 * Liveness probe endpoint  
 * GET /api/health/live
 * 
 * Simple check if the service is alive
 */
router.get('/live', (req: Request, res: Response): void => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime())
  });
});

export default router;