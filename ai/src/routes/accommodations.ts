/**
 * Accommodation Recommendation Routes
 *
 * REST API endpoints for personalized accommodation recommendations.
 *
 * Endpoints:
 * - GET /api/v1/recommendations/accommodations - Get personalized recommendations
 * - POST /api/v1/recommendations/accommodations/interactions - Track user interactions
 * - GET /api/v1/recommendations/accommodations/status - Service health check
 *
 * @module routes/accommodations
 * @ticket US-IA-003.3
 */

import { Router, Request, Response } from 'express';
import { AccommodationRecommendationService } from '../accommodations/services/accommodation-recommendation.service';
import {
  RecommendationOptions,
  AmenityCategory,
  AccommodationCategory,
} from '../accommodations/types/accommodation-vector.types';

const router = Router();
const recommendationService = new AccommodationRecommendationService();

/**
 * GET /api/v1/recommendations/accommodations
 *
 * Get personalized accommodation recommendations
 *
 * Query Parameters:
 * - userId (required): User identifier
 * - cityCode (required): IATA city code (e.g., PAR, LON, NYC)
 * - checkInDate (required): Check-in date (YYYY-MM-DD)
 * - checkOutDate (required): Check-out date (YYYY-MM-DD)
 * - adults (required): Number of adults
 * - children (optional): Number of children
 * - rooms (optional): Number of rooms
 * - minRating (optional): Minimum rating filter (0-10)
 * - maxPrice (optional): Maximum price per night
 * - requiredAmenities (optional): Comma-separated amenity codes
 * - categories (optional): Comma-separated category codes
 * - limit (optional): Maximum results (default: 20, max: 50)
 * - diversityFactor (optional): MMR lambda (0-1, default: 0.7)
 */
router.get('/accommodations', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    // Validate required parameters
    const { userId, cityCode, checkInDate, checkOutDate, adults } = req.query;

    if (!userId || !cityCode || !checkInDate || !checkOutDate || !adults) {
      res.status(400).json({
        error: 'Missing required parameters',
        required: ['userId', 'cityCode', 'checkInDate', 'checkOutDate', 'adults'],
      });
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkInDate as string) || !dateRegex.test(checkOutDate as string)) {
      res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
      return;
    }

    // Validate check-out is after check-in
    if (new Date(checkOutDate as string) <= new Date(checkInDate as string)) {
      res.status(400).json({
        error: 'checkOutDate must be after checkInDate',
      });
      return;
    }

    // Parse optional parameters
    const children = req.query.children ? parseInt(req.query.children as string) : undefined;
    const rooms = req.query.rooms ? parseInt(req.query.rooms as string) : undefined;
    const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const diversityFactor = req.query.diversityFactor
      ? parseFloat(req.query.diversityFactor as string)
      : 0.7;

    // Validate limits
    if (limit < 1 || limit > 50) {
      res.status(400).json({
        error: 'limit must be between 1 and 50',
      });
      return;
    }

    if (diversityFactor < 0 || diversityFactor > 1) {
      res.status(400).json({
        error: 'diversityFactor must be between 0 and 1',
      });
      return;
    }

    // Parse amenities and categories
    const requiredAmenities = req.query.requiredAmenities
      ? (req.query.requiredAmenities as string).split(',').map(a => a.trim() as AmenityCategory)
      : undefined;

    const categories = req.query.categories
      ? (req.query.categories as string).split(',').map(c => c.trim() as AccommodationCategory)
      : undefined;

    // Build recommendation options
    const options: RecommendationOptions = {
      userId: userId as string,
      searchParams: {
        cityCode: cityCode as string,
        checkInDate: checkInDate as string,
        checkOutDate: checkOutDate as string,
        adults: parseInt(adults as string),
        children,
        rooms,
      },
      filters: {
        minRating,
        maxPrice,
        requiredAmenities,
        categories,
      },
      limit,
      scoring: {
        applySegmentBoost: true,
      },
      diversityFactor,
      includeExplanations: true,
    };

    // Get recommendations
    const recommendations = await recommendationService.getRecommendations(options);

    // Add request timing
    const processingTime = Date.now() - startTime;
    recommendations.metadata.processingTime = processingTime;

    // Return response
    res.json(recommendations);

    // Log successful request
    console.log(`[Accommodations] ${userId} - ${cityCode} - ${processingTime}ms - ${recommendations.count} results`);
  } catch (error: any) {
    console.error('[Accommodations] Error:', error);

    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/v1/recommendations/accommodations/interactions
 *
 * Track user interaction with accommodation recommendation
 *
 * Body:
 * - userId (required): User identifier
 * - hotelId (required): Hotel identifier
 * - interactionType (required): "view" | "click" | "book" | "like" | "dislike"
 * - timestamp (optional): Interaction timestamp (ISO 8601)
 * - searchParams (optional): Original search context
 * - rank (optional): Position in recommendations
 */
router.post('/accommodations/interactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, hotelId, interactionType } = req.body;

    // Validate required fields
    if (!userId || !hotelId || !interactionType) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'hotelId', 'interactionType'],
      });
      return;
    }

    // Validate interaction type
    const validTypes = ['view', 'click', 'book', 'like', 'dislike'];
    if (!validTypes.includes(interactionType)) {
      res.status(400).json({
        error: 'Invalid interactionType',
        valid: validTypes,
      });
      return;
    }

    // Track interaction
    await recommendationService.trackInteraction(userId, hotelId, interactionType);

    res.json({
      success: true,
      tracked: {
        userId,
        hotelId,
        interactionType,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[Interaction] ${userId} - ${interactionType} - ${hotelId}`);
  } catch (error: any) {
    console.error('[Interaction] Error:', error);

    res.status(500).json({
      error: 'Failed to track interaction',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/recommendations/accommodations/status
 *
 * Health check endpoint
 *
 * Returns service status and dependency health.
 */
router.get('/accommodations/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = await recommendationService.getStatus();

    if (status.healthy) {
      res.json(status);
    } else {
      res.status(503).json(status);
    }
  } catch (error: any) {
    res.status(500).json({
      healthy: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/recommendations/accommodations/config
 *
 * Get current configuration (admin only)
 *
 * Returns current vectorization and scoring configuration.
 */
router.get('/accommodations/config', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Add admin authentication middleware

    const config = {
      vectorization: recommendationService['vectorizer'].getConfig(),
      scoring: recommendationService['scorer'].getConfig(),
    };

    res.json(config);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get configuration',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/v1/recommendations/accommodations/config
 *
 * Update configuration (admin only)
 *
 * Allows dynamic tuning of weights and parameters.
 *
 * Body:
 * - vectorization (optional): Vectorization config updates
 * - scoring (optional): Scoring config updates
 */
router.patch('/accommodations/config', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Add admin authentication middleware

    const { vectorization, scoring } = req.body;

    if (vectorization) {
      recommendationService.updateVectorizationConfig(vectorization);
    }

    if (scoring) {
      recommendationService.updateScoringConfig(scoring);
    }

    res.json({
      success: true,
      message: 'Configuration updated',
    });

    console.log('[Config] Updated:', { vectorization, scoring });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to update configuration',
      message: error.message,
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error: Error, req: Request, res: Response, next: Function) => {
  console.error('[Accommodations] Unhandled error:', error);

  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString(),
  });
});

export default router;
