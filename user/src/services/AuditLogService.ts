import { prisma } from '@dreamscape/db';
import { DataAccessAction } from '@dreamscape/db';

class AuditLogService {
  async logAccess(data: {
    userId: string;
    accessorId?: string;
    accessorType: string;
    action: DataAccessAction;
    resource: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
  }) {
    try {
      const log = await prisma.dataAccessLog.create({
        data: {
          userId: data.userId,
          accessorId: data.accessorId,
          accessorType: data.accessorType,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          endpoint: data.endpoint,
          method: data.method,
          accessedAt: new Date(),
        },
      });

      return log;
    } catch (error) {
      throw new Error(`Failed to log access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAccessLogs(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      resource?: string;
    }
  ) {
    try {
      const where: any = { userId };

      if (options?.resource) {
        where.resource = options.resource;
      }

      const logs = await prisma.dataAccessLog.findMany({
        where,
        orderBy: { accessedAt: 'desc' },
        take: options?.limit,
        skip: options?.offset,
      });

      return logs;
    } catch (error) {
      throw new Error(`Failed to get access logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new AuditLogService();
