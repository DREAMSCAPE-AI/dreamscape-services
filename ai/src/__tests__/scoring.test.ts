/**
 * IA-001.3: Unit tests for Scoring Service
 */

import { ScoringService } from '../services/ScoringService';

const scoringService = new ScoringService();

describe('ScoringService', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vecA = [0.5, 0.8, 0.3];
      const vecB = [0.5, 0.8, 0.3];

      const result = scoringService.cosineSimilarity(vecA, vecB);
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];

      const result = scoringService.cosineSimilarity(vecA, vecB);
      expect(result).toBeCloseTo(0, 5);
    });

    it('should return value between 0 and 1 for similar vectors', () => {
      const vecA = [0.8, 0.3, 0.9];
      const vecB = [0.7, 0.4, 0.85];

      const result = scoringService.cosineSimilarity(vecA, vecB);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should throw error for vectors of different dimensions', () => {
      const vecA = [0.5, 0.8];
      const vecB = [0.5, 0.8, 0.3];

      expect(() => {
        scoringService.cosineSimilarity(vecA, vecB);
      }).toThrow('Vectors must have same dimensions');
    });
  });

  describe('euclideanSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vecA = [0.5, 0.8, 0.3];
      const vecB = [0.5, 0.8, 0.3];

      const result = scoringService.euclideanSimilarity(vecA, vecB);
      expect(result).toBe(1.0);
    });

    it('should return value between 0 and 1 for different vectors', () => {
      const vecA = [0.8, 0.3, 0.9];
      const vecB = [0.2, 0.7, 0.1];

      const result = scoringService.euclideanSimilarity(vecA, vecB);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should throw error for vectors of different dimensions', () => {
      const vecA = [0.5, 0.8];
      const vecB = [0.5, 0.8, 0.3];

      expect(() => {
        scoringService.euclideanSimilarity(vecA, vecB);
      }).toThrow('Vectors must have same dimensions');
    });
  });

  describe('hybridSimilarity', () => {
    it('should combine cosine and euclidean scores', () => {
      const vecA = [0.5, 0.8, 0.3];
      const vecB = [0.6, 0.7, 0.4];

      const cosine = scoringService.cosineSimilarity(vecA, vecB);
      const euclidean = scoringService.euclideanSimilarity(vecA, vecB);
      const expected = 0.7 * cosine + 0.3 * euclidean;

      const result = scoringService.hybridSimilarity(vecA, vecB);
      expect(result).toBeCloseTo(expected, 5);
    });
  });

  describe('generateReasons', () => {
    it('should generate reasons for closely matching dimensions', () => {
      const userVec = [0.8, 0.5, 0.7, 0.6, 0.4, 0.9, 0.3, 0.8];
      const itemVec = [0.85, 0.55, 0.75, 0.65, 0.45, 0.88, 0.35, 0.82];

      const reasons = scoringService.generateReasons(userVec, itemVec);

      expect(Array.isArray(reasons)).toBe(true);
      expect(reasons.length).toBeGreaterThan(0);
    });

    it('should return empty array for very different vectors', () => {
      const userVec = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
      const itemVec = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];

      const reasons = scoringService.generateReasons(userVec, itemVec);

      expect(reasons.length).toBe(0);
    });
  });

  describe('calculateConfidence', () => {
    it('should return higher confidence for high score and high popularity', () => {
      const result = scoringService.calculateConfidence(0.9, 0.9);
      expect(result).toBeGreaterThan(0.8);
      expect(result).toBeLessThanOrEqual(1.0);
    });

    it('should return lower confidence for low score', () => {
      const result = scoringService.calculateConfidence(0.3, 0.9);
      expect(result).toBeLessThan(0.5);
    });

    it('should cap confidence at 1.0', () => {
      const result = scoringService.calculateConfidence(1.0, 1.0);
      expect(result).toBeLessThanOrEqual(1.0);
    });
  });

  describe('getCurrentSeason', () => {
    it('should return a valid season', () => {
      const season = scoringService.getCurrentSeason();
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(season);
    });
  });

  describe('boostBySeasonality', () => {
    it('should boost score for high seasonality', () => {
      const item = {
        id: 'test',
        destinationId: 'PAR',
        destinationType: 'city',
        name: 'Paris',
        vector: [0.5, 0.8, 0.7],
        version: 1,
        popularityScore: 0.9,
        bookingCount: 100,
        searchCount: 500,
        seasonalityData: {
          summer: 0.95,
          spring: 0.8,
          autumn: 0.7,
          winter: 0.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
        country: 'France',
        coordinates: null,
        recommendations: [],
      } as any;

      const boosted = scoringService.boostBySeasonality(0.7, item, 'summer');
      expect(boosted).toBeGreaterThanOrEqual(0.7);
      expect(boosted).toBeLessThanOrEqual(1.0);
    });

    it('should not boost score if no seasonality data', () => {
      const item = {
        id: 'test',
        destinationId: 'PAR',
        destinationType: 'city',
        name: 'Paris',
        vector: [0.5, 0.8, 0.7],
        version: 1,
        popularityScore: 0.9,
        bookingCount: 100,
        searchCount: 500,
        seasonalityData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
        country: 'France',
        coordinates: null,
        recommendations: [],
      } as any;

      const result = scoringService.boostBySeasonality(0.7, item, 'summer');
      expect(result).toBe(0.7);
    });
  });
});
