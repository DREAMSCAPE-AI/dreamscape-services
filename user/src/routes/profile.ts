import { Router, Request, Response } from 'express';
import { prisma } from '@dreamscape/db';
import multer from 'multer';
import path from 'path';
import { authenticateToken, AuthRequest } from '@middleware/auth';

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

// Get user profile and settings (require authentication)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Assuming userId is available from auth middleware
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        settings: true
      }
    });

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    res.json({
      profile: {
        name: user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '',
        email: user.email,
        photo: user.profile?.avatar || null
      },
      preferences: {
        language: user.settings?.language || 'English',
        currency: user.settings?.currency || 'USD',
        timezone: user.settings?.timezone || 'UTC'
      },
      notifications: {
        dealAlerts: user.settings?.dealAlerts ?? true,
        tripReminders: user.settings?.tripReminders ?? true,
        priceAlerts: user.settings?.priceAlerts ?? true,
        newsletter: user.settings?.newsletter ?? false
      },
      privacy: {
        profileVisibility: user.settings?.profileVisibility || 'public',
        dataSharing: user.settings?.dataSharing ?? false,
        marketing: user.settings?.marketing ?? true
      },
      travel: {
        preferredDestinations: user.settings?.preferredDestinations || [],
        accommodationType: user.settings?.accommodationType || [],
        activities: user.settings?.activities || [],
        dietary: user.settings?.dietary || []
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
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

// Update user profile and settings
router.put('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { profile, preferences, notifications, privacy, travel } = req.body;

    if (!userId) {
      return sendError(res, 401, 'Authentication required');
    }

    // Update user basic info if provided
    if (profile?.name !== undefined || profile?.email !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(profile?.name !== undefined && { username: profile.name }),
          ...(profile?.email !== undefined && { email: profile.email })
        }
      });
    }

    // Update user settings (create if doesn't exist)
    const userSettings = await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        language: preferences?.language || 'English',
        currency: preferences?.currency || 'USD',
        timezone: preferences?.timezone || 'UTC',
        dealAlerts: notifications?.dealAlerts ?? true,
        tripReminders: notifications?.tripReminders ?? true,
        priceAlerts: notifications?.priceAlerts ?? true,
        newsletter: notifications?.newsletter ?? false,
        profileVisibility: privacy?.profileVisibility || 'public',
        dataSharing: privacy?.dataSharing ?? false,
        marketing: privacy?.marketing ?? true,
        preferredDestinations: travel?.preferredDestinations || [],
        accommodationType: travel?.accommodationType || [],
        activities: travel?.activities || [],
        dietary: travel?.dietary || []
      },
      update: {
        language: preferences?.language,
        currency: preferences?.currency,
        timezone: preferences?.timezone,
        dealAlerts: notifications?.dealAlerts,
        tripReminders: notifications?.tripReminders,
        priceAlerts: notifications?.priceAlerts,
        newsletter: notifications?.newsletter,
        profileVisibility: privacy?.profileVisibility,
        dataSharing: privacy?.dataSharing,
        marketing: privacy?.marketing,
        preferredDestinations: travel?.preferredDestinations,
        accommodationType: travel?.accommodationType,
        activities: travel?.activities,
        dietary: travel?.dietary
      }
    });

    // Update user profile if provided
    if (profile?.photo) {
      // Get user data for firstName and lastName
      const user = await prisma.user.findUnique({ where: { id: userId } });

      await prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          avatar: profile.photo
        },
        update: {
          avatar: profile.photo
        }
      });
    }

    // Get updated user data
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        settings: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      profile: {
        name: updatedUser?.username || '',
        email: updatedUser?.email || '',
        photo: updatedUser?.profile?.avatar || null
      },
      preferences: {
        language: userSettings.language,
        currency: userSettings.currency,
        timezone: userSettings.timezone
      },
      notifications: {
        dealAlerts: userSettings.dealAlerts,
        tripReminders: userSettings.tripReminders,
        priceAlerts: userSettings.priceAlerts,
        newsletter: userSettings.newsletter
      },
      privacy: {
        profileVisibility: userSettings.profileVisibility,
        dataSharing: userSettings.dataSharing,
        marketing: userSettings.marketing
      },
      travel: {
        preferredDestinations: userSettings.preferredDestinations,
        accommodationType: userSettings.accommodationType,
        activities: userSettings.activities,
        dietary: userSettings.dietary
      }
    });
  } catch (error: any) {
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