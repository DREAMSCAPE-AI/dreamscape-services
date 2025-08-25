import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';

const router = Router();

// Helper function to send error responses
const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ error: message });
};

// Search activities
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, radius, north, west, south, east } = req.query;

    // Validate coordinates
    if ((!latitude || !longitude) && (!north || !west || !south || !east)) {
      return sendError(res, 400, 'Either latitude/longitude or north/west/south/east coordinates are required');
    }

    // Build search parameters with proper typing
    const searchParams: any = {};
    
    if (latitude && longitude) {
      searchParams.latitude = parseFloat(latitude as string);
      searchParams.longitude = parseFloat(longitude as string);
    } else if (north && west && south && east) {
      searchParams.north = parseFloat(north as string);
      searchParams.west = parseFloat(west as string);
      searchParams.south = parseFloat(south as string);
      searchParams.east = parseFloat(east as string);
    }
    
    if (radius) {
      searchParams.radius = parseInt(radius as string, 10);
    }

    const result = await AmadeusService.searchActivities(searchParams);
    res.json(result);
  } catch (error) {
    console.error('Error searching activities:', error);
    sendError(res, 500, 'Failed to search activities');
  }
});

// Get activity details
router.get('/details/:activityId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityId } = req.params;

    if (!activityId) {
      return sendError(res, 400, 'Missing required parameter: activityId');
    }

    const result = await AmadeusService.getActivityDetails(activityId);
    res.json(result);
  } catch (error) {
    console.error('Activity details error:', error);
    sendError(res, 500, 'Failed to get activity details');
  }
});

// Get activity by ID (alternative endpoint)
router.get('/:activityId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityId } = req.params;

    if (!activityId) {
      return sendError(res, 400, 'Missing required parameter: activityId');
    }

    const result = await AmadeusService.getActivityDetails(activityId);
    res.json(result);
  } catch (error) {
    console.error('Activity by ID error:', error);
    sendError(res, 500, 'Failed to get activity by ID');
  }
});

export default router;
