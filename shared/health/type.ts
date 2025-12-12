export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export enum ComponentType {
  DATABASE = 'database',
  CACHE = 'cache',
  EXTERNAL_API = 'external_api',
  FILESYSTEM = 'filesystem',
  MESSAGE_QUEUE = 'message_queue',
  INTERNAL_SERVICE = 'internal_service'
}

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  type: ComponentType;
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface HealthCheckPartialResult {
  status: HealthStatus;
  message?: string;
  details?: Record<string, any>;
}

export interface HealthResponse {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  service: string;
  version: string;
  checks: HealthCheckResult[];
  metadata?: {
    environment: string;
    hostname: string;
    pid: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu?: {
      usage: number;
    };
  };
}

export interface HealthCheck {
  name: string;
  type: ComponentType;
  critical: boolean;
  timeout?: number;
  check: () => Promise<HealthCheckPartialResult>;
}

export interface PrometheusMetrics {
  healthCheckStatus?: any; // Gauge
  healthCheckDuration?: any; // Histogram
  healthCheckExecutions?: any; // Counter
}

export interface HealthCheckerConfig {
  serviceName: string;
  serviceVersion: string;
  checks: HealthCheck[];
  includeMetadata?: boolean;
  prometheusMetrics?: PrometheusMetrics; // INFRA-013.2

}