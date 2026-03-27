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
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';
    const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;
    const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined;
    const destination = req.query.destination as string | undefined;

    const result = await AdminBookingService.listBookings({
      page, limit, search, status, type, startDate, endDate, sortBy, sortOrder, minAmount, maxAmount, destination,
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
    if (error.message === 'Booking not found') { sendError(res, 404, error.message); return; }
    console.error('Error fetching booking:', error);
    sendError(res, 500, error.message || 'Failed to fetch booking');
  }
};

export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status) { sendError(res, 400, 'Status is required'); return; }
    const booking = await AdminBookingService.updateBookingStatus(req.params.id, status);
    sendSuccess(res, booking);
  } catch (error: any) {
    if (error.message === 'Booking not found') { sendError(res, 404, error.message); return; }
    if (error.message === 'Invalid status') { sendError(res, 400, error.message); return; }
    console.error('Error updating booking status:', error);
    sendError(res, 500, error.message || 'Failed to update booking status');
  }
};

export const bulkUpdateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) { sendError(res, 400, 'ids array is required'); return; }
    if (!status) { sendError(res, 400, 'Status is required'); return; }
    const result = await AdminBookingService.bulkUpdateBookingStatus(ids, status);
    sendSuccess(res, result);
  } catch (error: any) {
    if (error.message === 'Invalid status') { sendError(res, 400, error.message); return; }
    console.error('Error bulk updating booking statuses:', error);
    sendError(res, 500, error.message || 'Failed to bulk update');
  }
};

export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refund = false, reason = '' } = req.body;
    const booking = await AdminBookingService.cancelBooking(req.params.id, Boolean(refund), String(reason));
    sendSuccess(res, booking);
  } catch (error: any) {
    if (error.message === 'Booking not found') { sendError(res, 404, error.message); return; }
    if (error.message === 'Booking already cancelled' || error.message === 'Cannot cancel a completed booking') {
      sendError(res, 409, error.message); return;
    }
    console.error('Error cancelling booking:', error);
    sendError(res, 500, error.message || 'Failed to cancel booking');
  }
};

export const modifyBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { totalAmount, notes, data } = req.body;
    const booking = await AdminBookingService.modifyBooking(req.params.id, { totalAmount, notes, data });
    sendSuccess(res, booking);
  } catch (error: any) {
    if (error.message === 'Booking not found') { sendError(res, 404, error.message); return; }
    console.error('Error modifying booking:', error);
    sendError(res, 500, error.message || 'Failed to modify booking');
  }
};

export const resendEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AdminBookingService.resendConfirmationEmail(req.params.id);
    sendSuccess(res, result);
  } catch (error: any) {
    if (error.message === 'Booking not found') { sendError(res, 404, error.message); return; }
    if (error.message === 'SENDGRID_NOT_CONFIGURED') {
      sendError(res, 503, 'Envoi d\'email non disponible : SENDGRID_API_KEY manquante dans la configuration du serveur.');
      return;
    }
    console.error('Error resending email:', error);
    sendError(res, 500, error.message || 'Failed to resend email');
  }
};

export const exportBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;
    const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined;
    const destination = req.query.destination as string | undefined;

    const csv = await AdminBookingService.exportBookings({ search, status, type, startDate, endDate, minAmount, maxAmount, destination });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings-export.csv"');
    res.send(csv);
  } catch (error: any) {
    console.error('Error exporting bookings:', error);
    sendError(res, 500, error.message || 'Failed to export bookings');
  }
};
