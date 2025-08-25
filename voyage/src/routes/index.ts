import { Router } from 'express';
import flightsRouter from './flights';
import hotelsRouter from './hotels';
import locationsRouter from './locations';
import transfersRouter from './transfers';
import airlinesRouter from './airlines';
import airportsRouter from './airports';
import healthRouter from './health';

const router = Router();

// Health check endpoint with database status
router.use('/health', healthRouter);

// Core travel service routes
router.use('/flights', flightsRouter);
router.use('/hotels', hotelsRouter);
router.use('/locations', locationsRouter);
router.use('/transfers', transfersRouter);
router.use('/airlines', airlinesRouter);
router.use('/airports', airportsRouter);

export default router;
