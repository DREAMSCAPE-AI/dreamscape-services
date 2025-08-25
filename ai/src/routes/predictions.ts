import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';

const router = Router();

// Trip Purpose Prediction
router.get('/trip-purpose', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      returnDate,
      searchDate
    } = req.query;

    if (!originLocationCode || !destinationLocationCode || !departureDate || !searchDate) {
      res.status(400).json({
        error: 'Missing required parameters: originLocationCode, destinationLocationCode, departureDate, searchDate'
      });
      return;
    }

    const result = await AmadeusService.predictTripPurpose({
      originLocationCode: originLocationCode as string,
      destinationLocationCode: destinationLocationCode as string,
      departureDate: departureDate as string,
      returnDate: returnDate as string,
      searchDate: searchDate as string
    });
    res.json(result);
  } catch (error) {
    console.error('Trip purpose prediction error:', error);
    res.status(500).json({
      error: 'Failed to predict trip purpose',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
