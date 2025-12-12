/**
 * Prometheus Metrics Endpoint - INFRA-013.2
 *
 * Exposes metrics in Prometheus format for scraping.
 * This endpoint should be accessible to Prometheus but not publicly.
 */

import { Router, Request, Response } from 'express';
import { register, dbConnectionStatus } from '../config/metrics';
import prisma from '../database/prisma';

const router = Router();

/**
 * GET /metrics
 *
 * Returns Prometheus metrics in text format.
 * This endpoint is scraped by Prometheus at regular intervals.
 *
 * Response format: Prometheus exposition format
 * Content-Type: text/plain; version=0.0.4
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Update database connection status before serving metrics
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnectionStatus.labels('postgresql').set(1);
    } catch (error) {
      dbConnectionStatus.labels('postgresql').set(0);
    }

    // Set appropriate content type for Prometheus
    res.set('Content-Type', register.contentType);

    // Get all metrics
    const metrics = await register.metrics();

    // Return metrics in Prometheus format
    res.send(metrics);
  } catch (error) {
    console.error('[METRICS] Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
});

/**
 * GET /metrics/json
 *
 * Optional: Returns metrics in JSON format for debugging.
 * Not used by Prometheus, but useful for development.
 */
router.get('/json', async (req: Request, res: Response) => {
  try {
    const metrics = await register.getMetricsAsJSON();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics,
    });
  } catch (error) {
    console.error('[METRICS] Error generating JSON metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating metrics',
    });
  }
});

export default router;
