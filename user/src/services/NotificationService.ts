import { prisma } from '@dreamscape/db';
import { socketService } from './SocketService';
import { userKafkaService } from './KafkaService';

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

  async createNotification(
    userId: string,
    data: {
      type?: string;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: (data.type as never) ?? 'SYSTEM',
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

    return notification;
  }
}

export default new NotificationService();
