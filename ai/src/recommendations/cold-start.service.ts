/**
 * Cold Start Service
 *
 * Main orchestrator for cold start recommendations.
 * Combines popularity-based recommendations with user segments and preferences
 * to provide personalized suggestions even for new users.
 *
 * Strategies:
 * - POPULARITY_ONLY: Pure popularity (no personalization)
 * - HYBRID_SEGMENT: Popularity + segment profile matching
 * - HYBRID_PREFERENCES: Popularity + user vector similarity
 * - ADAPTIVE: Chooses best strategy based on data availability
 *
 * @module recommendations/cold-start
 */

import { PrismaClient } from '@prisma/client';
import { PopularityService } from './popularity.service';
import { PopularityCacheService } from './popularity-cache.service';
import { SegmentEngineService } from '../segments/segment-engine.service';
import { ScoringService } from '../services/ScoringService';
import {
  ColdStartStrategy,
  ColdStartOptions,
  ColdStartRecommendation,
  ColdStartContext,
  HybridScoringOptions,
  DiversificationOptions,
} from './types/cold-start.types';
import { UserSegment } from '../segments/types/segment.types';
import { FeatureVector } from '../segments/segment-to-vector.service';

const prisma = new PrismaClient();

export class ColdStartService {
  private popularityService: PopularityService;
  private cacheService: PopularityCacheService;
  private segmentEngine: SegmentEngineService;
  private scoringService: ScoringService;

  constructor() {
    this.popularityService = new PopularityService();
    this.cacheService = new PopularityCacheService();
    this.segmentEngine = new SegmentEngineService();
    this.scoringService = new ScoringService();
  }

  /**
   * Get recommendations for a new user (main entry point)
   */
  async getRecommendationsForNewUser(
    userId: string,
    userProfile: any, // AIUserPreferences
    options: ColdStartOptions = {}
  ): Promise<ColdStartRecommendation[]> {
    const {
      strategy = ColdStartStrategy.ADAPTIVE,
      limit = 20,
      diversityFactor = 0.3,
      includeReasons = true,
    } = options;

    // Build context
    const context = await this.buildContext(userId, userProfile);

    // Determine strategy
    const finalStrategy = strategy === ColdStartStrategy.ADAPTIVE
      ? this.chooseStrategy(context)
      : strategy;

    console.log(`[ColdStart] User ${userId}: Strategy=${finalStrategy}, Context completeness=${context.dataCompleteness}`);

    // Execute strategy
    let recommendations: ColdStartRecommendation[];

    switch (finalStrategy) {
      case ColdStartStrategy.POPULARITY_ONLY:
        recommendations = await this.getPopularityOnlyRecommendations(userId, context, options);
        break;

      case ColdStartStrategy.HYBRID_SEGMENT:
        recommendations = await this.getHybridSegmentRecommendations(userId, context, options);
        break;

      case ColdStartStrategy.HYBRID_PREFERENCES:
        recommendations = await this.getHybridPreferencesRecommendations(userId, context, options);
        break;

      default:
        recommendations = await this.getPopularityOnlyRecommendations(userId, context, options);
    }

    // Apply diversification
    if (diversityFactor > 0) {
      recommendations = await this.diversify(recommendations, { factor: diversityFactor, useMMR: true });
    }

    // Limit results
    recommendations = recommendations.slice(0, limit);

    // Assign ranks
    recommendations.forEach((rec, idx) => {
      rec.rank = idx + 1;
    });

    return recommendations;
  }

  /**
   * Get hybrid recommendations (popularity + vector similarity)
   */
  async getHybridRecommendations(
    userId: string,
    userVector: FeatureVector,
    options: HybridScoringOptions & { limit?: number } = {}
  ): Promise<any[]> {
    const {
      popularityWeight = 0.3,
      similarityWeight = 0.7,
      applySegmentBoost = true,
      segmentBoostFactor = 1.2,
      limit = 20,
    } = options;

    // Get user segment
    const userVectorRecord = await prisma.userVector.findUnique({
      where: { userId },
      select: { primarySegment: true },
    });
    const userSegment = userVectorRecord?.primarySegment as UserSegment | null;

    // Fetch candidate items (top 100 popular + segment matches)
    const candidates = await this.fetchCandidates(userSegment, limit * 5);

    // Score each candidate
    const scored = candidates.map((item) => {
      // Popularity score (already normalized [0-1])
      const popularityScore = item.popularityScore || 0;

      // Similarity score (cosine similarity)
      const itemVector = item.vector as FeatureVector;
      const similarityScore = this.scoringService.cosineSimilarity(userVector, itemVector);

      // Segment boost
      let segmentBoost = 1.0;
      if (applySegmentBoost && userSegment) {
        const isSegmentMatch = this.isSegmentMatch(item, userSegment);
        if (isSegmentMatch) {
          segmentBoost = segmentBoostFactor;
        }
      }

      // Hybrid score
      const baseScore = (popularityWeight * popularityScore) + (similarityWeight * similarityScore);
      const finalScore = baseScore * segmentBoost;

      return {
        ...item,
        popularityScore,
        similarityScore,
        segmentBoost,
        finalScore,
      };
    });

    // Sort by final score
    scored.sort((a, b) => b.finalScore - a.finalScore);

    return scored.slice(0, limit);
  }

  /**
   * Strategy: Popularity only (no personalization)
   */
  private async getPopularityOnlyRecommendations(
    userId: string,
    context: ColdStartContext,
    options: ColdStartOptions
  ): Promise<ColdStartRecommendation[]> {
    const { limit = 20 } = options;

    // Try cache first
    let popular = await this.cacheService.getTopDestinations();
    if (!popular) {
      popular = await this.popularityService.getTopDestinations(limit * 2);
    }

    // Apply basic filters
    const filtered = await this.applyFilters(popular, options);

    // Convert to recommendations
    return filtered.slice(0, limit).map((item, idx) => ({
      destinationId: item.destinationId,
      destinationName: item.name,
      destinationType: item.destinationType,
      score: item.popularityScore || 0,
      confidence: 0.6, // Medium confidence (pure popularity)
      reasons: ['Popular destination', 'Trending among travelers'],
      strategy: ColdStartStrategy.POPULARITY_ONLY,
      rank: idx + 1,
    }));
  }

  /**
   * Strategy: Hybrid segment (popularity + segment matching)
   */
  private async getHybridSegmentRecommendations(
    userId: string,
    context: ColdStartContext,
    options: ColdStartOptions
  ): Promise<ColdStartRecommendation[]> {
    const { limit = 20 } = options;

    if (!context.segment) {
      // Fallback to popularity-only
      return this.getPopularityOnlyRecommendations(userId, context, options);
    }

    // Get popular destinations for this segment
    let segmentPopular = await this.cacheService.getTopBySegment(context.segment);
    if (!segmentPopular) {
      segmentPopular = await this.popularityService.getTopBySegment(context.segment, limit * 2);
    }

    // Apply filters
    const filtered = await this.applyFilters(segmentPopular, options);

    // Convert to recommendations
    return filtered.slice(0, limit).map((item, idx) => ({
      destinationId: item.destinationId,
      destinationName: item.name,
      destinationType: item.destinationType,
      score: item.popularityScore || item.segmentMatchScore || 0,
      confidence: 0.75, // Higher confidence (segment match)
      reasons: [
        `Popular among ${context.segment} travelers`,
        'Matches your travel style',
      ],
      strategy: ColdStartStrategy.HYBRID_SEGMENT,
      rank: idx + 1,
    }));
  }

  /**
   * Strategy: Hybrid preferences (popularity + user vector)
   */
  private async getHybridPreferencesRecommendations(
    userId: string,
    context: ColdStartContext,
    options: ColdStartOptions
  ): Promise<ColdStartRecommendation[]> {
    const { limit = 20, popularityWeight = 0.3 } = options;

    if (!context.userVector) {
      // Fallback to segment-based
      return this.getHybridSegmentRecommendations(userId, context, options);
    }

    // Get hybrid recommendations
    const hybrid = await this.getHybridRecommendations(userId, context.userVector, {
      popularityWeight,
      similarityWeight: 1 - popularityWeight,
      limit: limit * 2,
    });

    // Apply filters
    const filtered = await this.applyFilters(hybrid, options);

    // Convert to recommendations
    return filtered.slice(0, limit).map((item, idx) => ({
      destinationId: item.destinationId,
      destinationName: item.name,
      destinationType: item.destinationType,
      score: item.finalScore,
      confidence: 0.85, // High confidence (personalized)
      breakdown: {
        popularityScore: item.popularityScore,
        similarityScore: item.similarityScore,
        segmentScore: item.segmentBoost,
        finalScore: item.finalScore,
      },
      reasons: this.generateReasons(item, context),
      strategy: ColdStartStrategy.HYBRID_PREFERENCES,
      rank: idx + 1,
    }));
  }

  /**
   * Build cold start context from user data
   */
  private async buildContext(userId: string, userProfile: any): Promise<ColdStartContext> {
    // Fetch user vector if exists
    const userVectorRecord = await prisma.userVector.findUnique({
      where: { userId },
      select: {
        vector: true,
        primarySegment: true,
        usageCount: true,
      },
    });

    const dataCompleteness = userProfile?.metadata?.dataQuality?.completeness || 0;
    const isFirstTime = !userVectorRecord || userVectorRecord.usageCount === 0;

    return {
      userId,
      segment: userVectorRecord?.primarySegment as UserSegment | undefined,
      userVector: userVectorRecord?.vector as FeatureVector | undefined,
      dataCompleteness: dataCompleteness / 100,
      isFirstTime,
      previousBookings: 0, // TODO: Fetch from booking history
      onboardingCompleted: userProfile?.isOnboardingCompleted || false,
    };
  }

  /**
   * Choose strategy based on context
   */
  private chooseStrategy(context: ColdStartContext): ColdStartStrategy {
    // High completeness + vector → Hybrid preferences
    if (context.dataCompleteness > 0.7 && context.userVector) {
      return ColdStartStrategy.HYBRID_PREFERENCES;
    }

    // Medium completeness + segment → Hybrid segment
    if (context.dataCompleteness > 0.4 && context.segment) {
      return ColdStartStrategy.HYBRID_SEGMENT;
    }

    // Low completeness → Popularity only
    return ColdStartStrategy.POPULARITY_ONLY;
  }

  /**
   * Fetch candidate items for scoring
   */
  private async fetchCandidates(segment: UserSegment | null, limit: number): Promise<any[]> {
    if (segment) {
      return await this.popularityService.getTopBySegment(segment, limit);
    }
    return await this.popularityService.getTopDestinations(limit);
  }

  /**
   * Apply filters (budget, climate, etc.)
   */
  private async applyFilters(items: any[], options: ColdStartOptions): Promise<any[]> {
    let filtered = [...items];

    // Budget filter
    if (options.budgetRange) {
      // TODO: Filter by budget (requires budget data in ItemVector)
      // filtered = filtered.filter(item => item.budgetRange matches options.budgetRange)
    }

    // Climate filter
    if (options.climatePreferences && options.climatePreferences.length > 0) {
      // TODO: Filter by climate
    }

    return filtered;
  }

  /**
   * Diversify results using Maximum Marginal Relevance (MMR)
   */
  private async diversify(
    recommendations: ColdStartRecommendation[],
    options: DiversificationOptions
  ): Promise<ColdStartRecommendation[]> {
    const { factor, useMMR = true } = options;

    if (!useMMR || recommendations.length <= 1) {
      return recommendations;
    }

    // MMR algorithm
    const selected: ColdStartRecommendation[] = [];
    const remaining = [...recommendations];

    // Select first (highest score)
    selected.push(remaining.shift()!);

    // Iteratively select most diverse
    while (remaining.length > 0 && selected.length < recommendations.length) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];

        // Relevance score
        const relevance = candidate.score;

        // Diversity score (min similarity to selected)
        let minSimilarity = 1.0;
        for (const sel of selected) {
          const sim = await this.calculateItemSimilarity(candidate, sel);
          minSimilarity = Math.min(minSimilarity, sim);
        }
        const diversity = 1 - minSimilarity;

        // MMR score
        const mmrScore = (1 - factor) * relevance + factor * diversity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      selected.push(remaining.splice(bestIdx, 1)[0]);
    }

    return selected;
  }

  /**
   * Calculate similarity between two items
   */
  private async calculateItemSimilarity(item1: any, item2: any): Promise<number> {
    // Simple heuristic: same type = 0.8, same region = 0.6, else 0.2
    if (item1.destinationId === item2.destinationId) return 1.0;
    if (item1.destinationType === item2.destinationType) return 0.8;
    return 0.2;
  }

  /**
   * Check if item matches user segment
   */
  private isSegmentMatch(item: any, segment: UserSegment): boolean {
    // TODO: Implement segment matching logic
    // Check if item characteristics align with segment profile
    return false;
  }

  /**
   * Generate reasons for recommendation
   */
  private generateReasons(item: any, context: ColdStartContext): string[] {
    const reasons: string[] = [];

    if (item.popularityScore > 0.7) {
      reasons.push('Highly popular destination');
    }

    if (item.similarityScore > 0.75) {
      reasons.push('Matches your preferences');
    }

    if (context.segment) {
      reasons.push(`Recommended for ${context.segment} travelers`);
    }

    return reasons.slice(0, 3);
  }
}
