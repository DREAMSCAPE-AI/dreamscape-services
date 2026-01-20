import { Request, Response, NextFunction } from 'express';
import prisma from '@/database/prisma';
import { ZodError } from 'zod';
import {
  CreateItinerarySchema,
  UpdateItinerarySchema,
  CreateItineraryItemSchema,
  UpdateItineraryItemSchema,
  ReorderItemsSchema,
  ExportFormatSchema,
  type ItineraryResponse,
  type ItineraryItemResponse
} from '@/types/itinerary.types';
import { ItineraryExportService } from '@/services/itinerary.export.service';

/**
 * Controller for itinerary management
 */
export class ItineraryController {
  private exportService: ItineraryExportService;

  constructor() {
    this.exportService = new ItineraryExportService();
  }

  /**
   * Get all itineraries for the authenticated user
   */
  async getItineraries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const itineraries = await prisma.itinerary.findMany({
        where: { userId },
        include: {
          items: {
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(itineraries);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single itinerary by ID with all items
   */
  async getItineraryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const itinerary = await prisma.itinerary.findFirst({
        where: { id, userId },
        include: {
          items: {
            orderBy: [{ startDate: 'asc' }, { order: 'asc' }]
          }
        }
      });

      if (!itinerary) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      res.json(itinerary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new itinerary
   */
  async createItinerary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validated = CreateItinerarySchema.parse(req.body);

      const itinerary = await prisma.itinerary.create({
        data: {
          userId,
          title: validated.title,
          startDate: new Date(validated.startDate),
          endDate: new Date(validated.endDate),
          destinations: validated.destinations
        },
        include: {
          items: true
        }
      });

      res.status(201).json(itinerary);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }

  /**
   * Update an existing itinerary
   */
  async updateItinerary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check ownership
      const existing = await prisma.itinerary.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      const validated = UpdateItinerarySchema.parse(req.body);

      const updateData: any = {};
      if (validated.title !== undefined) updateData.title = validated.title;
      if (validated.startDate !== undefined) updateData.startDate = new Date(validated.startDate);
      if (validated.endDate !== undefined) updateData.endDate = new Date(validated.endDate);
      if (validated.destinations !== undefined) updateData.destinations = validated.destinations;

      const itinerary = await prisma.itinerary.update({
        where: { id },
        data: updateData,
        include: {
          items: {
            orderBy: { order: 'asc' }
          }
        }
      });

      res.json(itinerary);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }

  /**
   * Delete an itinerary
   */
  async deleteItinerary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check ownership
      const existing = await prisma.itinerary.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      await prisma.itinerary.delete({
        where: { id }
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add an item to an itinerary
   */
  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: itineraryId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check ownership
      const itinerary = await prisma.itinerary.findFirst({
        where: { id: itineraryId, userId }
      });

      if (!itinerary) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      console.log('[ItineraryController] Received body:', JSON.stringify(req.body, null, 2));
      const validated = CreateItineraryItemSchema.parse(req.body);
      console.log('[ItineraryController] Validated data:', JSON.stringify(validated, null, 2));

      const item = await prisma.itineraryItem.create({
        data: {
          itineraryId,
          type: validated.type,
          itemId: validated.itemId || null,
          itemData: validated.itemData,
          price: validated.price,
          currency: validated.currency,
          quantity: validated.quantity,
          title: validated.title,
          description: validated.description || null,
          startDate: new Date(validated.startDate),
          endDate: new Date(validated.endDate),
          location: validated.location,
          order: validated.order
        }
      });

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }

  /**
   * Update an itinerary item
   */
  async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: itineraryId, itemId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check ownership
      const itinerary = await prisma.itinerary.findFirst({
        where: { id: itineraryId, userId }
      });

      if (!itinerary) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      const validated = UpdateItineraryItemSchema.parse(req.body);

      const updateData: any = {};
      if (validated.type !== undefined) updateData.type = validated.type;
      if (validated.itemId !== undefined) updateData.itemId = validated.itemId;
      if (validated.itemData !== undefined) updateData.itemData = validated.itemData;
      if (validated.price !== undefined) updateData.price = validated.price;
      if (validated.currency !== undefined) updateData.currency = validated.currency;
      if (validated.quantity !== undefined) updateData.quantity = validated.quantity;
      if (validated.title !== undefined) updateData.title = validated.title;
      if (validated.description !== undefined) updateData.description = validated.description;
      if (validated.startDate !== undefined) updateData.startDate = new Date(validated.startDate);
      if (validated.endDate !== undefined) updateData.endDate = new Date(validated.endDate);
      if (validated.location !== undefined) updateData.location = validated.location;
      if (validated.order !== undefined) updateData.order = validated.order;

      const item = await prisma.itineraryItem.update({
        where: { id: itemId },
        data: updateData
      });

      res.json(item);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }

  /**
   * Delete an itinerary item
   */
  async deleteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: itineraryId, itemId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check ownership
      const itinerary = await prisma.itinerary.findFirst({
        where: { id: itineraryId, userId }
      });

      if (!itinerary) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      await prisma.itineraryItem.delete({
        where: { id: itemId }
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reorder items (for drag-n-drop)
   */
  async reorderItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: itineraryId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check ownership
      const itinerary = await prisma.itinerary.findFirst({
        where: { id: itineraryId, userId }
      });

      if (!itinerary) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      const validated = ReorderItemsSchema.parse(req.body);

      // Update orders in transaction
      await prisma.$transaction(
        validated.items.map(({ id, order }) =>
          prisma.itineraryItem.update({
            where: { id },
            data: { order }
          })
        )
      );

      res.status(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }

  /**
   * Export itinerary (PDF, iCal, or Email)
   */
  async exportItinerary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { format } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedFormat = ExportFormatSchema.parse(format);

      // Get itinerary with items
      const itinerary = await prisma.itinerary.findFirst({
        where: { id, userId },
        include: {
          items: {
            orderBy: [{ startDate: 'asc' }, { order: 'asc' }]
          }
        }
      });

      if (!itinerary) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      // Get user email for email export
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true }
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      switch (validatedFormat) {
        case 'pdf':
          const pdfBuffer = await this.exportService.generatePDF(itinerary);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="itinerary-${itinerary.id}.pdf"`);
          res.send(pdfBuffer);
          break;

        case 'ical':
          const icalContent = this.exportService.generateICal(itinerary);
          res.setHeader('Content-Type', 'text/calendar');
          res.setHeader('Content-Disposition', `attachment; filename="itinerary-${itinerary.id}.ics"`);
          res.send(icalContent);
          break;

        case 'email':
          await this.exportService.sendEmailSummary(itinerary, user.email, user.firstName || 'Traveler');
          res.json({ message: 'Email sent successfully' });
          break;

        default:
          res.status(400).json({ error: 'Invalid export format' });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Invalid export format', details: error.issues });
        return;
      }
      next(error);
    }
  }
}
