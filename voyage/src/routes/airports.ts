import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';

const router = Router();

// Airport On-Time Performance
router.get('/on-time-performance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { airportCode, date } = req.query;

    if (!airportCode || !date) {
      res.status(400).json({
        error: 'Missing required parameters: airportCode, date'
      });
      return;
    }

    const result = await AmadeusService.getAirportOnTimePerformance({
      airportCode: airportCode as string,
      date: date as string
    });
    res.json(result);
  } catch (error) {
    console.error('Airport on-time performance error:', error);
    res.status(500).json({
      error: 'Failed to get airport on-time performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Airport Nearest Relevant
router.get('/nearest', async (req: Request, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, radius, limit, offset, sort } = req.query;

    if (!latitude || !longitude) {
      res.status(400).json({
        error: 'Missing required parameters: latitude, longitude'
      });
      return;
    }

    const result = await AmadeusService.getNearestRelevantAirports({
      latitude: parseFloat(latitude as string),
      longitude: parseFloat(longitude as string),
      radius: radius ? parseInt(radius as string) : undefined,
      page: {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      },
      sort: sort as string
    });
    res.json(result);
  } catch (error) {
    console.error('Nearest airports error:', error);
    res.status(500).json({
      error: 'Failed to get nearest relevant airports',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Airport Routes
router.get('/routes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { departureAirportCode, max } = req.query;

    if (!departureAirportCode) {
      res.status(400).json({
        error: 'Missing required parameter: departureAirportCode'
      });
      return;
    }

    const result = await AmadeusService.getAirportRoutes({
      departureAirportCode: departureAirportCode as string,
      max: max ? parseInt(max as string) : undefined
    });
    res.json(result);
  } catch (error) {
    console.error('Airport routes error:', error);
    res.status(500).json({
      error: 'Failed to get airport routes',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
