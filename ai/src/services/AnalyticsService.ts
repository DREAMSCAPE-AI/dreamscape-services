/**
 * IA-001.4: Analytics Service
 * Provides analytics and metrics for the recommendation system
 */

import { prisma, RecommendationStatus } from '@dreamscape/db';

export interface RecommendationMetrics {
  totalGenerated: number;
  totalViewed: number;
  totalClicked: number;
  totalBooked: number;
  totalRejected: number;
  totalExpired: number;
  viewRate: number; // % viewed
  clickThroughRate: number; // % clicked after viewed
  conversionRate: number; // % booked after clicked
  averageScore: number;
  averageConfidence: number;
}

export interface DestinationPerformance {
  destinationId: string;
  destinationName: string;
  totalRecommendations: number;
  bookings: number;
  views: number;
  clicks: number;
  conversionRate: number;
  averageScore: number;
  averageRating: number | null;
}

export interface UserEngagement {
  userId: string;
  totalRecommendationsReceived: number;
  viewedCount: number;
  clickedCount: number;
  bookedCount: number;
  engagementRate: number;
  averageRating: number | null;
}

export class AnalyticsService {
  /**
   * Get overall recommendation metrics
   */
  async getOverallMetrics(
    dateRange?: { from: Date; to: Date }
  ): Promise<RecommendationMetrics> {
    const where = dateRange
      ? {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        }
      : {};

    const [
      totalGenerated,
      totalViewed,
      totalClicked,
      totalBooked,
      totalRejected,
      totalExpired,
      averages,
    ] = await Promise.all([
      prisma.recommendation.count({ where: { ...where, status: 'GENERATED' } }),
      prisma.recommendation.count({ where: { ...where, status: 'VIEWED' } }),
      prisma.recommendation.count({ where: { ...where, status: 'CLICKED' } }),
      prisma.recommendation.count({ where: { ...where, status: 'BOOKED' } }),
      prisma.recommendation.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.recommendation.count({ where: { ...where, status: 'EXPIRED' } }),
      prisma.recommendation.aggregate({
        where,
        _avg: {
          score: true,
          confidence: true,
        },
      }),
    ]);

    const total = totalGenerated + totalViewed + totalClicked + totalBooked + totalRejected + totalExpired;
    const viewedOrBeyond = totalViewed + totalClicked + totalBooked;
    const clickedOrBeyond = totalClicked + totalBooked;

    return {
      totalGenerated,
      totalViewed,
      totalClicked,
      totalBooked,
      totalRejected,
      totalExpired,
      viewRate: total > 0 ? (viewedOrBeyond / total) * 100 : 0,
      clickThroughRate: viewedOrBeyond > 0 ? (clickedOrBeyond / viewedOrBeyond) * 100 : 0,
      conversionRate: clickedOrBeyond > 0 ? (totalBooked / clickedOrBeyond) * 100 : 0,
      averageScore: averages._avg.score ?? 0,
      averageConfidence: averages._avg.confidence ?? 0,
    };
  }

  /**
   * Get destination performance metrics
   */
  async getDestinationPerformance(
    options: {
      limit?: number;
      dateRange?: { from: Date; to: Date };
      sortBy?: 'bookings' | 'conversionRate' | 'totalRecommendations';
    } = {}
  ): Promise<DestinationPerformance[]> {
    const { limit = 20, dateRange, sortBy = 'bookings' } = options;

    const where = dateRange
      ? {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        }
      : {};

    // Get aggregated data by destination
    const destinations = await prisma.recommendation.groupBy({
      by: ['destinationId', 'destinationName'],
      where,
      _count: {
        id: true,
      },
      _avg: {
        score: true,
        userRating: true,
      },
    });

    // Calculate detailed metrics for each destination
    const performance = await Promise.all(
      destinations.map(async dest => {
        const [bookings, views, clicks] = await Promise.all([
          prisma.recommendation.count({
            where: { ...where, destinationId: dest.destinationId, status: 'BOOKED' },
          }),
          prisma.recommendation.count({
            where: {
              ...where,
              destinationId: dest.destinationId,
              viewedAt: { not: null },
            },
          }),
          prisma.recommendation.count({
            where: {
              ...where,
              destinationId: dest.destinationId,
              clickedAt: { not: null },
            },
          }),
        ]);

        return {
          destinationId: dest.destinationId,
          destinationName: dest.destinationName,
          totalRecommendations: dest._count.id,
          bookings,
          views,
          clicks,
          conversionRate: clicks > 0 ? (bookings / clicks) * 100 : 0,
          averageScore: dest._avg.score ?? 0,
          averageRating: dest._avg.userRating,
        };
      })
    );

    // Sort by specified criteria
    const sorted = performance.sort((a, b) => {
      switch (sortBy) {
        case 'bookings':
          return b.bookings - a.bookings;
        case 'conversionRate':
          return b.conversionRate - a.conversionRate;
        case 'totalRecommendations':
          return b.totalRecommendations - a.totalRecommendations;
        default:
          return 0;
      }
    });

    return sorted.slice(0, limit);
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(
    userId?: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<UserEngagement | UserEngagement[]> {
    const where = {
      ...(userId && { userId }),
      ...(dateRange && {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      }),
    };

    if (userId) {
      // Single user
      const [total, viewed, clicked, booked, avgRating] = await Promise.all([
        prisma.recommendation.count({ where }),
        prisma.recommendation.count({ where: { ...where, viewedAt: { not: null } } }),
        prisma.recommendation.count({ where: { ...where, clickedAt: { not: null } } }),
        prisma.recommendation.count({ where: { ...where, status: 'BOOKED' } }),
        prisma.recommendation.aggregate({
          where: { ...where, userRating: { not: null } },
          _avg: { userRating: true },
        }),
      ]);

      return {
        userId,
        totalRecommendationsReceived: total,
        viewedCount: viewed,
        clickedCount: clicked,
        bookedCount: booked,
        engagementRate: total > 0 ? ((viewed + clicked + booked) / total) * 100 : 0,
        averageRating: avgRating._avg.userRating,
      };
    } else {
      // All users
      const users = await prisma.recommendation.groupBy({
        by: ['userId'],
        where,
        _count: { id: true },
        _avg: { userRating: true },
      });

      return await Promise.all(
        users.map(async user => {
          const [viewed, clicked, booked] = await Promise.all([
            prisma.recommendation.count({
              where: { ...where, userId: user.userId, viewedAt: { not: null } },
            }),
            prisma.recommendation.count({
              where: { ...where, userId: user.userId, clickedAt: { not: null } },
            }),
            prisma.recommendation.count({
              where: { ...where, userId: user.userId, status: 'BOOKED' },
            }),
          ]);

          return {
            userId: user.userId,
            totalRecommendationsReceived: user._count.id,
            viewedCount: viewed,
            clickedCount: clicked,
            bookedCount: booked,
            engagementRate:
              user._count.id > 0
                ? ((viewed + clicked + booked) / user._count.id) * 100
                : 0,
            averageRating: user._avg.userRating,
          };
        })
      );
    }
  }

  /**
   * Get time series data for recommendations
   */
  async getTimeSeriesData(
    groupBy: 'day' | 'week' | 'month',
    dateRange: { from: Date; to: Date }
  ): Promise<any[]> {
    // For MVP, group by day (can be enhanced with more complex SQL later)
    const recommendations = await prisma.recommendation.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
    });

    // Group by date
    const grouped = recommendations.reduce((acc, rec) => {
      const date = rec.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          generated: 0,
          viewed: 0,
          clicked: 0,
          booked: 0,
        };
      }

      acc[date].generated++;
      if (rec.status === 'VIEWED') acc[date].viewed++;
      if (rec.status === 'CLICKED') acc[date].clicked++;
      if (rec.status === 'BOOKED') acc[date].booked++;

      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  /**
   * Get reason analysis (which reasons lead to bookings)
   */
  async getReasonAnalysis(dateRange?: { from: Date; to: Date }): Promise<any> {
    const where = dateRange
      ? {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          status: 'BOOKED',
        }
      : { status: 'BOOKED' as RecommendationStatus };

    const booked = await prisma.recommendation.findMany({
      where,
      select: { reasons: true },
    });

    // Count reason frequencies
    const reasonCounts: Record<string, number> = {};

    booked.forEach(rec => {
      const reasons = (rec.reasons as string[]) || [];
      reasons.forEach(reason => {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    });

    // Convert to array and sort
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: (count / booked.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get A/B test results (compare context types)
   */
  async getContextTypeComparison(
    dateRange?: { from: Date; to: Date }
  ): Promise<any[]> {
    const where = dateRange
      ? {
          createdAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        }
      : {};

    const contexts = await prisma.recommendation.groupBy({
      by: ['contextType'],
      where,
      _count: { id: true },
      _avg: {
        score: true,
        confidence: true,
      },
    });

    // Get conversion data for each context
    return await Promise.all(
      contexts.map(async ctx => {
        const booked = await prisma.recommendation.count({
          where: {
            ...where,
            contextType: ctx.contextType,
            status: 'BOOKED',
          },
        });

        return {
          contextType: ctx.contextType,
          totalGenerated: ctx._count.id,
          booked,
          conversionRate: (booked / ctx._count.id) * 100,
          averageScore: ctx._avg.score,
          averageConfidence: ctx._avg.confidence,
        };
      })
    );
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(): Promise<any> {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [overallMetrics, topDestinations, activeUsers] = await Promise.all([
      this.getOverallMetrics({ from: last30Days, to: new Date() }),
      this.getDestinationPerformance({
        limit: 10,
        dateRange: { from: last30Days, to: new Date() },
        sortBy: 'bookings',
      }),
      prisma.recommendation.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: last30Days },
        },
        _count: { id: true },
      }),
    ]);

    return {
      period: 'Last 30 days',
      overallMetrics,
      topDestinations,
      totalActiveUsers: activeUsers.length,
      averageRecommendationsPerUser:
        activeUsers.reduce((sum, u) => sum + u._count.id, 0) / activeUsers.length || 0,
    };
  }
}

export default new AnalyticsService();
