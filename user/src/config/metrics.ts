/**
 * Prometheus Metrics Configuration - INFRA-013.2
 *
 * This module configures Prometheus metrics for the User Service.
 * Metrics exposed via /metrics endpoint for Prometheus scraping.
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register metrics
export const register = new Registry();

// Add default labels to all metrics
register.setDefaultLabels({
  service: 'user-service',
  environment: process.env.NODE_ENV || 'development',
});

// Collect default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({
  register,
  prefix: 'dreamscape_user_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ============================================
// HTTP Request Metrics
// ============================================

/**
 * Total number of HTTP requests
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/**
 * Duration of HTTP requests in seconds
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

/**
 * Size of HTTP requests in bytes
 */
export const httpRequestSizeBytes = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

/**
 * Size of HTTP responses in bytes
 */
export const httpResponseSizeBytes = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// ============================================
// Health Check Metrics
// ============================================

/**
 * Health check status (1 = healthy, 0 = unhealthy)
 */
export const healthCheckStatus = new Gauge({
  name: 'health_check_status',
  help: 'Health check status (1 = healthy, 0 = unhealthy)',
  labelNames: ['check_name', 'check_type'],
  registers: [register],
});

/**
 * Health check duration in seconds
 */
export const healthCheckDuration = new Histogram({
  name: 'health_check_duration_seconds',
  help: 'Duration of health checks in seconds',
  labelNames: ['check_name', 'status'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * Health check execution counter
 */
export const healthCheckExecutions = new Counter({
  name: 'health_check_executions_total',
  help: 'Total number of health check executions',
  labelNames: ['check_name', 'status'],
  registers: [register],
});

// ============================================
// Database Metrics
// ============================================

/**
 * Database query duration in seconds
 */
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * Database connection status (1 = connected, 0 = disconnected)
 */
export const dbConnectionStatus = new Gauge({
  name: 'db_connection_status',
  help: 'Database connection status (1 = connected, 0 = disconnected)',
  labelNames: ['database'],
  registers: [register],
});

/**
 * Total database queries executed
 */
export const dbQueriesTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries executed',
  labelNames: ['operation', 'model', 'status'],
  registers: [register],
});

// ============================================
// Business Metrics
// ============================================

/**
 * User operations counter
 */
export const userOperationsTotal = new Counter({
  name: 'user_operations_total',
  help: 'Total number of user operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

/**
 * Active users gauge
 */
export const activeUsersGauge = new Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
  registers: [register],
});

/**
 * Profile operations counter
 */
export const profileOperationsTotal = new Counter({
  name: 'profile_operations_total',
  help: 'Total number of profile operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// ============================================
// Error Metrics
// ============================================

/**
 * Application errors counter
 */
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of application errors',
  labelNames: ['type', 'route'],
  registers: [register],
});

/**
 * Unhandled errors counter
 */
export const unhandledErrorsTotal = new Counter({
  name: 'unhandled_errors_total',
  help: 'Total number of unhandled errors',
  labelNames: ['type'],
  registers: [register],
});

// ============================================
// Service Status Metrics
// ============================================

/**
 * Service uptime in seconds
 */
const serviceStartTime = Date.now();
export const serviceUptime = new Gauge({
  name: 'service_uptime_seconds',
  help: 'Service uptime in seconds',
  registers: [register],
  collect() {
    this.set((Date.now() - serviceStartTime) / 1000);
  },
});

/**
 * Service info (version, etc.)
 */
export const serviceInfo = new Gauge({
  name: 'service_info',
  help: 'Service information',
  labelNames: ['version', 'node_version'],
  registers: [register],
});

// Set service info
serviceInfo.labels({
  version: process.env.npm_package_version || '1.0.0',
  node_version: process.version,
}).set(1);
