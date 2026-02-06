import { prisma } from '@dreamscape/db';

class ConsentService {
  async getUserConsent(userId: string) {
    try {
      const consent = await prisma.userConsent.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          analytics: false,
          marketing: false,
          functional: true,
          preferences: true,
        },
      });

      return consent;
    } catch (error) {
      throw new Error(`Failed to get user consent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateConsent(
    userId: string,
    data: {
      analytics?: boolean;
      marketing?: boolean;
      preferences?: boolean;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const currentConsent = await this.getUserConsent(userId);

      const updatedConsent = await prisma.userConsent.update({
        where: { userId },
        data: {
          ...data,
          lastUpdatedAt: new Date(),
          ipAddress,
        },
      });

      await prisma.consentHistory.create({
        data: {
          consentId: currentConsent.id,
          userId,
          analytics: updatedConsent.analytics,
          marketing: updatedConsent.marketing,
          functional: updatedConsent.functional,
          preferences: updatedConsent.preferences,
          changedAt: new Date(),
          ipAddress,
          userAgent,
        },
      });

      return updatedConsent;
    } catch (error) {
      throw new Error(`Failed to update consent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getConsentHistory(userId: string) {
    try {
      const consent = await prisma.userConsent.findUnique({
        where: { userId },
      });

      if (!consent) {
        return [];
      }

      const history = await prisma.consentHistory.findMany({
        where: { userId },
        orderBy: { changedAt: 'desc' },
      });

      return history;
    } catch (error) {
      throw new Error(`Failed to get consent history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new ConsentService();
