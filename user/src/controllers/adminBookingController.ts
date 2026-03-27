import { Response } from 'express';
import { AuthRequest } from '@middleware/auth';
import * as AdminBookingService from '../services/AdminBookingService';

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

const sendSuccess = (res: Response, data: any): void => {
  res.json({ success: true, data });
};

export const listBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const result = await AdminBookingService.listBookings({
      page, limit, search, status, type, startDate, endDate, sortBy, sortOrder,
    });
    sendSuccess(res, result);
  } catch (error: any) {
    console.error('Error listing bookings:', error);
    sendError(res, 500, error.message || 'Failed to list bookings');
  }
};

export const getBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await AdminBookingService.getBookingById(req.params.id);
    sendSuccess(res, booking);
  } catch (error: any) {
    if (error.message === 'Booking not found') {
      sendError(res, 404, error.message);
      return;
    }
    console.error('Error fetching booking:', error);
    sendError(res, 500, error.message || 'Failed to fetch booking');
  }
};

export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status) {
      sendError(res, 400, 'Status is required');
      return;
    }
    const booking = await AdminBookingService.updateBookingStatus(req.params.id, status);
    sendSuccess(res, booking);
  } catch (error: any) {
    if (error.message === 'Booking not found') {
      sendError(res, 404, error.message);
      return;
    }
    if (error.message === 'Invalid status') {
      sendError(res, 400, error.message);
      return;
    }
    console.error('Error updating booking status:', error);
    sendError(res, 500, error.message || 'Failed to update booking status');
  }
};

export const bulkUpdateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      sendError(res, 400, 'ids array is required');
      return;
    }
    if (!status) {
      sendError(res, 400, 'Status is required');
      return;
    }
    const result = await AdminBookingService.bulkUpdateBookingStatus(ids, status);
    sendSuccess(res, result);
  } catch (error: any) {
    if (error.message === 'Invalid status') {
      sendError(res, 400, error.message);
      return;
    }
    console.error('Error bulk updating booking statuses:', error);
    sendError(res, 500, error.message || 'Failed to bulk update');
  }
};
