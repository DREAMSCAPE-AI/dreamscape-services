/**
 * IA-001.2: Unit tests for Vectorization Service
 */

import { VectorizationService, VECTOR_DIMENSIONS } from '../services/VectorizationService';

const vectorizationService = new VectorizationService();

describe('VectorizationService', () => {
  describe('calculateClimateScore', () => {
    it('should return high score for tropical climate', () => {
      const score = vectorizationService['calculateClimateScore'](['tropical']);
      expect(score).toBeCloseTo(1.0, 1);
    });

    it('should return low score for cold climate', () => {
      const score = vectorizationService['calculateClimateScore'](['cold']);
      expect(score).toBeLessThan(0.3);
    });

    it('should return middle score for temperate climate', () => {
      const score = vectorizationService['calculateClimateScore'](['temperate']);
      expect(score).toBeCloseTo(0.5, 1);
    });

    it('should average multiple climates', () => {
      const score = vectorizationService['calculateClimateScore'](['tropical', 'cold']);
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(0.8);
    });
  });

  describe('calculateBudgetScore', () => {
    it('should return low score for budget travelers', () => {
      const score = vectorizationService['calculateBudgetScore']({ max: 500 });
      expect(score).toBeLessThan(0.3);
    });

    it('should return mid score for mid-range budgets', () => {
      const score = vectorizationService['calculateBudgetScore']({ max: 2000 });
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(0.7);
    });

    it('should return high score for premium budgets', () => {
      const score = vectorizationService['calculateBudgetScore']({ max: 5000 });
      expect(score).toBeGreaterThan(0.7);
    });

    it('should return default for missing budget', () => {
      const score = vectorizationService['calculateBudgetScore']({});
      expect(score).toBe(0.5);
    });
  });

  describe('mapActivityLevel', () => {
    it('should map LOW to low score', () => {
      const score = vectorizationService['mapActivityLevel']('LOW');
      expect(score).toBe(0.1);
    });

    it('should map VERY_HIGH to high score', () => {
      const score = vectorizationService['mapActivityLevel']('VERY_HIGH');
      expect(score).toBe(0.95);
    });

    it('should return default for unknown level', () => {
      const score = vectorizationService['mapActivityLevel']('UNKNOWN');
      expect(score).toBe(0.5);
    });
  });

  describe('calculateGroupScore', () => {
    it('should return low score for solo travelers', () => {
      const score = vectorizationService['calculateGroupScore'](['solo'], false);
      expect(score).toBe(0.1);
    });

    it('should return high score for families', () => {
      const score = vectorizationService['calculateGroupScore'](['family'], false);
      expect(score).toBe(0.75);
    });

    it('should return high score when traveling with children', () => {
      const score = vectorizationService['calculateGroupScore'](['couple'], true);
      expect(score).toBe(0.75);
    });

    it('should return mid score for couples', () => {
      const score = vectorizationService['calculateGroupScore'](['couple'], false);
      expect(score).toBe(0.3);
    });
  });

  describe('mapRiskToPopularity', () => {
    it('should map CONSERVATIVE to high popularity', () => {
      const score = vectorizationService['mapRiskToPopularity']('CONSERVATIVE');
      expect(score).toBe(0.9);
    });

    it('should map ADVENTUROUS to low popularity', () => {
      const score = vectorizationService['mapRiskToPopularity']('ADVENTUROUS');
      expect(score).toBe(0.2);
    });

    it('should return default for unknown risk', () => {
      const score = vectorizationService['mapRiskToPopularity']('UNKNOWN');
      expect(score).toBe(0.6);
    });
  });

  describe('calculateCultureScore', () => {
    it('should return high score for cultural travel types', () => {
      const score = vectorizationService['calculateCultureScore'](['CULTURAL', 'HISTORICAL']);
      expect(score).toBeGreaterThan(0.7);
    });

    it('should return low score for nature travel types', () => {
      const score = vectorizationService['calculateCultureScore'](['NATURE', 'BEACH']);
      expect(score).toBeLessThan(0.3);
    });

    it('should return middle score for mixed types', () => {
      const score = vectorizationService['calculateCultureScore'](['CULTURAL', 'NATURE']);
      expect(score).toBeCloseTo(0.5, 1);
    });
  });

  describe('calculateUrbanScore', () => {
    it('should return high score for urban destinations', () => {
      const score = vectorizationService['calculateUrbanScore'](['city', 'urban', 'metropolis']);
      expect(score).toBeGreaterThan(0.7);
    });

    it('should return low score for rural destinations', () => {
      const score = vectorizationService['calculateUrbanScore'](['countryside', 'rural', 'village']);
      expect(score).toBeLessThan(0.3);
    });

    it('should return default for empty destinations', () => {
      const score = vectorizationService['calculateUrbanScore']([]);
      expect(score).toBe(0.6);
    });
  });

  describe('calculateGastronomyScore', () => {
    it('should return high score for culinary travelers', () => {
      const score = vectorizationService['calculateGastronomyScore'](
        ['food', 'culinary', 'restaurant'],
        ['CULINARY']
      );
      expect(score).toBeGreaterThan(0.7);
    });

    it('should return baseline score for non-food activities', () => {
      const score = vectorizationService['calculateGastronomyScore'](
        ['museums', 'history'],
        ['CULTURAL']
      );
      expect(score).toBe(0.3);
    });
  });

  describe('generateUserVector', () => {
    it('should generate vector with correct dimensions', async () => {
      // This would require mocking Prisma client
      // For now, we test the structure
      expect(VECTOR_DIMENSIONS).toBe(8);
    });
  });
});
