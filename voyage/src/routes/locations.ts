import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';
import duffelService from '@/services/DuffelService';
import { duffelToAmadeusLocations } from '@/adapters/duffel-to-amadeus-locations';

const router = Router();

// Search locations (cities, airports, etc.)
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword, subType, countryCode } = req.query;

    if (!keyword) {
      res.status(400).json({
        error: 'Missing required parameter: keyword'
      });
      return;
    }

    // ── Duffel Places (remplace Amadeus) ─────────────────────────────────────
    const places = await duffelService.searchPlaces(
      keyword as string,
      subType as string | undefined
    );
    const result = duffelToAmadeusLocations(places, subType as string | undefined);

    res.json(result);
  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({
      error: 'Failed to search locations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search airports
router.get('/airports', async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      res.status(400).json({
        error: 'Missing required parameter: keyword'
      });
      return;
    }

    // ── Duffel Places filtrées sur AIRPORT ────────────────────────────────────
    const places = await duffelService.searchPlaces(keyword as string, 'AIRPORT');
    const result = duffelToAmadeusLocations(places, 'AIRPORT');

    res.json(result);
  } catch (error) {
    console.error('Airport search error:', error);
    res.status(500).json({
      error: 'Failed to search airports',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
