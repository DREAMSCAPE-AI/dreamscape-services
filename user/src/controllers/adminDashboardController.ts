import { Response } from 'express';
import { AuthRequest } from '@middleware/auth';
import * as AdminDashboardService from '../services/AdminDashboardService';

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

const sendSuccess = (res: Response, data: any): void => {
  res.json({ success: true, data });
};

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const periodParam = (req.query.period as string) || '7d';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const period = AdminDashboardService.parsePeriod(periodParam, startDate, endDate);
    const stats = await AdminDashboardService.getStats(period);
    sendSuccess(res, stats);
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    sendError(res, 500, error.message || 'Failed to fetch dashboard stats');
  }
};

export const getRevenueChart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const periodParam = (req.query.period as string) || '7d';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const period = AdminDashboardService.parsePeriod(periodParam, startDate, endDate);
    const chart = await AdminDashboardService.getRevenueChart(period);
    sendSuccess(res, chart);
  } catch (error: any) {
    console.error('Error fetching revenue chart:', error);
    sendError(res, 500, error.message || 'Failed to fetch revenue chart');
  }
};

export const getBookingsByDestination = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const periodParam = (req.query.period as string) || '7d';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const period = AdminDashboardService.parsePeriod(periodParam, startDate, endDate);
    const data = await AdminDashboardService.getBookingsByDestination(limit, period);
    sendSuccess(res, data);
  } catch (error: any) {
    console.error('Error fetching bookings by destination:', error);
    sendError(res, 500, error.message || 'Failed to fetch bookings by destination');
  }
};

export const getRecentTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const periodParam = (req.query.period as string) || '7d';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const period = AdminDashboardService.parsePeriod(periodParam, startDate, endDate);
    const data = await AdminDashboardService.getRecentTransactions(limit, period);
    sendSuccess(res, data);
  } catch (error: any) {
    console.error('Error fetching recent transactions:', error);
    sendError(res, 500, error.message || 'Failed to fetch recent transactions');
  }
};
