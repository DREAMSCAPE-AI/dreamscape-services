/**
 * US-IA-014 - Admin API Routes
 *
 * Admin endpoints for A/B testing control and ML model management.
 *
 * Routes:
 * - GET /admin/ab-test/status - Get current A/B test config
 * - POST /admin/ab-test/ml-split - Update ML split percentage
 * - POST /admin/ab-test/toggle - Enable/disable A/B testing
 * - GET /admin/ml/status - Get ML service status
 * - POST /admin/ml/circuit-reset - Reset circuit breaker
 *
 * @module routes
 * @ticket US-IA-014
 */

import { Router, Request, Response } from 'express';
import { getABTestingService } from '../services/ABTestingService';
import { getMLClient } from '../services/MLGrpcClient';

const router = Router();

// ==========================================================================
// A/B TESTING ENDPOINTS
// ==========================================================================

/**
 * GET /admin/ab-test/status
 *
 * Get current A/B testing configuration.
 *
 * Response:
 * {
 *   "testName": "ml_vs_rulebased_v1",
 *   "enabled": true,
 *   "mlSplitPercent": 50,
 *   "ruleBasedPercent": 50
 * }
 */
router.get('/ab-test/status', (req: Request, res: Response) => {
  try {
    const abService = getABTestingService();
    const summary = abService.getSummary();

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('[Admin] Failed to get A/B test status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /admin/ab-test/ml-split
 *
 * Update ML model split percentage.
 *
 * Body:
 * {
 *   "splitPercent": 75  // 0-100
 * }
 *
 * Use cases:
 * - Gradual rollout: 10% → 25% → 50% → 100%
 * - Rollback: 100% → 0% (disable ML)
 * - 50/50 split for A/B testing
 */
router.post('/ab-test/ml-split', (req: Request, res: Response) => {
  try {
    const { splitPercent } = req.body;

    if (typeof splitPercent !== 'number' || splitPercent < 0 || splitPercent > 100) {
      return res.status(400).json({
        success: false,
        error: 'splitPercent must be a number between 0 and 100',
      });
    }

    const abService = getABTestingService();
    abService.updateMLSplit(splitPercent);

    res.status(200).json({
      success: true,
      message: `ML split updated to ${splitPercent}%`,
      data: abService.getSummary(),
    });
  } catch (error: any) {
    console.error('[Admin] Failed to update ML split:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /admin/ab-test/toggle
 *
 * Enable or disable A/B testing globally.
 *
 * Body:
 * {
 *   "enabled": false
 * }
 *
 * When disabled, all users get rule-based recommendations.
 */
router.post('/ab-test/toggle', (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean',
      });
    }

    const abService = getABTestingService();
    abService.setEnabled(enabled);

    res.status(200).json({
      success: true,
      message: `A/B testing ${enabled ? 'enabled' : 'disabled'}`,
      data: abService.getSummary(),
    });
  } catch (error: any) {
    console.error('[Admin] Failed to toggle A/B testing:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==========================================================================
// ML SERVICE MANAGEMENT
// ==========================================================================

/**
 * GET /admin/ml/status
 *
 * Get ML gRPC service status.
 *
 * Response:
 * {
 *   "circuitState": "CLOSED",
 *   "serviceHealthy": true,
 *   "modelReady": true,
 *   "cacheConnected": true,
 *   "uptimeSeconds": 3600
 * }
 */
router.get('/ml/status', async (req: Request, res: Response) => {
  try {
    const mlClient = getMLClient();

    // Get circuit breaker state
    const circuitState = mlClient.getCircuitState();

    // Health check
    let healthStatus;
    try {
      healthStatus = await mlClient.healthCheck();
    } catch (error: any) {
      healthStatus = {
        healthy: false,
        modelReady: false,
        cacheConnected: false,
        uptimeSeconds: 0,
        error: error.message,
      };
    }

    res.status(200).json({
      success: true,
      data: {
        circuitState,
        ...healthStatus,
      },
    });
  } catch (error: any) {
    console.error('[Admin] Failed to get ML status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /admin/ml/circuit-reset
 *
 * Manually reset circuit breaker.
 *
 * Use case: Service recovered but circuit still OPEN.
 */
router.post('/ml/circuit-reset', (req: Request, res: Response) => {
  try {
    const mlClient = getMLClient();
    mlClient.resetCircuit();

    res.status(200).json({
      success: true,
      message: 'Circuit breaker reset successfully',
      data: {
        circuitState: mlClient.getCircuitState(),
      },
    });
  } catch (error: any) {
    console.error('[Admin] Failed to reset circuit breaker:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /admin/ml/model-info
 *
 * Get information about loaded ML model.
 */
router.get('/ml/model-info', async (req: Request, res: Response) => {
  try {
    const mlClient = getMLClient();
    const modelInfo = await mlClient.getModelInfo();

    res.status(200).json({
      success: true,
      data: modelInfo,
    });
  } catch (error: any) {
    console.error('[Admin] Failed to get model info:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
