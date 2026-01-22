/**
 * IA-001.4: Recommendation Service
 * Main service for managing recommendations, tracking interactions, and analytics
 */

import { PrismaClient, Recommendation, RecommendationStatus } from '@dreamscape/db';
import ScoringService from './ScoringService';
import VectorizationService from './VectorizationService';

const prisma = new PrismaClient();

export interface RecommendationOptions {
  limit?: number;
  contextType?: 'general' | 'onboarding' | 'search_based' | 'seasonal';
  minScore?: number;
  destinationType?: string;
  excludeBooked?: boolean;
}

export interface TrackingAction {
  action: 'viewed' | 'clicked' | 'booked' | 'rejected';
  rating?: number;
}

export class RecommendationService {
  /**
   * Generate and save recommendations for a user
   */
  async generateRecommendations(
    userId: string,
    options: RecommendationOptions = {}
  ): Promise<Recommendation[]> {
    const {
      limit = 10,
      contextType = 'general',
      minScore = 0.3,
      destinationType,
      excludeBooked = true,
    } = options;

    // Get previously booked destinations to exclude
    let excludeIds: string[] = [];
    if (excludeBooked) {
      const booked = await prisma.recommendation.findMany({
        where: {
          userId,
          status: 'BOOKED',
        },
        select: { destinationId: true },
      });
      excludeIds = booked.map(r => r.destinationId);
    }

    // Generate scored recommendations
    const scoredItems = await ScoringService.generateRecommendations(userId, {
      limit: limit * 2, // Get more to diversify
      minScore,
      destinationType,
      excludeIds,
    });

    // Diversify to avoid similar destinations
    const diverse = ScoringService.diversifyRecommendations(scoredItems, limit);

    // Get user vector for relationship
    const userVector = await prisma.userVector.findUnique({
      where: { userId },
    });

    // Save recommendations to database
    const recommendations = await Promise.all(
      diverse.map(async scored => {
        return await prisma.recommendation.create({
          data: {
            userId,
            userVectorId: userVector?.id,
            itemVectorId: scored.item.id,
            destinationId: scored.item.destinationId,
            destinationName: scored.item.name,
            destinationType: scored.item.destinationType,
            score: scored.score,
            confidence: scored.confidence,
            reasons: scored.reasons,
            contextType,
            contextData: {
              generatedAt: new Date().toISOString(),
              minScore,
              algorithm: 'hybrid_similarity',
            },
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        });
      })
    );

    return recommendations;
  }

  /**
   * Get active recommendations for a user
   */
  async getActiveRecommendations(
    userId: string,
    options: {
      limit?: number;
      status?: RecommendationStatus;
      includeItemVector?: boolean;
    } = {}
  ): Promise<Recommendation[]> {
    const { limit = 10, status, includeItemVector = false } = options;

    return await prisma.recommendation.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gte: new Date() },
        ...(status && { status }),
      },
      orderBy: { score: 'desc' },
      take: limit,
      ...(includeItemVector && {
        include: {
          itemVector: true,
        },
      }),
    });
  }

  /**
   * Track user interaction with a recommendation
   */
  async trackInteraction(
    recommendationId: string,
    action: TrackingAction
  ): Promise<Recommendation> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    switch (action.action) {
      case 'viewed':
        updateData.status = 'VIEWED';
        updateData.viewedAt = new Date();
        break;

      case 'clicked':
        updateData.status = 'CLICKED';
        updateData.clickedAt = new Date();
        // If not viewed yet, set viewedAt too
        const existing = await prisma.recommendation.findUnique({
          where: { id: recommendationId },
          select: { viewedAt: true },
        });
        if (!existing?.viewedAt) {
          updateData.viewedAt = new Date();
        }
        break;

      case 'booked':
        updateData.status = 'BOOKED';
        updateData.bookedAt = new Date();
        if (action.rating) {
          updateData.userRating = action.rating;
        }
        // Update item vector stats
        await this.updateItemVectorStats(recommendationId, 'booking');
        break;

      case 'rejected':
        updateData.status = 'REJECTED';
        updateData.rejectedAt = new Date();
        break;
    }

    return await prisma.recommendation.update({
      where: { id: recommendationId },
      data: updateData,
    });
  }

  /**
   * Update ItemVector statistics when a booking occurs
   */
  private async updateItemVectorStats(
    recommendationId: string,
    type: 'search' | 'booking'
  ): Promise<void> {
    const rec = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: { itemVector: true },
    });

    if (!rec?.itemVector) return;

    await prisma.itemVector.update({
      where: { id: rec.itemVector.id },
      data: {
        ...(type === 'booking' && {
          bookingCount: { increment: 1 },
          popularityScore: { increment: 0.01 },
        }),
        ...(type === 'search' && {
          searchCount: { increment: 1 },
        }),
      },
    });
  }

  /**
   * Clean up expired recommendations
   */
  async cleanupExpiredRecommendations(): Promise<number> {
    const result = await prisma.recommendation.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
      data: {
        isActive: false,
        status: 'EXPIRED',
      },
    });

    return result.count;
  }

  /**
   * Get recommendations by destination
   */
  async getRecommendationsByDestination(
    destinationId: string,
    options: { limit?: number } = {}
  ): Promise<Recommendation[]> {
    const { limit = 10 } = options;

    return await prisma.recommendation.findMany({
      where: {
        destinationId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Refresh user vector and regenerate recommendations
   */
  async refreshUserRecommendations(userId: string): Promise<Recommendation[]> {
    // Regenerate user vector from latest data
    await VectorizationService.saveUserVector(userId, 'refresh');

    // Deactivate old recommendations
    await prisma.recommendation.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Generate new recommendations
    return await this.generateRecommendations(userId, {
      contextType: 'general',
    });
  }

  /**
   * Get similar recommendations based on a destination
   */
  async getSimilarDestinations(
    destinationId: string,
    limit: number = 5
  ): Promise<any[]> {
    const itemVector = await prisma.itemVector.findFirst({
      where: { destinationId },
    });

    if (!itemVector) return [];

    const allItems = await prisma.itemVector.findMany({
      where: {
        id: { not: itemVector.id },
      },
    });

    const itemVec = itemVector.vector as number[];

    // Score all items by similarity
    const scored = allItems.map(item => {
      const vec = item.vector as number[];
      const score = ScoringService.cosineSimilarity(itemVec, vec);
      return { item, score };
    });

    // Return top similar
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({
        ...s.item,
        similarityScore: s.score,
      }));
  }

  /**
   * Batch update recommendations from external event (e.g., booking completed)
   */
  async batchUpdateFromBooking(userId: string, destinationId: string): Promise<void> {
    // Find all recommendations for this destination and mark as booked
    await prisma.recommendation.updateMany({
      where: {
        userId,
        destinationId,
        status: { in: ['GENERATED', 'VIEWED', 'CLICKED'] },
      },
      data: {
        status: 'BOOKED',
        bookedAt: new Date(),
      },
    });

    // Update item vector stats
    const itemVector = await prisma.itemVector.findFirst({
      where: { destinationId },
    });

    if (itemVector) {
      await prisma.itemVector.update({
        where: { id: itemVector.id },
        data: {
          bookingCount: { increment: 1 },
          popularityScore: { increment: 0.01 },
        },
      });
    }
  }
}

export default new RecommendationService();
