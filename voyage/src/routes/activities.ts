import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';
import { ActivityMapper } from '@/mappers/ActivityMapper';

const router = Router();

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      latitude,
      longitude,
      radius = 1,
      north,
      west,
      south,
      east,
      locationName
    } = req.query;

    if (!latitude || !longitude) {
      if (!north || !west || !south || !east) {
        res.status(400).json({
          error: 'Either latitude/longitude or north/west/south/east coordinates are required'
        });
        return;
      }
    }

    const searchParams: any = {};

    if (latitude && longitude) {
      searchParams.latitude = parseFloat(latitude as string);
      searchParams.longitude = parseFloat(longitude as string);
      if (radius) searchParams.radius = parseInt(radius as string);
    } else {
      searchParams.north = parseFloat(north as string);
      searchParams.west = parseFloat(west as string);
      searchParams.south = parseFloat(south as string);
      searchParams.east = parseFloat(east as string);
    }

    const result = await AmadeusService.searchActivities(searchParams);

    // 🔍 DEBUG: Log raw Amadeus API response structure (only in debug mode)
    const DEBUG_MODE = false; // Set to true to enable detailed logging

    if (DEBUG_MODE) {
      console.log('🔍 [DEBUG] Raw Amadeus Activities API Response:');
      console.log('📊 Total activities returned:', result.data?.length || 0);

      if (result.data && result.data.length > 0) {
        console.log('📍 First activity structure:', JSON.stringify(result.data[0], null, 2));
        console.log('🏷️ First activity name:', result.data[0].name);
        console.log('🌍 First activity geoCode:', result.data[0].geoCode);
        console.log('📌 First activity location fields:', {
          geoCode: result.data[0].geoCode,
          locationName: result.data[0].locationName,
          city: result.data[0].city,
          address: result.data[0].address,
          destination: result.data[0].destination
        });
      }
    } else {
      // Just log basic info in production
      console.log(`✅ Activities search: ${result.data?.length || 0} activities found for ${locationName || 'unknown location'}`);
    }

    // Pass location context to mapper
    const simplifiedActivities = ActivityMapper.mapAmadeusToSimplified(
      result.data || [],
      locationName as string
    );

    // 🔍 DEBUG: Log mapped activities (only in debug mode)
    if (DEBUG_MODE) {
      console.log('🗺️ [DEBUG] Mapped activities:');
      if (simplifiedActivities.length > 0) {
        console.log('📍 First mapped activity location:', simplifiedActivities[0].location);
      }
    }

    res.json({
      data: simplifiedActivities,
      meta: result.meta
    });
  } catch (error) {
    console.error('Activities search error:', error);
    res.status(500).json({
      error: 'Failed to search activities',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/details/:activityId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityId } = req.params;

    if (!activityId) {
      res.status(400).json({
        error: 'Activity ID is required'
      });
      return;
    }

    const result = await AmadeusService.getActivityById(activityId);

    if (!result.data) {
      res.status(404).json({
        error: 'Activity not found'
      });
      return;
    }

    const simplifiedActivity = ActivityMapper.mapSingleActivity(result.data);

    res.json({
      data: simplifiedActivity,
      meta: result.meta
    });
  } catch (error) {
    console.error('Activity details error:', error);
    res.status(500).json({
      error: 'Failed to get activity details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/:activityId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityId } = req.params;

    if (!activityId) {
      res.status(400).json({
        error: 'Activity ID is required'
      });
      return;
    }

    const result = await AmadeusService.getActivityById(activityId);

    if (!result.data) {
      res.status(404).json({
        error: 'Activity not found'
      });
      return;
    }

    const simplifiedActivity = ActivityMapper.mapSingleActivity(result.data);

    res.json({
      data: simplifiedActivity,
      meta: result.meta
    });
  } catch (error) {
    console.error('Activity by ID error:', error);
    res.status(500).json({
      error: 'Failed to get activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;