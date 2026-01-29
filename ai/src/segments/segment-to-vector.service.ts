/**
 * Segment to Vector Service
 *
 * Converts user segments to 8D feature vectors.
 * Provides blending functionality for segment-based and preference-based vectors.
 *
 * @module segments/segment-to-vector
 */

import { UserSegment } from './types/segment.types';
import { SEGMENT_PROFILES } from './types/segment-profile.types';

/**
 * Type for 8D feature vector
 * Dimensions:
 * [0] Climate (0=cold, 1=tropical)
 * [1] Culture vs Nature (0=nature, 1=culture)
 * [2] Budget (0=economy, 1=luxury)
 * [3] Activity Level (0=relaxed, 1=adventure)
 * [4] Travel Group (0=solo, 1=family)
 * [5] Urban vs Rural (0=countryside, 1=city)
 * [6] Gastronomy (0=basic, 1=gourmet)
 * [7] Popularity (0=off-beaten, 1=mainstream)
 */
export type FeatureVector = [number, number, number, number, number, number, number, number];

/**
 * Enriched user vector with metadata
 */
export interface EnrichedUserVector {
  /**
   * Final blended 8D vector
   */
  vector: FeatureVector;

  /**
   * Base vector from user preferences
   */
  baseVector?: FeatureVector;

  /**
   * Segment-derived vector
   */
  segmentVector?: FeatureVector;

  /**
   * Blending weight applied [0-1]
   * Higher = more preference-based, Lower = more segment-based
   */
  blendingWeight: number;

  /**
   * Confidence score [0-1]
   */
  confidence: number;

  /**
   * Primary segment used
   */
  primarySegment: UserSegment;

  /**
   * Data source
   */
  source: 'segment_only' | 'preference_only' | 'blended';
}

/**
 * Segment To Vector Service
 */
export class SegmentToVectorService {
  /**
   * Generate a feature vector from a user segment
   *
   * Returns the typical 8D vector for users in this segment.
   *
   * @param segment - User segment
   * @returns 8D feature vector
   */
  generateVectorFromSegment(segment: UserSegment): FeatureVector {
    const profile = SEGMENT_PROFILES[segment];

    if (!profile) {
      throw new Error(`Unknown segment: ${segment}`);
    }

    return profile.typicalVector;
  }

  /**
   * Blend segment vector with preference-based vector
   *
   * Uses confidence score to determine blending ratio:
   * - High confidence (>0.7): Favor preferences (80% pref, 20% segment)
   * - Medium confidence (0.4-0.7): Balanced (60% pref, 40% segment)
   * - Low confidence (<0.4): Favor segment (30% pref, 70% segment)
   *
   * @param segmentVector - Vector derived from user segment
   * @param preferenceVector - Vector derived from onboarding preferences
   * @param confidence - Confidence score [0-1]
   * @returns Blended feature vector
   */
  blendVectors(
    segmentVector: FeatureVector,
    preferenceVector: FeatureVector,
    confidence: number
  ): FeatureVector {
    // Calculate preference weight based on confidence
    const preferenceWeight = this.calculatePreferenceWeight(confidence);
    const segmentWeight = 1 - preferenceWeight;

    // Blend each dimension
    const blendedVector = segmentVector.map((segVal, idx) => {
      const prefVal = preferenceVector[idx];
      return preferenceWeight * prefVal + segmentWeight * segVal;
    }) as FeatureVector;

    return blendedVector;
  }

  /**
   * Create an enriched user vector with full metadata
   *
   * @param segment - Primary user segment
   * @param preferenceVector - Vector from preferences (optional)
   * @param confidence - Confidence score
   * @returns Enriched user vector
   */
  createEnrichedVector(
    segment: UserSegment,
    preferenceVector?: FeatureVector,
    confidence: number = 0.5
  ): EnrichedUserVector {
    const segmentVector = this.generateVectorFromSegment(segment);

    if (!preferenceVector) {
      // Segment-only vector
      return {
        vector: segmentVector,
        segmentVector,
        blendingWeight: 0,
        confidence,
        primarySegment: segment,
        source: 'segment_only',
      };
    }

    // Blended vector
    const blendedVector = this.blendVectors(segmentVector, preferenceVector, confidence);
    const preferenceWeight = this.calculatePreferenceWeight(confidence);

    return {
      vector: blendedVector,
      baseVector: preferenceVector,
      segmentVector,
      blendingWeight: preferenceWeight,
      confidence,
      primarySegment: segment,
      source: 'blended',
    };
  }

  /**
   * Calculate preference weight based on confidence score
   *
   * Confidence mapping:
   * - 0.9-1.0 -> 0.9 (90% preference)
   * - 0.7-0.9 -> 0.8 (80% preference)
   * - 0.5-0.7 -> 0.6 (60% preference)
   * - 0.3-0.5 -> 0.4 (40% preference)
   * - 0.0-0.3 -> 0.2 (20% preference)
   *
   * @param confidence - Confidence score [0-1]
   * @returns Preference weight [0-1]
   */
  private calculatePreferenceWeight(confidence: number): number {
    if (confidence >= 0.9) return 0.9;
    if (confidence >= 0.7) return 0.8;
    if (confidence >= 0.5) return 0.6;
    if (confidence >= 0.3) return 0.4;
    return 0.2;
  }

  /**
   * Adjust vector based on segment characteristics
   *
   * Applies segment-specific adjustments to a vector to ensure
   * it aligns with segment expectations.
   *
   * @param vector - Input vector
   * @param segment - Target segment
   * @param strength - Adjustment strength [0-1]
   * @returns Adjusted vector
   */
  adjustVectorForSegment(
    vector: FeatureVector,
    segment: UserSegment,
    strength: number = 0.3
  ): FeatureVector {
    const segmentVector = this.generateVectorFromSegment(segment);

    // Pull vector towards segment characteristics
    return vector.map((val, idx) => {
      const segVal = segmentVector[idx];
      return val * (1 - strength) + segVal * strength;
    }) as FeatureVector;
  }

  /**
   * Calculate vector similarity (cosine similarity)
   *
   * Useful for validating if a blended vector is still representative
   * of the original segment.
   *
   * @param vectorA - First vector
   * @param vectorB - Second vector
   * @returns Similarity score [0-1]
   */
  calculateSimilarity(vectorA: FeatureVector, vectorB: FeatureVector): number {
    // Dot product
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    // Cosine similarity, normalized to [0-1]
    const cosineSim = dotProduct / (magnitudeA * magnitudeB);
    return (cosineSim + 1) / 2; // Convert from [-1,1] to [0,1]
  }

  /**
   * Validate vector values are within valid range
   *
   * @param vector - Vector to validate
   * @returns true if valid, false otherwise
   */
  validateVector(vector: FeatureVector): boolean {
    return vector.every((val) => val >= 0 && val <= 1 && !isNaN(val));
  }

  /**
   * Normalize vector to ensure all values are in [0-1] range
   *
   * @param vector - Vector to normalize
   * @returns Normalized vector
   */
  normalizeVector(vector: FeatureVector): FeatureVector {
    return vector.map((val) => Math.max(0, Math.min(1, val))) as FeatureVector;
  }

  /**
   * Get all segment vectors for comparison or analysis
   *
   * @returns Map of segment to typical vector
   */
  getAllSegmentVectors(): Map<UserSegment, FeatureVector> {
    const vectors = new Map<UserSegment, FeatureVector>();

    for (const segment of Object.values(UserSegment)) {
      vectors.set(segment, this.generateVectorFromSegment(segment));
    }

    return vectors;
  }

  /**
   * Find most similar segment for a given vector
   *
   * Useful for re-classification or segment drift detection.
   *
   * @param vector - Feature vector
   * @returns Most similar segment and similarity score
   */
  findMostSimilarSegment(vector: FeatureVector): {
    segment: UserSegment;
    similarity: number;
  } {
    const segmentVectors = this.getAllSegmentVectors();
    let maxSimilarity = -1;
    let bestSegment: UserSegment = UserSegment.BUDGET_BACKPACKER;

    for (const [segment, segmentVector] of segmentVectors.entries()) {
      const similarity = this.calculateSimilarity(vector, segmentVector);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestSegment = segment;
      }
    }

    return {
      segment: bestSegment,
      similarity: maxSimilarity,
    };
  }

  /**
   * Calculate confidence score based on data completeness
   *
   * Helper method to determine confidence for blending.
   *
   * @param completeness - Data completeness percentage [0-100]
   * @param criticalFieldsPresent - Whether critical fields are present
   * @returns Confidence score [0-1]
   */
  calculateConfidence(completeness: number, criticalFieldsPresent: boolean): number {
    if (!criticalFieldsPresent) {
      return Math.min(0.4, completeness / 100); // Max 0.4 without critical fields
    }

    // Scale completeness to confidence
    // 100% completeness -> 0.95 confidence
    // 80% completeness -> 0.75 confidence
    // 50% completeness -> 0.50 confidence
    const baseConfidence = (completeness / 100) * 0.95;

    return Math.max(0.2, Math.min(0.95, baseConfidence));
  }
}
