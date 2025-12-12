/**
 * Prometheus Metrics Configuration - INFRA-013.2
 *
 * This module configures Prometheus metrics for the Voyage Service.
 * Metrics exposed via /metrics endpoint for Prometheus scraping.
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register metrics
export const register = new Registry();

// Add default labels to all metrics
register.setDefaultLabels({
  service: 'voyage-service',
  environment: process.env.NODE_ENV || 'development',
});

// Collect default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({
  register,
  prefix: 'dreamscape_voyage_',
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
// Business Metrics - Voyage Specific
// ============================================

/**
 * Voyage operations counter
 */
export const voyageOperationsTotal = new Counter({
  name: 'voyage_operations_total',
  help: 'Total number of voyage operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

/**
 * Flight searches counter
 */
export const flightSearchesTotal = new Counter({
  name: 'flight_searches_total',
  help: 'Total number of flight searches',
  labelNames: ['origin', 'destination', 'status'],
  registers: [register],
});

/**
 * Hotel searches counter
 */
export const hotelSearchesTotal = new Counter({
  name: 'hotel_searches_total',
  help: 'Total number of hotel searches',
  labelNames: ['city', 'status'],
  registers: [register],
});

/**
 * Bookings counter
 */
export const bookingsTotal = new Counter({
  name: 'bookings_total',
  help: 'Total number of bookings',
  labelNames: ['type', 'status'],
  registers: [register],
});

/**
 * External API calls counter (Amadeus, etc.)
 */
export const externalApiCallsTotal = new Counter({
  name: 'external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['provider', 'endpoint', 'status'],
  registers: [register],
});

/**
 * External API latency histogram
 */
export const externalApiLatency = new Histogram({
  name: 'external_api_latency_seconds',
  help: 'Latency of external API calls',
  labelNames: ['provider', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
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
