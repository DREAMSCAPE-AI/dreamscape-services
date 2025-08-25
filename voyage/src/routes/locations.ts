import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';

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

    const searchParams: any = {
      keyword: keyword as string
    };
    
    // Only add optional parameters if they are provided
    if (subType) {
      searchParams.subType = subType as string;
    }
    
    if (countryCode) {
      searchParams.countryCode = countryCode as string;
    }

    const result = await AmadeusService.searchLocations(searchParams);
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
    const { keyword, subType } = req.query;

    if (!keyword) {
      res.status(400).json({
        error: 'Missing required parameter: keyword'
      });
      return;
    }

    const result = await AmadeusService.searchAirports({ 
      keyword: keyword as string,
      subType: subType as string
    });
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
