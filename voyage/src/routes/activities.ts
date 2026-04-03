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
      if (radius) {
        searchParams.radius = parseInt(radius as string);
      }
    } else {
      searchParams.north = parseFloat(north as string);
      searchParams.west = parseFloat(west as string);
      searchParams.south = parseFloat(south as string);
      searchParams.east = parseFloat(east as string);
    }

    const result = await AmadeusService.searchActivities(searchParams);
    console.log(`Activities search: ${result.data?.length || 0} activities found for ${locationName || 'unknown location'}`);

    const simplifiedActivities = ActivityMapper.mapAmadeusToSimplified(
      result.data || [],
      locationName as string
    );

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
