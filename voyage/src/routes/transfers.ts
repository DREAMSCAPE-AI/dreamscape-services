import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';

const router = Router();

// Transfer Search
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      startLocationCode,
      endLocationCode,
      startDateTime,
      startAddressLine,
      startCountryCode,
      startCityName,
      endAddressLine,
      endCountryCode,
      endCityName,
      transferType,
      passengers
    } = req.query;

    if (!startDateTime || !passengers) {
      res.status(400).json({
        error: 'Missing required parameters: startDateTime, passengers'
      });
      return;
    }

    const result = await AmadeusService.searchTransfers({
      startLocationCode: startLocationCode as string,
      endLocationCode: endLocationCode as string,
      startDateTime: startDateTime as string,
      transferType: transferType as string,
      passengers: parseInt(passengers as string)
    });
    res.json(result);
  } catch (error) {
    console.error('Transfer search error:', error);
    res.status(500).json({
      error: 'Failed to search transfers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Transfer Booking
router.post('/bookings', async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingData = req.body;
    const result = await AmadeusService.createTransferBooking(bookingData);
    res.json(result);
  } catch (error) {
    console.error('Transfer booking error:', error);
    res.status(500).json({
      error: 'Failed to create transfer booking',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Transfer Order Management
router.get('/orders/:orderId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const result = await AmadeusService.getTransferOrder(orderId);
    res.json(result);
  } catch (error) {
    console.error('Transfer order retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve transfer order',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
