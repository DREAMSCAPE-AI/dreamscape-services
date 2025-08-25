import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';

const router = Router();

// Airline Code Lookup
router.get('/lookup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { airlineCodes, IATACode, ICAOCode } = req.query;

    const result = await AmadeusService.lookupAirlineCode({
      airlineCodes: airlineCodes as string,
      IATACode: IATACode as string,
      ICAOCode: ICAOCode as string
    });
    res.json(result);
  } catch (error) {
    console.error('Airline lookup error:', error);
    res.status(500).json({
      error: 'Failed to lookup airline code',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Airline Routes
router.get('/routes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { airlineCode, max } = req.query;

    if (!airlineCode) {
      res.status(400).json({
        error: 'Missing required parameter: airlineCode'
      });
      return;
    }

    const result = await AmadeusService.getAirlineRoutes({
      airlineCode: airlineCode as string,
      max: max ? parseInt(max as string) : undefined
    });
    res.json(result);
  } catch (error) {
    console.error('Airline routes error:', error);
    res.status(500).json({
      error: 'Failed to get airline routes',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
