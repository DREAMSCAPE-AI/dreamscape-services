/**
 * IA-001.3: Scoring Engine Service
 * Calculates similarity scores between user vectors and item vectors
 * Generates personalized recommendations based on ML scoring
 */

import { PrismaClient, ItemVector } from '@dreamscape/db';
import VectorizationService from './VectorizationService';

const prisma = new PrismaClient();

interface ScoredItem {
  item: ItemVector;
  score: number;
  confidence: number;
  reasons: string[];
}

export class ScoringService {
  /**
   * Calculate cosine similarity between two vectors
   * Returns value between 0 (completely different) and 1 (identical)
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimensions');
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Calculate Euclidean distance and convert to similarity score
   * Returns value between 0 (very different) and 1 (very similar)
   */
  euclideanSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimensions');
    }

    const distance = Math.sqrt(
      vecA.reduce((sum, a, i) => sum + Math.pow(a - vecB[i], 2), 0)
    );

    // Convert distance to similarity (closer = higher score)
    // Max distance in [0,1] space is sqrt(dimensions)
    const maxDistance = Math.sqrt(vecA.length);
    return 1 - Math.min(distance / maxDistance, 1);
  }

  /**
   * Hybrid similarity score combining cosine and euclidean
   * Weights: 70% cosine, 30% euclidean
   */
  hybridSimilarity(vecA: number[], vecB: number[]): number {
    const cosine = this.cosineSimilarity(vecA, vecB);
    const euclidean = this.euclideanSimilarity(vecA, vecB);

    return 0.7 * cosine + 0.3 * euclidean;
  }

  /**
   * Generate explainability reasons based on vector dimension matching
   */
  generateReasons(userVec: number[], itemVec: number[]): string[] {
    const reasons: string[] = [];
    const dimensions = [
      { key: 'matches_climate_preference', threshold: 0.25 },
      { key: 'cultural_activities_aligned', threshold: 0.25 },
      { key: 'budget_aligned', threshold: 0.20 },
      { key: 'activity_level_match', threshold: 0.25 },
      { key: 'group_size_compatible', threshold: 0.30 },
      { key: 'urban_preference_match', threshold: 0.25 },
      { key: 'gastronomy_aligned', threshold: 0.30 },
      { key: 'popularity_aligned', threshold: 0.25 },
    ];

    userVec.forEach((userVal, idx) => {
      const itemVal = itemVec[idx];
      const diff = Math.abs(userVal - itemVal);

      if (diff < dimensions[idx].threshold) {
        reasons.push(dimensions[idx].key);
      }
    });

    return reasons;
  }

  /**
   * Calculate confidence score based on score and item popularity
   * Higher confidence for popular destinations with high scores
   */
  calculateConfidence(score: number, popularity: number): number {
    return Math.min(1.0, score * 0.7 + popularity * 0.3);
  }

  /**
   * Score a single item against user vector
   */
  async scoreItem(userId: string, item: ItemVector): Promise<ScoredItem> {
    const userVec = await VectorizationService.getUserVector(userId);
    const itemVec = item.vector as number[];

    const score = this.hybridSimilarity(userVec, itemVec);
    const confidence = this.calculateConfidence(score, item.popularityScore);
    const reasons = this.generateReasons(userVec, itemVec);

    return {
      item,
      score,
      confidence,
      reasons,
    };
  }

  /**
   * Score all items and return top N recommendations
   */
  async generateRecommendations(
    userId: string,
    options: {
      limit?: number;
      minScore?: number;
      destinationType?: string;
      excludeIds?: string[];
    } = {}
  ): Promise<ScoredItem[]> {
    const {
      limit = 20,
      minScore = 0.3,
      destinationType,
      excludeIds = [],
    } = options;

    // Fetch user vector
    const userVec = await VectorizationService.getUserVector(userId);

    // Fetch all item vectors (with optional filtering)
    const items = await prisma.itemVector.findMany({
      where: {
        ...(destinationType && { destinationType }),
        ...(excludeIds.length > 0 && {
          destinationId: { notIn: excludeIds },
        }),
      },
      orderBy: {
        popularityScore: 'desc', // Pre-filter by popularity for better results
      },
      take: limit * 3, // Get more items to filter by score
    });

    // Score all items
    const scoredItems: ScoredItem[] = items.map(item => {
      const itemVec = item.vector as number[];
      const score = this.hybridSimilarity(userVec, itemVec);
      const confidence = this.calculateConfidence(score, item.popularityScore);
      const reasons = this.generateReasons(userVec, itemVec);

      return {
        item,
        score,
        confidence,
        reasons,
      };
    });

    // Filter by minimum score and sort
    return scoredItems
      .filter(scored => scored.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Boost score based on seasonality
   */
  boostBySeasonality(score: number, item: ItemVector, currentSeason: string): number {
    if (!item.seasonalityData) return score;

    const seasonData = item.seasonalityData as Record<string, number>;
    const seasonBoost = seasonData[currentSeason.toLowerCase()] ?? 1.0;

    // Apply seasonal boost (max 20% increase)
    return Math.min(1.0, score * (1 + (seasonBoost - 1) * 0.2));
  }

  /**
   * Get current season based on month
   */
  getCurrentSeason(): string {
    const month = new Date().getMonth();

    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  /**
   * Generate seasonal recommendations
   */
  async generateSeasonalRecommendations(
    userId: string,
    options: { limit?: number } = {}
  ): Promise<ScoredItem[]> {
    const recommendations = await this.generateRecommendations(userId, options);
    const currentSeason = this.getCurrentSeason();

    // Apply seasonal boost and re-sort
    const boosted = recommendations.map(rec => ({
      ...rec,
      score: this.boostBySeasonality(rec.score, rec.item, currentSeason),
    }));

    return boosted.sort((a, b) => b.score - a.score);
  }

  /**
   * Diversify recommendations to avoid similar destinations
   * Uses clustering to ensure variety
   */
  diversifyRecommendations(scored: ScoredItem[], targetCount: number = 10): ScoredItem[] {
    if (scored.length <= targetCount) return scored;

    const diverse: ScoredItem[] = [scored[0]]; // Start with top recommendation

    for (let i = 1; i < scored.length && diverse.length < targetCount; i++) {
      const candidate = scored[i];
      const candidateVec = candidate.item.vector as number[];

      // Check if candidate is different enough from already selected
      const isSufficientlyDifferent = diverse.every(selected => {
        const selectedVec = selected.item.vector as number[];
        const similarity = this.cosineSimilarity(candidateVec, selectedVec);
        return similarity < 0.85; // Allow if < 85% similar to existing
      });

      if (isSufficientlyDifferent) {
        diverse.push(candidate);
      }
    }

    return diverse;
  }

  /**
   * Get trending destinations (high popularity + recent bookings)
   */
  async getTrendingDestinations(limit: number = 10): Promise<ItemVector[]> {
    return await prisma.itemVector.findMany({
      where: {
        popularityScore: { gte: 0.7 },
      },
      orderBy: [
        { bookingCount: 'desc' },
        { popularityScore: 'desc' },
      ],
      take: limit,
    });
  }

  /**
   * Get destinations by specific criteria
   */
  async getDestinationsByCriteria(criteria: {
    minBudget?: number;
    maxBudget?: number;
    climate?: 'hot' | 'cold' | 'temperate';
    type?: string;
    limit?: number;
  }): Promise<ItemVector[]> {
    const { type, limit = 20 } = criteria;

    // For MVP, filter by type and popularity
    // TODO: Add budget/climate filters using vector dimensions
    return await prisma.itemVector.findMany({
      where: {
        ...(type && { destinationType: type }),
      },
      orderBy: {
        popularityScore: 'desc',
      },
      take: limit,
    });
  }
}

export default new ScoringService();
