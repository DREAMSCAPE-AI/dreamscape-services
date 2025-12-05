import os from 'os';
import {
  HealthStatus,
  HealthCheckResult,
  HealthResponse,
  HealthCheck,
  HealthCheckerConfig,
} from './type';

/**
 * HealthChecker - INFRA-013.1
 * Classe centralisée pour gérer les health checks de tous les services
 */
export class HealthChecker {
  private config: HealthCheckerConfig;
  private startTime: number;

  constructor(config: HealthCheckerConfig) {
    this.config = config;
    this.startTime = Date.now();
  }

  /**
   * Exécute tous les health checks configurés
   * @param timeout - Timeout global en ms (défaut: 5000ms)
   */
  async performHealthCheck(timeout: number = 5000): Promise<HealthResponse> {
    const checkResults: HealthCheckResult[] = [];
    let overallStatus: HealthStatus = HealthStatus.HEALTHY;

    // Exécuter tous les checks en parallèle
    const checkPromises = this.config.checks.map(async (check) => {
      const result = await this.executeCheck(check);
      checkResults.push(result);
      return result;
    });

    try {
      // Attendre tous les checks avec timeout global
      await Promise.race([
        Promise.all(checkPromises),
        this.timeout(timeout, 'Global health check timeout'),
      ]);
    } catch (error) {
      console.error('Health check execution error:', error);
    }

    // Déterminer le statut global
    overallStatus = this.calculateOverallStatus(checkResults);

    // Construire la réponse
    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      service: this.config.serviceName,
      version: this.config.serviceVersion,
      checks: checkResults,
    };

    // Ajouter les métadonnées si demandé
    if (this.config.includeMetadata) {
      response.metadata = this.collectMetadata();
    }

    return response;
  }

  /**
   * Exécute un check individuel avec timeout
   */
  private async executeCheck(check: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkTimeout = check.timeout || 3000; // Timeout par défaut: 3s

    try {
      // Exécuter le check avec timeout
      const result = await Promise.race([
        check.check(),
        this.timeout(checkTimeout, `Check timeout: ${check.name}`),
      ]);

      const responseTime = Date.now() - startTime;

      return {
        name: check.name,
        status: result.status,
        type: check.type,
        responseTime,
        message: result.message,
        details: result.details,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        name: check.name,
        status: check.critical ? HealthStatus.UNHEALTHY : HealthStatus.DEGRADED,
        type: check.type,
        responseTime,
        message: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Calcule le statut global basé sur les résultats des checks
   */
  private calculateOverallStatus(results: HealthCheckResult[]): HealthStatus {
    // Si un check critique est UNHEALTHY -> service UNHEALTHY
    const criticalChecks = this.config.checks.filter((c) => c.critical);
    const criticalResults = results.filter((r) =>
      criticalChecks.some((c) => c.name === r.name)
    );

    const hasCriticalFailure = criticalResults.some(
      (r) => r.status === HealthStatus.UNHEALTHY
    );

    if (hasCriticalFailure) {
      return HealthStatus.UNHEALTHY;
    }

    // Si au moins un check est DEGRADED -> service DEGRADED
    const hasDegraded = results.some((r) => r.status === HealthStatus.DEGRADED);
    if (hasDegraded) {
      return HealthStatus.DEGRADED;
    }

    // Si tous les checks sont UNKNOWN -> service UNKNOWN
    const allUnknown = results.every((r) => r.status === HealthStatus.UNKNOWN);
    if (allUnknown && results.length > 0) {
      return HealthStatus.UNKNOWN;
    }

    // Sinon -> service HEALTHY
    return HealthStatus.HEALTHY;
  }

  /**
   * Collecte les métadonnées système
   */
  private collectMetadata() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();

    return {
      environment: process.env.NODE_ENV || 'development',
      hostname: os.hostname(),
      pid: process.pid,
      memory: {
        used: Math.round(usedMem / 1024 / 1024), // MB
        total: Math.round(totalMem / 1024 / 1024), // MB
        percentage: Math.round((usedMem / totalMem) * 100),
      },
      cpu: {
        usage: Math.round(os.loadavg()[0] * 100) / 100,
      },
    };
  }

  /**
   * Helper pour créer une Promise de timeout
   */
  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Obtenir le statut HTTP approprié basé sur le statut de santé
   */
  static getHttpStatus(healthStatus: HealthStatus): number {
    switch (healthStatus) {
      case HealthStatus.HEALTHY:
        return 200;
      case HealthStatus.DEGRADED:
        return 206; // Partial Content
      case HealthStatus.UNHEALTHY:
        return 503; // Service Unavailable
      case HealthStatus.UNKNOWN:
      default:
        return 500; // Internal Server Error
    }
  }
}

export default HealthChecker;
