import { prisma } from '@dreamscape/db';
import { socketService } from './SocketService';
import { userKafkaService } from './KafkaService';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_TYPE_TO_PREF_KEY,
  ALWAYS_ON_TYPES,
} from '../types/notificationPreferences';

type NotificationFilter = 'all' | 'unread' | 'read';

class NotificationService {
  async getNotifications(
    userId: string,
    filter: NotificationFilter = 'all',
    page = 1,
    limit = 20,
  ) {
    const where: { userId: string; read?: boolean } = { userId };
    if (filter === 'unread') where.read = false;
    if (filter === 'read') where.read = true;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        hasMore: page * limit < total,
      },
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, read: false } });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      return null;
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  /**
   * Check whether a notification should be sent for a given type and channel.
   * Always-on types (ACCOUNT_SECURITY, SYSTEM, PRICE_ALERT, TRIP_REMINDER) always return true.
   */
  async shouldSend(
    userId: string,
    type: string,
    channel: 'inApp' | 'email',
  ): Promise<boolean> {
    if (ALWAYS_ON_TYPES.has(type)) return true;

    const prefKey = NOTIFICATION_TYPE_TO_PREF_KEY[type];
    if (!prefKey) return true; // Unknown type — default to sending

    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });

      const prefs = (settings?.notificationPreferences as NotificationPreferences | null)
        ?? DEFAULT_NOTIFICATION_PREFERENCES;

      return prefs[prefKey]?.[channel] ?? true;
    } catch (error) {
      console.error('[NotificationService] shouldSend error, defaulting to true:', error);
      return true;
    }
  }

  async createNotification(
    userId: string,
    data: {
      type?: string;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const notificationType = data.type ?? 'SYSTEM';

    // Check in-app preference before creating
    const shouldCreateInApp = await this.shouldSend(userId, notificationType, 'inApp');
    if (!shouldCreateInApp) {
      // Still check if email should be sent even if in-app is disabled
      const shouldSendEmail = await this.shouldSend(userId, notificationType, 'email');
      if (shouldSendEmail) {
        userKafkaService
          .publishNotificationEmailRequested({
            userId,
            type: notificationType,
            title: data.title,
            message: data.message,
            metadata: data.metadata,
            requestedAt: new Date().toISOString(),
          })
          .catch((err) =>
            console.error('[NotificationService] Kafka email request publish error:', err),
          );
      }
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: (notificationType as never) ?? 'SYSTEM',
        title: data.title,
        message: data.message,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    });

    // Emit real-time event (non-blocking)
    socketService.emitToUser(userId, 'notification:new', notification);

    // Publish Kafka event (non-blocking)
    userKafkaService
      .publishNotificationInAppCreated({
        notificationId: notification.id,
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt.toISOString(),
      })
      .catch((err) =>
        console.error('[NotificationService] Kafka publish error:', err),
      );

    // Check email preference and emit email request if enabled (DR-447)
    const shouldSendEmail = await this.shouldSend(userId, notificationType, 'email');
    if (shouldSendEmail) {
      userKafkaService
        .publishNotificationEmailRequested({
          notificationId: notification.id,
          userId,
          type: notificationType,
          title: data.title,
          message: data.message,
          metadata: data.metadata,
          requestedAt: new Date().toISOString(),
        })
        .catch((err) =>
          console.error('[NotificationService] Kafka email request publish error:', err),
        );
    }

    return notification;
  }
}

export default new NotificationService();
