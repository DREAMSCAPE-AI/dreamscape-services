import { Router, Request, Response } from 'express';
import AmadeusService from '@/services/AmadeusService';
import { FlightOfferMapper } from '@/mappers/FlightOfferMapper';

const router = Router();

// Search flights with mapped DTOs (DR-132)
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      returnDate,
      adults = 1,
      children = 0,
      infants = 0,
      travelClass,
      nonStop,
      maxPrice,
      max = 250
    } = req.query;

    if (!originLocationCode || !destinationLocationCode || !departureDate) {
      res.status(400).json({
        error: 'Missing required parameters: originLocationCode, destinationLocationCode, departureDate'
      });
      return;
    }

    // Resolve location codes to IATA airport codes
    const resolvedOrigin = await AmadeusService.resolveLocationCode(originLocationCode as string);
    const resolvedDestination = await AmadeusService.resolveLocationCode(destinationLocationCode as string);

    console.log(`Resolved locations: ${String(originLocationCode)} -> ${resolvedOrigin}, ${String(destinationLocationCode)} -> ${resolvedDestination}`);

    const searchParams = {
      originLocationCode: resolvedOrigin,
      destinationLocationCode: resolvedDestination,
      departureDate: departureDate as string,
      returnDate: returnDate as string,
      adults: parseInt(adults as string),
      children: parseInt(children as string),
      infants: parseInt(infants as string),
      travelClass: travelClass as string,
      nonStop: nonStop === 'true',
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      max: parseInt(max as string)
    };

    const result = await AmadeusService.searchFlights(searchParams);

    // Map to internal DTOs then simplify for frontend
    const offers = FlightOfferMapper.mapToDTOs(result.data);
    const simplified = FlightOfferMapper.mapToSimplifiedList(offers);

    res.json({
      data: simplified,
      meta: result.meta
    });
  } catch (error) {
    console.error('Flight search error:', error);
    res.status(500).json({
      error: 'Failed to search flights',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search flight destinations (inspiration)
router.get('/destinations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin, maxPrice, departureDate } = req.query;

    if (!origin) {
      res.status(400).json({
        error: 'Missing required parameter: origin'
      });
      return;
    }

    // Resolve origin location code to IATA airport code
    const resolvedOrigin = await AmadeusService.resolveLocationCode(origin as string);
    console.log(`Resolved origin for destinations: ${String(origin)} -> ${resolvedOrigin}`);

    const searchParams = {
      origin: resolvedOrigin,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      departureDate: departureDate as string
    };

    const result = await AmadeusService.searchFlightDestinations(searchParams);
    res.json(result);
  } catch (error) {
    console.error('Flight destinations search error:', error);
    res.status(500).json({
      error: 'Failed to search flight destinations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Price Analysis
router.get('/price-analysis', async (req: Request, res: Response): Promise<void> => {
  try {
    const { originIataCode, destinationIataCode, departureDate, currencyCode } = req.query;

    if (!originIataCode || !destinationIataCode || !departureDate) {
      res.status(400).json({
        error: 'Missing required parameters: originIataCode, destinationIataCode, departureDate'
      });
      return;
    }

    // Resolve location codes to IATA airport codes
    const resolvedOrigin = await AmadeusService.resolveLocationCode(originIataCode as string);
    const resolvedDestination = await AmadeusService.resolveLocationCode(destinationIataCode as string);

    const result = await AmadeusService.getFlightPriceAnalysis({
      originIataCode: resolvedOrigin,
      destinationIataCode: resolvedDestination,
      departureDate: departureDate as string,
      currencyCode: currencyCode as string
    });
    res.json(result);
  } catch (error) {
    console.error('Flight price analysis error:', error);
    res.status(500).json({
      error: 'Failed to get flight price analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Choice Prediction
router.post('/choice-prediction', async (req: Request, res: Response): Promise<void> => {
  try {
    const flightOffers = req.body;
    const result = await AmadeusService.getFlightChoicePrediction(flightOffers);
    res.json(result);
  } catch (error) {
    console.error('Flight choice prediction error:', error);
    res.status(500).json({
      error: 'Failed to get flight choice prediction',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Inspiration Search
router.get('/inspiration', async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin, maxPrice, departureDate, oneWay, duration, nonStop, viewBy } = req.query;

    if (!origin) {
      res.status(400).json({
        error: 'Missing required parameter: origin'
      });
      return;
    }

    // Resolve origin location code to IATA airport code
    const resolvedOrigin = await AmadeusService.resolveLocationCode(origin as string);

    const result = await AmadeusService.searchFlightInspiration({
      origin: resolvedOrigin,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      departureDate: departureDate as string,
      oneWay: oneWay === 'true',
      duration: duration as string,
      nonStop: nonStop === 'true',
      viewBy: viewBy as string
    });
    res.json(result);
  } catch (error) {
    console.error('Flight inspiration search error:', error);
    res.status(500).json({
      error: 'Failed to search flight inspiration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Cheapest Date Search
router.get('/cheapest-dates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin, destination, departureDate, oneWay, nonStop, duration, viewBy } = req.query;

    if (!origin || !destination) {
      res.status(400).json({
        error: 'Missing required parameters: origin, destination'
      });
      return;
    }

    // Resolve location codes to IATA airport codes
    const resolvedOrigin = await AmadeusService.resolveLocationCode(origin as string);
    const resolvedDestination = await AmadeusService.resolveLocationCode(destination as string);

    const result = await AmadeusService.searchCheapestFlightDates({
      origin: resolvedOrigin,
      destination: resolvedDestination,
      departureDate: departureDate as string,
      oneWay: oneWay === 'true',
      nonStop: nonStop === 'true',
      duration: duration as string,
      viewBy: viewBy as string
    });
    res.json(result);
  } catch (error) {
    console.error('Cheapest flight dates search error:', error);
    res.status(500).json({
      error: 'Failed to search cheapest flight dates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Status
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { carrierCode, flightNumber, scheduledDepartureDate } = req.query;

    if (!carrierCode || !flightNumber || !scheduledDepartureDate) {
      res.status(400).json({
        error: 'Missing required parameters: carrierCode, flightNumber, scheduledDepartureDate'
      });
      return;
    }

    const result = await AmadeusService.getFlightStatus({
      carrierCode: carrierCode as string,
      flightNumber: flightNumber as string,
      scheduledDepartureDate: scheduledDepartureDate as string
    });

    res.json(result);
  } catch (error) {
    console.error('Flight status error:', error);
    res.status(500).json({
      error: 'Failed to get flight status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Delay Prediction
router.get('/delay-prediction', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      departureTime,
      arrivalDate,
      arrivalTime,
      aircraftCode,
      carrierCode,
      flightNumber,
      duration
    } = req.query;

    if (!originLocationCode || !destinationLocationCode || !departureDate || !departureTime || !arrivalDate || !arrivalTime || !aircraftCode || !carrierCode || !flightNumber || !duration) {
      res.status(400).json({
        error: 'Missing required parameters for delay prediction'
      });
      return;
    }

    const result = await AmadeusService.predictFlightDelay({
      originLocationCode: originLocationCode as string,
      destinationLocationCode: destinationLocationCode as string,
      departureDate: departureDate as string,
      departureTime: departureTime as string,
      arrivalDate: arrivalDate as string,
      arrivalTime: arrivalTime as string,
      aircraftCode: aircraftCode as string,
      carrierCode: carrierCode as string,
      flightNumber: flightNumber as string,
      duration: duration as string
    });

    res.json(result);
  } catch (error) {
    console.error('Flight delay prediction error:', error);
    res.status(500).json({
      error: 'Failed to predict flight delay',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Most Traveled Destinations
router.get('/analytics/most-traveled', async (req: Request, res: Response): Promise<void> => {
  try {
    const { originCityCode, period, max } = req.query;

    if (!originCityCode || !period) {
      res.status(400).json({
        error: 'Missing required parameters: originCityCode, period'
      });
      return;
    }

    const result = await AmadeusService.getMostTraveledDestinations({
      originCityCode: originCityCode as string,
      period: period as string,
      max: max ? parseInt(max as string) : undefined
    });
    res.json(result);
  } catch (error) {
    console.error('Most traveled destinations error:', error);
    res.status(500).json({
      error: 'Failed to get most traveled destinations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Most Booked Destinations
router.get('/analytics/most-booked', async (req: Request, res: Response): Promise<void> => {
  try {
    const { originCityCode, period, max } = req.query;

    if (!originCityCode || !period) {
      res.status(400).json({
        error: 'Missing required parameters: originCityCode, period'
      });
      return;
    }

    const result = await AmadeusService.getMostBookedDestinations({
      originCityCode: originCityCode as string,
      period: period as string,
      max: max ? parseInt(max as string) : undefined
    });
    res.json(result);
  } catch (error) {
    console.error('Most booked destinations error:', error);
    res.status(500).json({
      error: 'Failed to get most booked destinations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Busiest Traveling Period
router.get('/analytics/busiest-period', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cityCode, period, direction } = req.query;

    if (!cityCode || !period) {
      res.status(400).json({
        error: 'Missing required parameters: cityCode, period'
      });
      return;
    }

    const result = await AmadeusService.getBusiestTravelingPeriod({
      cityCode: cityCode as string,
      period: period as string,
      direction: direction as string
    });
    res.json(result);
  } catch (error) {
    console.error('Busiest traveling period error:', error);
    res.status(500).json({
      error: 'Failed to get busiest traveling period',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Check-in Links
router.get('/checkin-links', async (req: Request, res: Response): Promise<void> => {
  try {
    const { airlineCode, language } = req.query;

    if (!airlineCode) {
      res.status(400).json({
        error: 'Missing required parameter: airlineCode'
      });
      return;
    }

    const result = await AmadeusService.getFlightCheckinLinks({
      airlineCode: airlineCode as string,
      language: language as string
    });
    res.json(result);
  } catch (error) {
    console.error('Flight check-in links error:', error);
    res.status(500).json({
      error: 'Failed to get flight check-in links',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Seat Map Display
router.get('/seatmap', async (req: Request, res: Response): Promise<void> => {
  try {
    const { flightOfferId } = req.query;

    if (!flightOfferId) {
      res.status(400).json({
        error: 'Missing required parameter: flightOfferId'
      });
      return;
    }

    const result = await AmadeusService.getFlightSeatMap({
      flightOfferId: flightOfferId as string
    });
    res.json(result);
  } catch (error) {
    console.error('Seat map error:', error);
    res.status(500).json({
      error: 'Failed to get seat map',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Offers Price
router.post('/offers/pricing', async (req: Request, res: Response): Promise<void> => {
  try {
    const flightOffers = req.body;
    const result = await AmadeusService.getFlightOffersPrice(flightOffers);
    res.json(result);
  } catch (error) {
    console.error('Flight offers pricing error:', error);
    res.status(500).json({
      error: 'Failed to get flight offers pricing',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Branded Fares Upsell
router.get('/branded-fares', async (req: Request, res: Response): Promise<void> => {
  try {
    const { flightOfferId } = req.query;

    if (!flightOfferId) {
      res.status(400).json({
        error: 'Missing required parameter: flightOfferId'
      });
      return;
    }

    const result = await AmadeusService.getBrandedFares({
      flightOfferId: flightOfferId as string
    });
    res.json(result);
  } catch (error) {
    console.error('Branded fares error:', error);
    res.status(500).json({
      error: 'Failed to get branded fares',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Availabilities Search
router.post('/availabilities', async (req: Request, res: Response): Promise<void> => {
  try {
    const { originDestinations, travelers, sources } = req.body;

    if (!originDestinations || !travelers || !sources) {
      res.status(400).json({
        error: 'Missing required parameters: originDestinations, travelers, sources'
      });
      return;
    }

    const result = await AmadeusService.searchFlightAvailabilities({
      originDestinations,
      travelers,
      sources
    });
    res.json(result);
  } catch (error) {
    console.error('Flight availabilities error:', error);
    res.status(500).json({
      error: 'Failed to search flight availabilities',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Create Orders
router.post('/orders', async (req: Request, res: Response): Promise<void> => {
  try {
    const orderData = req.body;
    const result = await AmadeusService.createFlightOrder(orderData);
    res.json(result);
  } catch (error) {
    console.error('Flight order creation error:', error);
    res.status(500).json({
      error: 'Failed to create flight order',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Flight Order Management
router.get('/orders/:orderId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const result = await AmadeusService.getFlightOrder(orderId);
    res.json(result);
  } catch (error) {
    console.error('Flight order retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve flight order',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
