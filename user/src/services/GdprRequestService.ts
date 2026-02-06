import { prisma } from '@dreamscape/db';
import { GdprRequestType, GdprRequestStatus } from '@dreamscape/db';

class GdprRequestService {
  async requestDataExport(userId: string) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const request = await prisma.gdprRequest.create({
        data: {
          userId,
          requestType: GdprRequestType.DATA_EXPORT,
          status: GdprRequestStatus.PENDING,
          expiresAt,
        },
      });

      return request;
    } catch (error) {
      throw new Error(`Failed to create data export request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async requestDataDeletion(userId: string, reason?: string) {
    try {
      const request = await prisma.gdprRequest.create({
        data: {
          userId,
          requestType: GdprRequestType.DATA_DELETION,
          status: GdprRequestStatus.PENDING,
          reason,
        },
      });

      return request;
    } catch (error) {
      throw new Error(`Failed to create data deletion request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserRequests(userId: string) {
    try {
      const requests = await prisma.gdprRequest.findMany({
        where: { userId },
        orderBy: { requestedAt: 'desc' },
      });

      return requests;
    } catch (error) {
      throw new Error(`Failed to get user requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRequestById(requestId: string, userId: string) {
    try {
      const request = await prisma.gdprRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Request not found');
      }

      if (request.userId !== userId) {
        throw new Error('Unauthorized: Request does not belong to user');
      }

      return request;
    } catch (error) {
      throw new Error(`Failed to get request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processExport(requestId: string) {
    try {
      const request = await prisma.gdprRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Request not found');
      }

      if (request.requestType !== GdprRequestType.DATA_EXPORT) {
        throw new Error('Request is not a data export request');
      }

      await prisma.gdprRequest.update({
        where: { id: requestId },
        data: {
          status: GdprRequestStatus.IN_PROGRESS,
          processedAt: new Date(),
        },
      });

      const userData = await prisma.user.findUnique({
        where: { id: request.userId },
        include: {
          profile: true,
          preferences: true,
          settings: true,
          favorites: true,
          history: true,
          travelOnboarding: true,
          consent: {
            include: {
              history: true,
            },
          },
          searches: true,
          policyAcceptances: true,
        },
      });

      if (!userData) {
        throw new Error('User not found');
      }

      const exportData = {
        user: {
          id: userData.id,
          email: userData.email,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber,
          dateOfBirth: userData.dateOfBirth,
          nationality: userData.nationality,
          userCategory: userData.userCategory,
          isVerified: userData.isVerified,
          role: userData.role,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
        },
        profile: userData.profile,
        preferences: userData.preferences,
        settings: userData.settings,
        favorites: userData.favorites,
        history: userData.history,
        travelOnboarding: userData.travelOnboarding,
        consent: userData.consent,
        searches: userData.searches,
        policyAcceptances: userData.policyAcceptances,
      };

      const updatedRequest = await prisma.gdprRequest.update({
        where: { id: requestId },
        data: {
          status: GdprRequestStatus.COMPLETED,
          completedAt: new Date(),
          exportData,
        },
      });

      return updatedRequest;
    } catch (error) {
      await prisma.gdprRequest.update({
        where: { id: requestId },
        data: {
          status: GdprRequestStatus.REJECTED,
          notes: error instanceof Error ? error.message : 'Unknown error',
        },
      }).catch(() => {});

      throw new Error(`Failed to process export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getExportData(requestId: string, userId: string) {
    try {
      const request = await this.getRequestById(requestId, userId);

      if (request.status !== GdprRequestStatus.COMPLETED) {
        throw new Error('Export is not completed yet');
      }

      if (!request.exportData) {
        throw new Error('Export data not available');
      }

      return request.exportData;
    } catch (error) {
      throw new Error(`Failed to get export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new GdprRequestService();
