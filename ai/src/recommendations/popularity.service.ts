/**
 * Popularity Service
 *
 * Calculates popularity scores for destinations based on multiple metrics:
 * - Booking count (40%)
 * - Search count (15%)
 * - View count (10%)
 * - Quality score (20%)
 * - Trend factor (10%)
 * - Seasonality (5%)
 *
 * @module recommendations/popularity
 */

import { PrismaClient } from '@prisma/client';
import {
  PopularityWeights,
  DEFAULT_POPULARITY_WEIGHTS,
  PopularityScore,
  PopularityMetrics,
  PopularDestinationsOptions,
  TrendAnalysis,
  QualityScore,
  PopularityStats,
  Season,
} from './types/popularity.types';
import { UserSegment } from '../segments/types/segment.types';

const prisma = new PrismaClient();

export class PopularityService {
  private weights: PopularityWeights;

  constructor(weights: Partial<PopularityWeights> = {}) {
    this.weights = { ...DEFAULT_POPULARITY_WEIGHTS, ...weights };
  }

  /**
   * Calculate popularity scores for all destinations
   */
  async calculatePopularityScores(): Promise<Map<string, number>> {
    const metrics = await this.fetchAllMetrics();
    const stats = await this.calculateStats(metrics);
    const scores = new Map<string, number>();

    for (const metric of metrics) {
      const score = this.calculateScore(metric, stats);
      scores.set(metric.destinationId, score.score);
    }

    return scores;
  }

  /**
   * Get top N popular destinations globally
   */
  async getTopDestinations(limit: number = 20): Promise<any[]> {
    const items = await prisma.itemVector.findMany({
      orderBy: { popularityScore: 'desc' },
      take: limit,
      where: {
        popularityScore: { gt: 0 },
      },
    });

    return items;
  }

  /**
   * Get top destinations filtered by segment
   */
  async getTopBySegment(segment: UserSegment, limit: number = 20): Promise<any[]> {
    // Get segment profile to understand preferences
    const segmentProfile = this.getSegmentPreferences(segment);

    // Fetch destinations matching segment characteristics
    const items = await prisma.itemVector.findMany({
      orderBy: { popularityScore: 'desc' },
      take: limit * 2, // Fetch more for filtering
      where: {
        popularityScore: { gt: 0 },
      },
    });

    // Filter and score by segment match
    const segmentScored = items.map((item) => ({
      ...item,
      segmentMatchScore: this.calculateSegmentMatch(item, segmentProfile),
    }));

    // Sort by combined score and return top N
    return segmentScored
      .sort((a, b) => b.segmentMatchScore - a.segmentMatchScore)
      .slice(0, limit);
  }

  /**
   * Get top destinations by category
   */
  async getTopByCategory(category: string, limit: number = 20): Promise<any[]> {
    const items = await prisma.itemVector.findMany({
      where: {
        destinationType: category,
        popularityScore: { gt: 0 },
      },
      orderBy: { popularityScore: 'desc' },
      take: limit,
    });

    return items;
  }

  /**
   * Calculate popularity score for a single destination
   */
  private calculateScore(metric: PopularityMetrics, stats: PopularityStats): PopularityScore {
    // Normalize all metrics [0-1]
    const normBookings = this.normalize(metric.bookingCount, stats.bookings.min, stats.bookings.max);
    const normSearches = this.normalize(metric.searchCount, stats.searches.min, stats.searches.max);
    const normViews = this.normalize(metric.viewCount, stats.views.min, stats.views.max);

    // Quality score (Wilson score for ratings)
    const quality = this.calculateQualityScore(metric.averageRating, metric.reviewCount);

    // Trend factor (normalized growth rate)
    const trend = this.normalizeTrend(metric.trendFactor);

    // Seasonality boost
    const seasonality = metric.seasonalityBoost;

    // Weighted sum
    const baseScore =
      this.weights.bookings * normBookings +
      this.weights.searches * normSearches +
      this.weights.views * normViews +
      this.weights.quality * quality.normalizedScore +
      this.weights.trend * trend +
      this.weights.seasonality * seasonality;

    // Apply recency decay
    const recencyFactor = this.calculateRecencyDecay(metric.lastBookedAt);
    const finalScore = baseScore * recencyFactor;

    return {
      destinationId: metric.destinationId,
      score: Math.min(1.0, Math.max(0, finalScore)),
      components: {
        bookings: normBookings,
        searches: normSearches,
        views: normViews,
        quality: quality.normalizedScore,
        trend,
        seasonality,
      },
      recencyFactor,
      calculatedAt: new Date(),
    };
  }

  /**
   * Fetch metrics for all destinations
   */
  private async fetchAllMetrics(): Promise<PopularityMetrics[]> {
    const items = await prisma.itemVector.findMany({
      select: {
        destinationId: true,
        bookingCount: true,
        searchCount: true,
        popularityScore: true,
        updatedAt: true,
        lastSyncedAt: true,
      },
    });

    return items.map((item) => ({
      destinationId: item.destinationId,
      bookingCount: item.bookingCount || 0,
      searchCount: item.searchCount || 0,
      viewCount: 0, // TODO: Track views
      averageRating: 4.0, // TODO: Fetch from reviews
      reviewCount: Math.floor(item.bookingCount * 0.3), // Estimate
      trendFactor: 0, // TODO: Calculate from time-series data
      seasonalityBoost: this.getSeasonalityBoost(item.destinationId, Season.SUMMER),
      lastBookedAt: item.lastSyncedAt,
      updatedAt: item.updatedAt,
    }));
  }

  /**
   * Calculate normalization stats
   */
  private async calculateStats(metrics: PopularityMetrics[]): Promise<PopularityStats> {
    const bookings = metrics.map((m) => m.bookingCount);
    const searches = metrics.map((m) => m.searchCount);
    const views = metrics.map((m) => m.viewCount);
    const ratings = metrics.map((m) => m.averageRating);

    return {
      bookings: {
        min: Math.min(...bookings),
        max: Math.max(...bookings),
      },
      searches: {
        min: Math.min(...searches),
        max: Math.max(...searches),
      },
      views: {
        min: Math.min(...views),
        max: Math.max(...views),
      },
      ratings: {
        min: Math.min(...ratings),
        max: Math.max(...ratings),
      },
      totalDestinations: metrics.length,
      calculatedAt: new Date(),
    };
  }

  /**
   * Min-max normalization
   */
  private normalize(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Calculate quality score using Wilson score interval
   */
  private calculateQualityScore(avgRating: number, reviewCount: number): QualityScore {
    // Wilson score lower bound (confidence interval for rating)
    const z = 1.96; // 95% confidence
    const phat = avgRating / 5.0; // Convert to [0-1]
    const n = reviewCount;

    let wilsonScore = 0;
    if (n > 0) {
      const denominator = 1 + (z * z) / n;
      const numerator = phat + (z * z) / (2 * n) - z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
      wilsonScore = numerator / denominator;
    }

    return {
      averageRating: avgRating,
      reviewCount,
      wilsonScore,
      normalizedScore: wilsonScore,
    };
  }

  /**
   * Normalize trend factor
   */
  private normalizeTrend(trendFactor: number): number {
    // Trend factor is growth rate: -1 to +infinity
    // Normalize to [0-1]: negative = 0, 0% = 0.5, 100% = 0.75, 300%+ = 1
    if (trendFactor < 0) return Math.max(0, 0.5 + trendFactor / 2);
    if (trendFactor < 1) return 0.5 + trendFactor * 0.25;
    return Math.min(1, 0.75 + (trendFactor - 1) * 0.25);
  }

  /**
   * Calculate recency decay factor
   */
  private calculateRecencyDecay(lastBookedAt?: Date): number {
    if (!lastBookedAt) return 0.5;

    const daysSince = (Date.now() - lastBookedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay: 1.0 at day 0, 0.95 at 30 days, 0.8 at 90 days, 0.5 at 180 days
    const halfLife = 120; // days
    return Math.max(0.3, Math.exp((-daysSince * Math.log(2)) / halfLife));
  }

  /**
   * Get seasonality boost for destination
   */
  private getSeasonalityBoost(destinationId: string, currentSeason: Season): number {
    // TODO: Fetch from ItemVector.seasonalityData
    // For now, return default boost
    return 0.5;
  }

  /**
   * Get segment preferences for filtering
   */
  private getSegmentPreferences(segment: UserSegment): any {
    // Return preferences that match segment characteristics
    // TODO: Use SEGMENT_PROFILES
    return {
      budgetRange: { min: 0, max: 1000 },
      preferredTypes: [],
    };
  }

  /**
   * Calculate how well destination matches segment
   */
  private calculateSegmentMatch(item: any, segmentPreferences: any): number {
    // Combine popularity with segment match
    const popularityScore = item.popularityScore || 0;
    const segmentMatchScore = 0.7; // TODO: Calculate from item.vector vs segment vector

    return 0.6 * popularityScore + 0.4 * segmentMatchScore;
  }

  /**
   * Calculate trend analysis for destination
   */
  async calculateTrendAnalysis(destinationId: string): Promise<TrendAnalysis> {
    // TODO: Fetch booking data from last 60 days
    const recentBookings = 10; // Last 30 days
    const previousBookings = 8; // Previous 30 days

    const growthRate = previousBookings > 0 ? ((recentBookings - previousBookings) / previousBookings) * 100 : 0;

    let direction: 'rising' | 'stable' | 'declining' = 'stable';
    if (growthRate > 10) direction = 'rising';
    if (growthRate < -10) direction = 'declining';

    return {
      destinationId,
      growthRate,
      direction,
      recentBookings,
      previousBookings,
      analyzedAt: new Date(),
    };
  }
}
