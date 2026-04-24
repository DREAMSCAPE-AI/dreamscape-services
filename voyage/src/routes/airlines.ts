import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';
import airlinesData from '@/data/airlines-iata.json';

const router = Router();

// Airline Code Lookup — seed file JSON (Amadeus /v1/reference-data/airlines est HS)
router.get('/lookup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { airlineCodes, IATACode, ICAOCode } = req.query;

    const codes = (
      airlineCodes as string ||
      IATACode as string ||
      ICAOCode as string ||
      ''
    )
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(Boolean);

    if (codes.length === 0) {
      res.json({ data: airlinesData });
      return;
    }

    const found = airlinesData.filter((a: any) =>
      codes.includes(a.iataCode?.toUpperCase() || '') ||
      codes.includes(a.icaoCode?.toUpperCase() || '')
    );

    res.json({
      data: found,
      meta: { count: found.length }
    });
  } catch (error) {
    console.error('Airline lookup error:', error);
    res.status(500).json({
      error: 'Failed to lookup airline code',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Airline Routes (orphaned - kept for compatibility, returns empty)
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
