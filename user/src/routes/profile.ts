import { Router, Request, Response } from 'express';
import prisma from '../../../db/client';
import multer from 'multer';
import path from 'path';

const router = Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Helper function to send error responses
const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ error: message });
};

// Validation helper
const validateProfileData = (data: any) => {
  const errors: string[] = [];
  
  if (data.firstName && typeof data.firstName !== 'string') {
    errors.push('First name must be a string');
  }
  
  if (data.lastName && typeof data.lastName !== 'string') {
    errors.push('Last name must be a string');
  }
  
  if (data.phone && !/^\+?[\d\s-()]+$/.test(data.phone)) {
    errors.push('Invalid phone number format');
  }
  
  if (data.dateOfBirth) {
    const date = new Date(data.dateOfBirth);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date of birth');
    }
  }
  
  return errors;
};

// Get user profile
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return sendError(res, 400, 'User ID is required');
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!profile) {
      return sendError(res, 404, 'Profile not found');
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    sendError(res, 500, 'Failed to fetch profile');
  }
});

// Create user profile
router.post('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, dateOfBirth, preferences } = req.body;

    if (!userId) {
      return sendError(res, 400, 'User ID is required');
    }

    if (!firstName || !lastName) {
      return sendError(res, 400, 'First name and last name are required');
    }

    const validationErrors = validateProfileData(req.body);
    if (validationErrors.length > 0) {
      return sendError(res, 400, validationErrors.join(', '));
    }

    const profile = await prisma.userProfile.create({
      data: {
        userId,
        firstName,
        lastName,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        preferences
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json(profile);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return sendError(res, 409, 'Profile already exists for this user');
    }
    console.error('Error creating profile:', error);
    sendError(res, 500, 'Failed to create profile');
  }
});

// Update user profile
router.put('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    if (!userId) {
      return sendError(res, 400, 'User ID is required');
    }

    const validationErrors = validateProfileData(updateData);
    if (validationErrors.length > 0) {
      return sendError(res, 400, validationErrors.join(', '));
    }

    // Process dateOfBirth if provided
    if (updateData.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    const profile = await prisma.userProfile.update({
      where: { userId },
      data: updateData,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json(profile);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Profile not found');
    }
    console.error('Error updating profile:', error);
    sendError(res, 500, 'Failed to update profile');
  }
});

// Upload avatar
router.post('/:userId/avatar', upload.single('avatar'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return sendError(res, 400, 'User ID is required');
    }

    if (!req.file) {
      return sendError(res, 400, 'No avatar file uploaded');
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const profile = await prisma.userProfile.update({
      where: { userId },
      data: { avatar: avatarUrl },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json({ 
      message: 'Avatar uploaded successfully',
      avatar: avatarUrl,
      profile
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Profile not found');
    }
    console.error('Error uploading avatar:', error);
    sendError(res, 500, 'Failed to upload avatar');
  }
});

// Delete user profile
router.delete('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return sendError(res, 400, 'User ID is required');
    }

    await prisma.userProfile.delete({
      where: { userId }
    });

    res.json({ message: 'Profile deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Profile not found');
    }
    console.error('Error deleting profile:', error);
    sendError(res, 500, 'Failed to delete profile');
  }
});

export default router;