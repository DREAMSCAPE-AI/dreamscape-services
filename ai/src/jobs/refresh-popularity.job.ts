/**
 * Refresh Popularity Job
 *
 * Scheduled job that recalculates popularity scores for all destinations
 * and refreshes the cache. Runs daily at 3:00 AM.
 *
 * Steps:
 * 1. Fetch all destination metrics
 * 2. Calculate new popularity scores
 * 3. Update ItemVector.popularityScore in database
 * 4. Warm up Redis cache
 * 5. Log metrics and publish event
 *
 * @module jobs/refresh-popularity
 */

import cron from 'node-cron';
import { prisma } from '@dreamscape/db';
import { PopularityService } from '../recommendations/popularity.service';
import { PopularityCacheService } from '../recommendations/popularity-cache.service';
import { PopularityRefreshResult } from '../recommendations/types/popularity.types';

export class RefreshPopularityJob {
  private popularityService: PopularityService;
  private cacheService: PopularityCacheService;
  private isRunning: boolean = false;

  constructor() {
    this.popularityService = new PopularityService();
    this.cacheService = new PopularityCacheService();
  }

  /**
   * Execute the popularity refresh job
   */
  async execute(): Promise<PopularityRefreshResult> {
    if (this.isRunning) {
      console.log('[PopularityJob] ⚠️  Already running, skipping...');
      return {
        success: false,
        destinationsUpdated: 0,
        duration: 0,
        averageScore: 0,
        error: 'Job already running',
        completedAt: new Date(),
      };
    }

    this.isRunning = true;
    console.log('='.repeat(80));
    console.log('[PopularityJob] 🔄 Starting popularity refresh...');
    console.log('='.repeat(80));

    const startTime = Date.now();
    let destinationsUpdated = 0;
    let topDestination: any = null;
    let totalScore = 0;

    try {
      // Step 1: Calculate new popularity scores
      console.log('\n[Step 1/4] Calculating popularity scores...');
      const scores = await this.popularityService.calculatePopularityScores();
      console.log(`  ✓ Calculated ${scores.size} destination scores`);

      // Step 2: Update ItemVector in database
      console.log('\n[Step 2/4] Updating database...');
      for (const [destinationId, score] of scores.entries()) {
        await prisma.itemVector.updateMany({
          where: { destinationId },
          data: {
            popularityScore: score,
            updatedAt: new Date(),
          },
        });

        destinationsUpdated++;
        totalScore += score;

        // Track top destination
        if (!topDestination || score > topDestination.score) {
          const item = await prisma.itemVector.findFirst({
            where: { destinationId },
            select: { destinationId: true, name: true },
          });
          if (item) {
            topDestination = { id: destinationId, name: item.name, score };
          }
        }
      }
      console.log(`  ✓ Updated ${destinationsUpdated} destinations`);

      // Step 3: Invalidate old cache
      console.log('\n[Step 3/4] Invalidating old cache...');
      await this.cacheService.invalidateAll();
      console.log('  ✓ Cache invalidated');

      // Step 4: Warm up cache with new data
      console.log('\n[Step 4/4] Warming up cache...');
      await this.cacheService.warmupCache(this.popularityService);
      console.log('  ✓ Cache warmed up');

      // Calculate metrics
      const duration = Date.now() - startTime;
      const averageScore = destinationsUpdated > 0 ? totalScore / destinationsUpdated : 0;

      // Log summary
      console.log('\n' + '='.repeat(80));
      console.log('[PopularityJob] ✅ SUCCESS');
      console.log('='.repeat(80));
      console.log(`Destinations updated: ${destinationsUpdated}`);
      console.log(`Average score:        ${averageScore.toFixed(4)}`);
      console.log(`Top destination:      ${topDestination?.name} (${topDestination?.id}) - ${topDestination?.score.toFixed(4)}`);
      console.log(`Duration:             ${(duration / 1000).toFixed(2)}s`);
      console.log('='.repeat(80));

      // Publish success event (optional Kafka)
      await this.publishEvent({
        success: true,
        destinationsUpdated,
        duration,
        averageScore,
        topDestination,
      });

      const result: PopularityRefreshResult = {
        success: true,
        destinationsUpdated,
        duration,
        averageScore,
        topDestination,
        completedAt: new Date(),
      };

      this.isRunning = false;
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('\n' + '='.repeat(80));
      console.error('[PopularityJob] ❌ FAILED');
      console.error('='.repeat(80));
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      console.error('='.repeat(80));

      // Publish error event
      await this.publishEvent({
        success: false,
        error: error.message,
      });

      const result: PopularityRefreshResult = {
        success: false,
        destinationsUpdated,
        duration,
        averageScore: 0,
        error: error.message,
        completedAt: new Date(),
      };

      this.isRunning = false;
      return result;
    }
  }

  /**
   * Schedule the job to run daily at 3:00 AM
   */
  schedule(): void {
    // Cron expression: "minute hour day month weekday"
    // "0 3 * * *" = Every day at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
      console.log('\n[PopularityJob] 🕒 Scheduled execution triggered (3:00 AM)');
      await this.execute();
    });

    console.log('[PopularityJob] ⏰ Scheduled: Daily at 3:00 AM');
  }

  /**
   * Run job immediately (for testing or manual trigger)
   */
  async runNow(): Promise<PopularityRefreshResult> {
    console.log('[PopularityJob] 🚀 Manual execution triggered');
    return await this.execute();
  }

  /**
   * Publish job result event (Kafka or logging)
   */
  private async publishEvent(event: Partial<PopularityRefreshResult>): Promise<void> {
    // TODO: Integrate with Kafka service
    // await kafkaService.publish('ai.popularity.refreshed', event);

    // For now, just log
    console.log(`[PopularityJob] Event: ${JSON.stringify(event, null, 2)}`);
  }

  /**
   * Check if job is currently running
   */
  isJobRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get last execution result (stored in Redis or DB)
   */
  async getLastExecutionResult(): Promise<PopularityRefreshResult | null> {
    // TODO: Fetch from Redis or database
    // For now, return null
    return null;
  }
}

/**
 * Export singleton instance
 */
export const refreshPopularityJob = new RefreshPopularityJob();

/**
 * Start the scheduler (call this in main app initialization)
 */
export function startPopularityJobScheduler(): void {
  refreshPopularityJob.schedule();
  console.log('✓ Popularity job scheduler started');
}

/**
 * CLI command to run job manually
 *
 * Usage: node -e "require('./jobs/refresh-popularity.job').runManually()"
 */
export async function runManually(): Promise<void> {
  const result = await refreshPopularityJob.runNow();
  console.log('\nFinal result:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}
