/**
 * IA-001: AI Recommendation System Routes
 * Provides personalized destination recommendations using ML-based scoring
 */

import { Router, Request, Response } from 'express';
import RecommendationService from '@/services/RecommendationService';
import VectorizationService from '@/services/VectorizationService';
import ScoringService from '@/services/ScoringService';
import AnalyticsService from '@/services/AnalyticsService';

const router = Router();

/**
 * POST /api/v1/recommendations/generate
 * Generate new recommendations for a user
 * IA-001.3, IA-001.4
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, contextType = 'general', limit = 10, minScore = 0.3 } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Generate recommendations
    const recommendations = await RecommendationService.generateRecommendations(userId, {
      limit,
      contextType,
      minScore,
    });

    res.json({
      userId,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    console.error('Generate recommendations error:', error);
    res.status(500).json({
      error: 'Failed to generate recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/personalized
 * Returns personalized recommendations (active) for a user
 * IA-001.4: Replaces the old mock implementation
 */
router.get('/personalized', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Get userId from JWT token in Authorization header
    const { userId, limit = '10', status, includeItemVector = 'false' } = req.query;

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    const limitNum = parseInt(limit as string, 10);
    const includeVector = includeItemVector === 'true';

    // Get active recommendations
    let recommendations = await RecommendationService.getActiveRecommendations(userId, {
      limit: limitNum,
      status: status as any,
      includeItemVector: includeVector,
    });

    // If no recommendations exist, generate them
    if (recommendations.length === 0) {
      console.log(`No recommendations found for user ${userId}, generating...`);
      recommendations = await RecommendationService.generateRecommendations(userId, {
        limit: limitNum,
        contextType: 'general',
      });
    }

    res.json({
      userId,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    console.error('Personalized recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get personalized recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/recommendations/:id/track
 * Track user interaction with a recommendation
 * IA-001.4
 */
router.post('/:id/track', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, rating } = req.body;

    if (!action || !['viewed', 'clicked', 'booked', 'rejected'].includes(action)) {
      res.status(400).json({
        error: 'Invalid action. Must be one of: viewed, clicked, booked, rejected',
      });
      return;
    }

    const recommendation = await RecommendationService.trackInteraction(id, {
      action,
      rating,
    });

    res.json({
      success: true,
      recommendation,
    });
  } catch (error) {
    console.error('Track interaction error:', error);
    res.status(500).json({
      error: 'Failed to track interaction',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/recommendations/refresh
 * Refresh user vector and regenerate recommendations
 * IA-001.2, IA-001.4
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const recommendations = await RecommendationService.refreshUserRecommendations(userId);

    res.json({
      success: true,
      userId,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    console.error('Refresh recommendations error:', error);
    res.status(500).json({
      error: 'Failed to refresh recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/trending
 * Returns trending destinations based on popularity and recent bookings
 * IA-001.3
 */
router.get('/trending', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const trending = await ScoringService.getTrendingDestinations(limitNum);

    res.json({
      count: trending.length,
      destinations: trending,
    });
  } catch (error) {
    console.error('Trending destinations error:', error);
    res.status(500).json({
      error: 'Failed to get trending destinations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/similar/:destinationId
 * Get similar destinations based on vector similarity
 * IA-001.3
 */
router.get('/similar/:destinationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { destinationId } = req.params;
    const { limit = '5' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const similar = await RecommendationService.getSimilarDestinations(
      destinationId,
      limitNum
    );

    res.json({
      destinationId,
      count: similar.length,
      similar,
    });
  } catch (error) {
    console.error('Similar destinations error:', error);
    res.status(500).json({
      error: 'Failed to get similar destinations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/analytics
 * Get analytics and metrics for the recommendation system
 * IA-001.4
 */
router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, type = 'dashboard', from, to } = req.query;

    const dateRange =
      from && to
        ? {
            from: new Date(from as string),
            to: new Date(to as string),
          }
        : undefined;

    let result;

    switch (type) {
      case 'dashboard':
        result = await AnalyticsService.getDashboardSummary();
        break;

      case 'metrics':
        result = await AnalyticsService.getOverallMetrics(dateRange);
        break;

      case 'destinations':
        result = await AnalyticsService.getDestinationPerformance({
          dateRange,
          limit: 20,
        });
        break;

      case 'user':
        if (userId && typeof userId === 'string') {
          result = await AnalyticsService.getUserEngagement(userId, dateRange);
        } else {
          result = await AnalyticsService.getUserEngagement(undefined, dateRange);
        }
        break;

      case 'reasons':
        result = await AnalyticsService.getReasonAnalysis(dateRange);
        break;

      case 'context':
        result = await AnalyticsService.getContextTypeComparison(dateRange);
        break;

      default:
        res.status(400).json({
          error: 'Invalid type. Must be one of: dashboard, metrics, destinations, user, reasons, context',
        });
        return;
    }

    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/recommendations/vectors/user
 * Create or update user vector from onboarding data
 * IA-001.2
 */
router.post('/vectors/user', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, source = 'onboarding' } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    await VectorizationService.saveUserVector(userId, source);
    const vector = await VectorizationService.getUserVector(userId);

    res.json({
      success: true,
      userId,
      vector,
      dimensions: vector.length,
    });
  } catch (error) {
    console.error('Create user vector error:', error);
    res.status(500).json({
      error: 'Failed to create user vector',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/vectors/user/:userId
 * Get user vector
 * IA-001.2
 */
router.get('/vectors/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const vector = await VectorizationService.getUserVector(userId);

    res.json({
      userId,
      vector,
      dimensions: vector.length,
    });
  } catch (error) {
    console.error('Get user vector error:', error);
    res.status(500).json({
      error: 'Failed to get user vector',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/recommendations/cleanup
 * Manually trigger cleanup of expired recommendations
 * IA-001.4
 */
router.post('/cleanup', async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await RecommendationService.cleanupExpiredRecommendations();

    res.json({
      success: true,
      expiredCount: count,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      error: 'Failed to cleanup expired recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Legacy endpoints for backward compatibility (DR-204)

/**
 * GET /api/v1/recommendations/deals
 * Returns current deals and special offers
 * Legacy endpoint - now filters by high-scoring seasonal recommendations
 */
router.get('/deals', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, limit = '5' } = req.query;

    if (!userId || typeof userId !== 'string') {
      // Fallback to trending for anonymous users
      const trending = await ScoringService.getTrendingDestinations(
        parseInt(limit as string, 10)
      );
      res.json(trending);
      return;
    }

    // Get seasonal recommendations (high scores during current season)
    const limitNum = parseInt(limit as string, 10);
    const recommendations = await RecommendationService.getActiveRecommendations(userId, {
      limit: limitNum,
    });

    res.json(recommendations);
  } catch (error) {
    console.error('Deals recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get deals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/activities/:location
 * Returns activity recommendations for a specific location
 * Legacy endpoint - enhanced with AI recommendations
 */
router.get('/activities/:location', async (req: Request, res: Response): Promise<void> => {
  try {
    const { location } = req.params;
    const { userId, type, limit = '10' } = req.query;

    // Search for destinations matching the location
    const destinations = await ScoringService.getDestinationsByCriteria({
      type: type as string,
      limit: parseInt(limit as string, 10),
    });

    // Filter by location name
    const filtered = destinations.filter(dest =>
      dest.name.toLowerCase().includes(location.toLowerCase()) ||
      dest.country?.toLowerCase().includes(location.toLowerCase())
    );

    res.json({
      location,
      count: filtered.length,
      activities: filtered,
    });
  } catch (error) {
    console.error('Activity recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get activity recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ========================================
 * IA-002: Cold Start Recommendation Routes
 * ========================================
 */

/**
 * GET /api/v1/recommendations/popular
 * Get popular destinations (optionally filtered by segment or category)
 * IA-002.2
 */
router.get('/popular', async (req: Request, res: Response): Promise<void> => {
  try {
    const { segment, category, limit = '20' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const PopularityService = (await import('../recommendations/popularity.service')).PopularityService;
    const PopularityCacheService = (await import('../recommendations/popularity-cache.service')).PopularityCacheService;

    const popularityService = new PopularityService();
    const cacheService = new PopularityCacheService();

    let results;

    if (segment) {
      // Try cache first
      results = await cacheService.getTopBySegment(segment as any);
      if (!results) {
        results = await popularityService.getTopBySegment(segment as any, limitNum);
      }
    } else if (category) {
      results = await cacheService.getTopByCategory(category as string);
      if (!results) {
        results = await popularityService.getTopByCategory(category as string, limitNum);
      }
    } else {
      results = await cacheService.getTopDestinations();
      if (!results) {
        results = await popularityService.getTopDestinations(limitNum);
      }
    }

    res.json({
      count: results?.length || 0,
      popular: results || [],
      metadata: {
        source: results ? 'cache' : 'database',
        segment: segment || null,
        category: category || null,
      },
    });
  } catch (error) {
    console.error('Popular recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get popular recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/cold-start
 * Get cold start recommendations for new users
 * IA-002.2, IA-002.3
 */
router.get('/cold-start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, strategy = 'adaptive', limit = '20', diversityFactor = '0.3' } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const ColdStartService = (await import('../recommendations/cold-start.service')).ColdStartService;
    const coldStartService = new ColdStartService();

    // Fetch user profile (would come from user service in production)
    // For now, use mock or fetch from UserVector
    const userProfile = {
      userId: userId as string,
      isOnboardingCompleted: true,
      metadata: { dataQuality: { completeness: 70 } },
    };

    const recommendations = await coldStartService.getRecommendationsForNewUser(
      userId as string,
      userProfile,
      {
        strategy: strategy as any,
        limit: parseInt(limit as string, 10),
        diversityFactor: parseFloat(diversityFactor as string),
        includeReasons: true,
      }
    );

    res.json({
      userId,
      count: recommendations.length,
      strategy: recommendations[0]?.strategy || strategy,
      recommendations,
    });
  } catch (error) {
    console.error('Cold start recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get cold start recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/segments/:segment/popular
 * Get popular destinations for a specific user segment
 * IA-002.1, IA-002.2
 */
router.get('/segments/:segment/popular', async (req: Request, res: Response): Promise<void> => {
  try {
    const { segment } = req.params;
    const { limit = '20' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const PopularityService = (await import('../recommendations/popularity.service')).PopularityService;
    const PopularityCacheService = (await import('../recommendations/popularity-cache.service')).PopularityCacheService;

    const popularityService = new PopularityService();
    const cacheService = new PopularityCacheService();

    // Try cache first
    let results = await cacheService.getTopBySegment(segment as any);
    if (!results) {
      results = await popularityService.getTopBySegment(segment as any, limitNum);
    }

    res.json({
      segment,
      count: results?.length || 0,
      popular: results || [],
      metadata: {
        source: results ? 'cache' : 'database',
      },
    });
  } catch (error) {
    console.error('Segment popular recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get segment popular recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/recommendations/popularity/refresh
 * Manually trigger popularity score refresh (admin endpoint)
 * IA-002.2
 */
router.post('/popularity/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Add admin authentication check
    const { refreshPopularityJob } = await import('../jobs/refresh-popularity.job');

    const result = await refreshPopularityJob.runNow();

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error('Popularity refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh popularity scores',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/cache/stats
 * Get cache statistics (admin endpoint)
 * IA-002.2
 */
router.get('/cache/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const PopularityCacheService = (await import('../recommendations/popularity-cache.service')).PopularityCacheService;
    const cacheService = new PopularityCacheService();

    const stats = await cacheService.getCacheStats();

    res.json(stats);
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// ACTIVITY RECOMMENDATIONS (US-IA-004)
// =============================================================================

/**
 * GET /api/v1/recommendations/activities
 * Get personalized activity recommendations
 * IA-004.3
 */
router.get('/activities', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ActivityRecommendationService } = await import('../activities/services/activity-recommendation.service');
    const activityService = new ActivityRecommendationService();

    // Extract query parameters
    const {
      userId,
      cityCode,
      latitude,
      longitude,
      radiusKm,
      startDate,
      endDate,
      stayDuration,
      travelCompanions,
      budgetPerActivity,
      timeAvailable,
      categories,
      intensityLevels,
      minRating,
      maxPrice,
      maxDuration,
      childFriendly,
      accessible,
      limit,
      diversityFactor,
    } = req.query;

    // Validate required parameters
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    if (!cityCode && (!latitude || !longitude)) {
      res.status(400).json({
        error: 'Either cityCode or location (latitude, longitude) is required'
      });
      return;
    }

    // Build search params
    const searchParams: any = {};
    if (cityCode) {
      searchParams.cityCode = cityCode;
    } else if (latitude && longitude) {
      searchParams.location = {
        latitude: parseFloat(latitude as string),
        longitude: parseFloat(longitude as string),
        radiusKm: radiusKm ? parseFloat(radiusKm as string) : 50,
      };
    }

    if (startDate && endDate) {
      searchParams.dates = {
        startDate: startDate as string,
        endDate: endDate as string,
      };
    }

    // Build trip context
    const tripContext: any = {};
    if (stayDuration) tripContext.stayDuration = parseInt(stayDuration as string, 10);
    if (travelCompanions) tripContext.travelCompanions = travelCompanions as string;
    if (budgetPerActivity) tripContext.budgetPerActivity = parseFloat(budgetPerActivity as string);
    if (timeAvailable) tripContext.timeAvailable = parseInt(timeAvailable as string, 10);

    // Build filters
    const filters: any = {};
    if (categories) {
      filters.categories = Array.isArray(categories) ? categories : [categories];
    }
    if (intensityLevels) {
      filters.intensityLevels = Array.isArray(intensityLevels) ? intensityLevels : [intensityLevels];
    }
    if (minRating) filters.minRating = parseFloat(minRating as string);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);
    if (maxDuration) filters.maxDuration = parseInt(maxDuration as string, 10);
    if (childFriendly !== undefined) filters.childFriendly = childFriendly === 'true';
    if (accessible !== undefined) filters.accessible = accessible === 'true';

    // Get recommendations
    const recommendations = await activityService.getRecommendations({
      userId,
      searchParams,
      tripContext: Object.keys(tripContext).length > 0 ? tripContext : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      diversityFactor: diversityFactor ? parseFloat(diversityFactor as string) : undefined,
    });

    res.json(recommendations);
  } catch (error) {
    console.error('[ActivityRecommendations] Error:', error);
    res.status(500).json({
      error: 'Failed to get activity recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/recommendations/activities/interactions
 * Track user interaction with an activity recommendation
 * IA-004.3
 */
router.post('/activities/interactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ActivityRecommendationService } = await import('../activities/services/activity-recommendation.service');
    const activityService = new ActivityRecommendationService();

    const { userId, activityId, type } = req.body;

    // Validate required fields
    if (!userId || !activityId || !type) {
      res.status(400).json({
        error: 'userId, activityId, and type are required',
        validTypes: ['view', 'click', 'book', 'like', 'dislike', 'wishlist']
      });
      return;
    }

    // Validate interaction type
    const validTypes = ['view', 'click', 'book', 'like', 'dislike', 'wishlist'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        error: `Invalid interaction type: ${type}`,
        validTypes
      });
      return;
    }

    // Track interaction
    await activityService.trackInteraction(userId, activityId, type);

    res.json({
      success: true,
      message: 'Interaction tracked successfully',
      userId,
      activityId,
      type,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ActivityInteraction] Error:', error);
    res.status(500).json({
      error: 'Failed to track interaction',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/activities/status
 * Get activity recommendation service health status
 * IA-004.3
 */
router.get('/activities/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ActivityRecommendationService } = await import('../activities/services/activity-recommendation.service');
    const activityService = new ActivityRecommendationService();

    const status = await activityService.getStatus();

    res.json(status);
  } catch (error) {
    console.error('[ActivityStatus] Error:', error);
    res.status(500).json({
      error: 'Failed to get service status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// FLIGHT RECOMMENDATIONS (US-IA-004-bis)
// =============================================================================

/**
 * GET /api/v1/recommendations/flights
 * Get personalized flight recommendations
 * IA-004-bis.3
 */
router.get('/flights', async (req: Request, res: Response): Promise<void> => {
  try {
    const { FlightRecommendationService } = await import('../flights/services/flight-recommendation.service');
    const flightService = new FlightRecommendationService();

    // Extract query parameters
    const {
      userId,
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      children,
      infants,
      travelClass,
      tripPurpose,
      budgetPerPerson,
      preferDirectFlights,
      maxLayoverTime,
      preferredDepartureTime,
      avoidRedEye,
      travelCompanions,
      flightClasses,
      maxStops,
      maxDuration,
      maxPrice,
      departureTimeEarliest,
      departureTimeLatest,
      arrivalTimeEarliest,
      arrivalTimeLatest,
      airlines,
      alliances,
      requiredAmenities,
      limit,
      diversityFactor,
    } = req.query;

    // Validate required parameters
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    if (!origin || !destination || !departureDate || !adults) {
      res.status(400).json({
        error: 'origin, destination, departureDate, and adults are required'
      });
      return;
    }

    // Build search params
    const searchParams: any = {
      origin: origin as string,
      destination: destination as string,
      departureDate: departureDate as string,
      adults: parseInt(adults as string, 10),
    };

    if (returnDate) searchParams.returnDate = returnDate as string;
    if (children) searchParams.children = parseInt(children as string, 10);
    if (infants) searchParams.infants = parseInt(infants as string, 10);
    if (travelClass) searchParams.travelClass = travelClass as string;

    // Build trip context
    const tripContext: any = {};
    if (tripPurpose) tripContext.tripPurpose = tripPurpose as string;
    if (budgetPerPerson) tripContext.budgetPerPerson = parseFloat(budgetPerPerson as string);
    if (preferDirectFlights !== undefined) tripContext.preferDirectFlights = preferDirectFlights === 'true';
    if (maxLayoverTime) tripContext.maxLayoverTime = parseInt(maxLayoverTime as string, 10);
    if (preferredDepartureTime) tripContext.preferredDepartureTime = preferredDepartureTime as string;
    if (avoidRedEye !== undefined) tripContext.avoidRedEye = avoidRedEye === 'true';
    if (travelCompanions) tripContext.travelCompanions = travelCompanions as string;

    // Build filters
    const filters: any = {};
    if (flightClasses) {
      filters.flightClasses = Array.isArray(flightClasses) ? flightClasses : [flightClasses];
    }
    if (maxStops !== undefined) filters.maxStops = parseInt(maxStops as string, 10);
    if (maxDuration) filters.maxDuration = parseInt(maxDuration as string, 10);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);

    if (departureTimeEarliest && departureTimeLatest) {
      filters.departureTimeRange = {
        earliest: departureTimeEarliest as string,
        latest: departureTimeLatest as string,
      };
    }

    if (arrivalTimeEarliest && arrivalTimeLatest) {
      filters.arrivalTimeRange = {
        earliest: arrivalTimeEarliest as string,
        latest: arrivalTimeLatest as string,
      };
    }

    if (airlines) {
      filters.airlines = Array.isArray(airlines) ? airlines : [airlines];
    }

    if (alliances) {
      filters.alliances = Array.isArray(alliances) ? alliances : [alliances];
    }

    if (requiredAmenities) {
      filters.requiredAmenities = Array.isArray(requiredAmenities) ? requiredAmenities : [requiredAmenities];
    }

    // Get recommendations
    const recommendations = await flightService.getRecommendations({
      userId,
      searchParams,
      tripContext: Object.keys(tripContext).length > 0 ? tripContext : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      diversityFactor: diversityFactor ? parseFloat(diversityFactor as string) : undefined,
    });

    res.json(recommendations);
  } catch (error) {
    console.error('[FlightRecommendations] Error:', error);
    res.status(500).json({
      error: 'Failed to get flight recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/recommendations/flights/interactions
 * Track user interaction with a flight recommendation
 * IA-004-bis.3
 */
router.post('/flights/interactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { FlightRecommendationService } = await import('../flights/services/flight-recommendation.service');
    const flightService = new FlightRecommendationService();

    const { userId, flightId, type } = req.body;

    // Validate required fields
    if (!userId || !flightId || !type) {
      res.status(400).json({
        error: 'userId, flightId, and type are required',
        validTypes: ['view', 'click', 'book', 'compare', 'save']
      });
      return;
    }

    // Validate interaction type
    const validTypes = ['view', 'click', 'book', 'compare', 'save'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        error: `Invalid interaction type: ${type}`,
        validTypes
      });
      return;
    }

    // Track interaction
    await flightService.trackInteraction(userId, flightId, type);

    res.json({
      success: true,
      message: 'Interaction tracked successfully',
      userId,
      flightId,
      type,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[FlightInteraction] Error:', error);
    res.status(500).json({
      error: 'Failed to track interaction',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/recommendations/flights/status
 * Get flight recommendation service health status
 * IA-004-bis.3
 */
router.get('/flights/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { FlightRecommendationService } = await import('../flights/services/flight-recommendation.service');
    const flightService = new FlightRecommendationService();

    const status = await flightService.getStatus();

    res.json(status);
  } catch (error) {
    console.error('[FlightStatus] Error:', error);
    res.status(500).json({
      error: 'Failed to get service status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
