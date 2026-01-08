import { Router } from 'express';
import { ItineraryController } from '@/controllers/itinerary.controller';
import { authProxy } from '@/middleware/authProxy';

const router = Router();
const controller = new ItineraryController();

// All routes require authentication
router.use(authProxy);

// Itinerary CRUD
router.get('/', (req, res, next) => controller.getItineraries(req, res, next));
router.post('/', (req, res, next) => controller.createItinerary(req, res, next));
router.get('/:id', (req, res, next) => controller.getItineraryById(req, res, next));
router.put('/:id', (req, res, next) => controller.updateItinerary(req, res, next));
router.delete('/:id', (req, res, next) => controller.deleteItinerary(req, res, next));

// Items management
router.post('/:id/items', (req, res, next) => controller.addItem(req, res, next));
router.put('/:id/items/:itemId', (req, res, next) => controller.updateItem(req, res, next));
router.delete('/:id/items/:itemId', (req, res, next) => controller.deleteItem(req, res, next));
router.patch('/:id/items/reorder', (req, res, next) => controller.reorderItems(req, res, next));

// Export
router.get('/:id/export', (req, res, next) => controller.exportItinerary(req, res, next));

export default router;
