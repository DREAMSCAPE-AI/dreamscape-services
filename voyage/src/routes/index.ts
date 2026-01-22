import { Router } from 'express';
import flightsRouter from './flights';
import hotelsRouter from './hotels';
import locationsRouter from './locations';
import transfersRouter from './transfers';
import airlinesRouter from './airlines';
import airportsRouter from './airports';
// import healthRouter from './health'; // Temporarily disabled due to module issues
import activitiesRouter from './activities';
import cartRouter from './cart';
import bookingsRouter from './bookings';
import itinerariesRouter from './itineraries';
import bookingsRouter from './bookings';

const router = Router();

// Health check endpoint with database status
// router.use('/health', healthRouter); // Temporarily disabled

// Core travel service routes
router.use('/flights', flightsRouter);
router.use('/hotels', hotelsRouter);
router.use('/locations', locationsRouter);
router.use('/transfers', transfersRouter);
router.use('/airlines', airlinesRouter);
router.use('/airports', airportsRouter);
router.use('/activities', activitiesRouter);

// Cart and booking flow routes
router.use('/cart', cartRouter);
router.use('/bookings', bookingsRouter);

// Bookings management routes
router.use('/bookings', bookingsRouter);

// Itinerary management routes
router.use('/itineraries', itinerariesRouter);

export default router;
