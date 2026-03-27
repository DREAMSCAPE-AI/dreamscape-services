import { Response } from 'express';
import { AuthRequest } from '@middleware/auth';
import * as AdminPaymentService from '../services/AdminPaymentService';

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

const sendSuccess = (res: Response, data: any): void => {
  res.json({ success: true, data });
};

export const listPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;
    const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const result = await AdminPaymentService.listPayments({
      page, limit, search, status, startDate, endDate, minAmount, maxAmount, sortBy, sortOrder,
    });
    sendSuccess(res, result);
  } catch (error: any) {
    console.error('Error listing payments:', error);
    sendError(res, 500, error.message || 'Failed to list payments');
  }
};

export const getPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await AdminPaymentService.getPaymentById(req.params.id);
    sendSuccess(res, payment);
  } catch (error: any) {
    if (error.message === 'Payment not found') {
      sendError(res, 404, error.message);
      return;
    }
    console.error('Error fetching payment:', error);
    sendError(res, 500, error.message || 'Failed to fetch payment');
  }
};

export const updatePaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status) {
      sendError(res, 400, 'Status is required');
      return;
    }
    const payment = await AdminPaymentService.updatePaymentStatus(req.params.id, status);
    sendSuccess(res, payment);
  } catch (error: any) {
    if (error.message === 'Payment not found') {
      sendError(res, 404, error.message);
      return;
    }
    if (error.message === 'Invalid status') {
      sendError(res, 400, error.message);
      return;
    }
    console.error('Error updating payment status:', error);
    sendError(res, 500, error.message || 'Failed to update payment status');
  }
};
