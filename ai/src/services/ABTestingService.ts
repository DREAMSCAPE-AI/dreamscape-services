/**
 * US-IA-014 - A/B Testing Service
 *
 * Manages feature flags for A/B testing ML vs rule-based recommendations.
 *
 * ## 🔍 WHAT IT DOES
 * - Determines which model to use for each user (ML vs rule-based)
 * - Hash-based traffic splitting (deterministic)
 * - Admin API to adjust split percentage
 *
 * ## 💡 WHY WE NEED IT
 * - Compare ML model performance vs rule-based baseline
 * - Gradual rollout strategy (10% → 25% → 50% → 100%)
 * - Measure impact on CTR, conversion, latency
 *
 * ## ⚙️ HOW IT WORKS
 * 1. Hash user ID to get deterministic bucket (0-99)
 * 2. Compare bucket with split threshold
 * 3. If bucket < threshold → ML model, else → rule-based
 *
 * @module services
 * @ticket US-IA-014
 */

import crypto from 'crypto';

/**
 * A/B Test Configuration
 */
export interface ABTestConfig {
  /**
   * Percentage of users in ML group (0-100)
   * @default 50 (50% ML, 50% rule-based)
   */
  mlSplitPercent: number;

  /**
   * Test name/ID for analytics
   */
  testName: string;

  /**
   * Whether A/B testing is enabled globally
   */
  enabled: boolean;
}

/**
 * Default A/B test configuration
 */
const DEFAULT_AB_CONFIG: ABTestConfig = {
  mlSplitPercent: parseInt(process.env.ML_MODEL_SPLIT || '50', 10),
  testName: 'ml_vs_rulebased_v1',
  enabled: process.env.AB_TESTING_ENABLED !== 'false', // Enabled by default
};

/**
 * A/B Testing Service
 *
 * Manages feature flags for ML model rollout.
 */
export class ABTestingService {
  private config: ABTestConfig;

  constructor(config?: Partial<ABTestConfig>) {
    this.config = {
      ...DEFAULT_AB_CONFIG,
      ...config,
    };

    console.log(
      `[ABTesting] Initialized: ${this.config.mlSplitPercent}% ML, ${100 - this.config.mlSplitPercent}% rule-based`
    );
  }

  /**
   * Determine if user should use ML model
   *
   * Uses deterministic hash-based bucketing:
   * - Same user ID always gets same assignment
   * - Uniform distribution across buckets
   *
   * @param userId - User ID to bucket
   * @returns true if user should use ML model
   */
  shouldUseMLModel(userId: string): boolean {
    if (!this.config.enabled) {
      return false; // A/B testing disabled, use rule-based for all
    }

    // Hash user ID to get bucket (0-99)
    const bucket = this.getUserBucket(userId);

    // Compare with split threshold
    const useML = bucket < this.config.mlSplitPercent;

    console.log(
      `[ABTesting] User ${userId} → bucket ${bucket} → ${useML ? 'ML' : 'rule-based'}`
    );

    return useML;
  }

  /**
   * Get deterministic bucket for user (0-99)
   *
   * Uses SHA-256 hash for uniform distribution.
   *
   * @param userId - User ID
   * @returns Bucket number [0-99]
   */
  private getUserBucket(userId: string): number {
    // Hash user ID
    const hash = crypto.createHash('sha256').update(userId).digest();

    // Convert first 4 bytes to integer
    const hashInt = hash.readUInt32BE(0);

    // Map to 0-99 range
    return hashInt % 100;
  }

  /**
   * Update ML split percentage (admin endpoint)
   *
   * @param newSplitPercent - New split (0-100)
   */
  updateMLSplit(newSplitPercent: number): void {
    if (newSplitPercent < 0 || newSplitPercent > 100) {
      throw new Error('ML split must be between 0 and 100');
    }

    const oldSplit = this.config.mlSplitPercent;
    this.config.mlSplitPercent = newSplitPercent;

    console.log(
      `[ABTesting] Updated ML split: ${oldSplit}% → ${newSplitPercent}%`
    );
  }

  /**
   * Enable/disable A/B testing globally
   *
   * @param enabled - Whether to enable
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`[ABTesting] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Get current configuration
   *
   * @returns Current A/B test config
   */
  getConfig(): ABTestConfig {
    return { ...this.config };
  }

  /**
   * Get analytics summary
   *
   * @returns Summary of A/B test setup
   */
  getSummary(): {
    testName: string;
    enabled: boolean;
    mlSplitPercent: number;
    ruleBasedPercent: number;
  } {
    return {
      testName: this.config.testName,
      enabled: this.config.enabled,
      mlSplitPercent: this.config.mlSplitPercent,
      ruleBasedPercent: 100 - this.config.mlSplitPercent,
    };
  }
}

// Singleton instance
let _abTestingService: ABTestingService | null = null;

export function getABTestingService(): ABTestingService {
  if (!_abTestingService) {
    _abTestingService = new ABTestingService();
  }
  return _abTestingService;
}

export function initializeABTestingService(
  config?: Partial<ABTestConfig>
): ABTestingService {
  _abTestingService = new ABTestingService(config);
  return _abTestingService;
}

export default getABTestingService;
