import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { HealthStatus, ComponentType } from './type';

/**
 * Health Check Helpers - INFRA-013.1
 * Fonctions réutilisables pour vérifier les dépendances communes
 */

/**
 * Check PostgreSQL database connectivity
 */
export function createPostgreSQLCheck(pool: Pool, name: string = 'PostgreSQL') {
  return async () => {
    try {
      const startTime = Date.now();
      const result = await pool.query('SELECT 1 AS health_check');
      const responseTime = Date.now() - startTime;

      if (result.rows.length > 0 && result.rows[0].health_check === 1) {
        return {
          status: HealthStatus.HEALTHY,
          message: 'Database connection successful',
          details: {
            connected: true,
            responseTime,
          },
        };
      }

      return {
        status: HealthStatus.DEGRADED,
        message: 'Database query returned unexpected result',
        details: {
          connected: true,
          responseTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Database connection failed: ${errorMessage}`,
        details: {
          connected: false,
          error: errorMessage,
        },
      };
    }
  };
}

/**
 * Check Redis connectivity
 */
export function createRedisCheck(client: RedisClientType, name: string = 'Redis') {
  return async () => {
    try {
      if (!client.isReady) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'Redis client not ready',
          details: {
            connected: false,
          },
        };
      }

      const startTime = Date.now();
      const pong = await client.ping();
      const responseTime = Date.now() - startTime;

      if (pong === 'PONG') {
        return {
          status: HealthStatus.HEALTHY,
          message: 'Redis connection successful',
          details: {
            connected: true,
            responseTime,
          },
        };
      }

      return {
        status: HealthStatus.DEGRADED,
        message: 'Redis ping returned unexpected result',
        details: {
          connected: true,
          responseTime,
          response: pong,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Redis connection failed: ${errorMessage}`,
        details: {
          connected: false,
          error: errorMessage,
        },
      };
    }
  };
}

/**
 * Check MongoDB connectivity
 */
export function createMongoDBCheck(client: any, name: string = 'MongoDB') {
  return async () => {
    try {
      const startTime = Date.now();
      await client.db().admin().ping();
      const responseTime = Date.now() - startTime;

      return {
        status: HealthStatus.HEALTHY,
        message: 'MongoDB connection successful',
        details: {
          connected: true,
          responseTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: HealthStatus.UNHEALTHY,
        message: `MongoDB connection failed: ${errorMessage}`,
        details: {
          connected: false,
          error: errorMessage,
        },
      };
    }
  };
}

/**
 * Check external API availability
 */
export function createExternalAPICheck(
  url: string,
  name: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
  }
) {
  return async () => {
    const controller = new AbortController();
    const timeout = options?.timeout || 5000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        signal: controller.signal,
      });
      const responseTime = Date.now() - startTime;
      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          status: HealthStatus.HEALTHY,
          message: `${name} API is accessible`,
          details: {
            url,
            statusCode: response.status,
            responseTime,
          },
        };
      }

      return {
        status: HealthStatus.DEGRADED,
        message: `${name} API returned non-OK status`,
        details: {
          url,
          statusCode: response.status,
          responseTime,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        status: HealthStatus.UNHEALTHY,
        message: `${name} API check failed: ${errorMessage}`,
        details: {
          url,
          error: errorMessage,
        },
      };
    }
  };
}

/**
 * Check Kafka connectivity (basic)
 */
export function createKafkaCheck(producer: any, name: string = 'Kafka') {
  return async () => {
    try {
      const startTime = Date.now();
      // Simple connection check
      await producer.connect();
      const responseTime = Date.now() - startTime;

      return {
        status: HealthStatus.HEALTHY,
        message: 'Kafka connection successful',
        details: {
          connected: true,
          responseTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Kafka connection failed: ${errorMessage}`,
        details: {
          connected: false,
          error: errorMessage,
        },
      };
    }
  };
}

/**
 * Check filesystem availability
 */
export function createFileSystemCheck(path: string, name: string = 'Filesystem') {
  return async () => {
    try {
      const fs = await import('fs/promises');
      const startTime = Date.now();
      await fs.access(path);
      const responseTime = Date.now() - startTime;

      return {
        status: HealthStatus.HEALTHY,
        message: `Filesystem path accessible: ${path}`,
        details: {
          path,
          accessible: true,
          responseTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Filesystem check failed: ${errorMessage}`,
        details: {
          path,
          accessible: false,
          error: errorMessage,
        },
      };
    }
  };
}

/**
 * Create a custom check with simple function
 */
export function createCustomCheck(
  name: string,
  checkFn: () => Promise<boolean>,
  successMessage: string = 'Check passed',
  failureMessage: string = 'Check failed'
) {
  return async () => {
    try {
      const startTime = Date.now();
      const result = await checkFn();
      const responseTime = Date.now() - startTime;

      if (result) {
        return {
          status: HealthStatus.HEALTHY,
          message: successMessage,
          details: { responseTime },
        };
      }

      return {
        status: HealthStatus.UNHEALTHY,
        message: failureMessage,
        details: { responseTime },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: HealthStatus.UNHEALTHY,
        message: `${name} check error: ${errorMessage}`,
        details: { error: errorMessage },
      };
    }
  };
}
