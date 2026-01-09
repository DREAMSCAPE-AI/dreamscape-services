import { z } from 'zod';

// ========== ENUMS ==========
export enum ItineraryItemType {
  FLIGHT = 'FLIGHT',
  HOTEL = 'HOTEL',
  ACTIVITY = 'ACTIVITY'
}

// ========== VALIDATION SCHEMAS ==========
export const CreateItinerarySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
  destinations: z.array(z.string()).default([])
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after or equal to start date', path: ['endDate'] }
);

export const UpdateItinerarySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  startDate: z.string().datetime().or(z.date()).optional(),
  endDate: z.string().datetime().or(z.date()).optional(),
  destinations: z.array(z.string()).optional()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: 'End date must be after or equal to start date', path: ['endDate'] }
);

export const CreateItineraryItemSchema = z.object({
  type: z.nativeEnum(ItineraryItemType),

  // Cart compatibility fields
  itemId: z.string().optional(), // External ID (Amadeus offer ID, etc.)
  itemData: z.record(z.any()), // Full cart-compatible data
  price: z.number().positive(),
  currency: z.string().default('USD'),
  quantity: z.number().int().positive().default(1),

  // Display fields (derived from itemData)
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
  location: z.string().min(1, 'Location is required'),

  // UI fields
  order: z.number().int().min(0).default(0)
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after or equal to start date', path: ['endDate'] }
);

export const UpdateItineraryItemSchema = z.object({
  type: z.nativeEnum(ItineraryItemType).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  startDate: z.string().datetime().or(z.date()).optional(),
  endDate: z.string().datetime().or(z.date()).optional(),
  location: z.string().min(1).optional(),
  details: z.record(z.any()).optional().nullable(),
  order: z.number().int().min(0).optional()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: 'End date must be after or equal to start date', path: ['endDate'] }
);

export const ReorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    order: z.number().int().min(0)
  }))
});

export const ExportFormatSchema = z.enum(['pdf', 'ical', 'email']);

// ========== TYPES ==========
export type CreateItineraryDto = z.infer<typeof CreateItinerarySchema>;
export type UpdateItineraryDto = z.infer<typeof UpdateItinerarySchema>;
export type CreateItineraryItemDto = z.infer<typeof CreateItineraryItemSchema>;
export type UpdateItineraryItemDto = z.infer<typeof UpdateItineraryItemSchema>;
export type ReorderItemsDto = z.infer<typeof ReorderItemsSchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

// ========== RESPONSE TYPES ==========
export interface ItineraryItemResponse {
  id: string;
  itineraryId: string;
  type: ItineraryItemType;

  // Cart compatibility fields
  itemId: string | null;
  itemData: Record<string, any>;
  price: number;
  currency: string;
  quantity: number;

  // Display fields
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  location: string;

  // UI fields
  order: number;
  createdAt: Date;
}

export interface ItineraryResponse {
  id: string;
  userId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  destinations: string[];
  aiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
  items?: ItineraryItemResponse[];
}
