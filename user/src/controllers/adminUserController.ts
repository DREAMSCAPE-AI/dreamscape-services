import { Response } from 'express';
import { AuthRequest } from '@middleware/auth';
import * as AdminUserService from '../services/AdminUserService';

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

const sendSuccess = (res: Response, data: any): void => {
  res.json({ success: true, data });
};

export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const result = await AdminUserService.listUsers({ page, limit, search, role, sortBy, sortOrder });
    sendSuccess(res, result);
  } catch (error: any) {
    console.error('Error listing users:', error);
    sendError(res, 500, error.message || 'Failed to list users');
  }
};

export const getUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await AdminUserService.getUserById(req.params.id);
    sendSuccess(res, user);
  } catch (error: any) {
    if (error.message === 'User not found') {
      sendError(res, 404, error.message);
      return;
    }
    console.error('Error fetching user:', error);
    sendError(res, 500, error.message || 'Failed to fetch user');
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, role, isVerified, userCategory } = req.body;
    const user = await AdminUserService.updateUser(req.params.id, {
      firstName, lastName, email, role, isVerified, userCategory,
    });
    sendSuccess(res, user);
  } catch (error: any) {
    if (error.message === 'User not found') {
      sendError(res, 404, error.message);
      return;
    }
    if (error.message === 'Email already in use') {
      sendError(res, 409, error.message);
      return;
    }
    console.error('Error updating user:', error);
    sendError(res, 500, error.message || 'Failed to update user');
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.params.id === req.user?.id) {
      sendError(res, 400, 'Cannot delete your own account');
      return;
    }
    const result = await AdminUserService.deleteUser(req.params.id);
    sendSuccess(res, result);
  } catch (error: any) {
    if (error.message === 'User not found') {
      sendError(res, 404, error.message);
      return;
    }
    console.error('Error deleting user:', error);
    sendError(res, 500, error.message || 'Failed to delete user');
  }
};
