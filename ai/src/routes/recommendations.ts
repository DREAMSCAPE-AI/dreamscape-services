import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';

const router = Router();

// Travel Recommendations
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cityCodes, travelerCountryCode, destinationCountryCode } = req.query;

    if (!cityCodes) {
      res.status(400).json({
        error: 'Missing required parameter: cityCodes'
      });
      return;
    }

    const result = await AmadeusService.getTravelRecommendations({
      cityCodes: cityCodes as string,
      travelerCountryCode: travelerCountryCode as string,
      destinationCountryCode: destinationCountryCode as string
    });
    res.json(result);
  } catch (error) {
    console.error('Travel recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get travel recommendations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
