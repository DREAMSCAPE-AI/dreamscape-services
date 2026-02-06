import { prisma } from '@dreamscape/db';

class PrivacyPolicyService {
  async getCurrentPolicy() {
    try {
      const now = new Date();
      const policy = await prisma.privacyPolicy.findFirst({
        where: {
          effectiveAt: {
            lte: now,
          },
        },
        orderBy: {
          effectiveAt: 'desc',
        },
      });

      if (!policy) {
        throw new Error('No active privacy policy found');
      }

      return policy;
    } catch (error) {
      throw new Error(`Failed to get current policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllVersions() {
    try {
      const policies = await prisma.privacyPolicy.findMany({
        orderBy: {
          effectiveAt: 'desc',
        },
      });

      return policies;
    } catch (error) {
      throw new Error(`Failed to get policy versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async acceptPolicy(userId: string, policyId: string, ipAddress?: string, userAgent?: string) {
    try {
      const policy = await prisma.privacyPolicy.findUnique({
        where: { id: policyId },
      });

      if (!policy) {
        throw new Error('Policy not found');
      }

      const acceptance = await prisma.userPolicyAcceptance.upsert({
        where: {
          userId_policyId: {
            userId,
            policyId,
          },
        },
        update: {
          acceptedAt: new Date(),
          ipAddress,
          userAgent,
        },
        create: {
          userId,
          policyId,
          policyVersion: policy.version,
          acceptedAt: new Date(),
          ipAddress,
          userAgent,
        },
      });

      return acceptance;
    } catch (error) {
      throw new Error(`Failed to accept policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async hasAcceptedCurrentPolicy(userId: string): Promise<boolean> {
    try {
      const currentPolicy = await this.getCurrentPolicy();

      const acceptance = await prisma.userPolicyAcceptance.findUnique({
        where: {
          userId_policyId: {
            userId,
            policyId: currentPolicy.id,
          },
        },
      });

      return !!acceptance;
    } catch (error) {
      throw new Error(`Failed to check policy acceptance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new PrivacyPolicyService();
