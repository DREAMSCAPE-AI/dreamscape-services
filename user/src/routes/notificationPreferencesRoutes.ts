import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '@dreamscape/db';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  PREFERENCE_KEYS,
} from '../types/notificationPreferences';

const router = Router();

/**
 * Validate that the body matches NotificationPreferences shape.
 * Returns a cleaned object or null if invalid.
 */
function validatePreferences(body: unknown): NotificationPreferences | null {
  if (!body || typeof body !== 'object') return null;

  const result: Record<string, { inApp: boolean; email: boolean }> = {};

  for (const key of PREFERENCE_KEYS) {
    const entry = (body as Record<string, unknown>)[key];
    if (!entry || typeof entry !== 'object') return null;

    const { inApp, email } = entry as Record<string, unknown>;
    if (typeof inApp !== 'boolean' || typeof email !== 'boolean') return null;

    result[key] = { inApp, email };
  }

  return result as unknown as NotificationPreferences;
}

/**
 * GET /api/v1/users/notification-preferences
 * Returns the user's notification preferences or defaults if not yet set.
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { notificationPreferences: true },
    });

    const prefs = (settings?.notificationPreferences as NotificationPreferences | null)
      ?? DEFAULT_NOTIFICATION_PREFERENCES;

    res.json({ success: true, data: prefs });
  } catch (error) {
    console.error('[NotificationPreferencesRoutes] GET / error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notification preferences' });
  }
});

/**
 * PUT /api/v1/users/notification-preferences
 * Validates and upserts notification preferences into UserSettings.
 */
router.put('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const validated = validatePreferences(req.body);

    if (!validated) {
      res.status(400).json({
        success: false,
        message: 'Invalid notification preferences. Expected keys: ' + PREFERENCE_KEYS.join(', ') +
          ', each with { inApp: boolean, email: boolean }.',
      });
      return;
    }

    await prisma.userSettings.upsert({
      where: { userId },
      update: { notificationPreferences: validated as unknown as Record<string, unknown> },
      create: {
        userId,
        notificationPreferences: validated as unknown as Record<string, unknown>,
      },
    });

    res.json({ success: true, data: validated });
  } catch (error) {
    console.error('[NotificationPreferencesRoutes] PUT / error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification preferences' });
  }
});

export default router;
