/**
 * Data Migration Script: Add Segments to Existing UserVectors
 *
 * This script migrates existing UserVector records to include segment assignments.
 * It fetches user onboarding profiles, calculates segments, and updates UserVector records.
 *
 * Usage:
 *   npm run migrate:segments
 *   OR
 *   ts-node scripts/migrate-existing-vectors.ts
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { SegmentEngineService } from '../src/segments/segment-engine.service';

const prisma = new PrismaClient();
const segmentEngine = new SegmentEngineService();

// Configuration
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const BATCH_SIZE = 50;
const DRY_RUN = process.env.DRY_RUN === 'true';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}

/**
 * Fetch AI preferences for a user from User Service
 */
async function fetchUserPreferences(userId: string): Promise<any> {
  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}/api/v1/users/${userId}/ai-preferences`,
      {
        headers: {
          'X-Internal-Service': 'ai-service',
        },
        timeout: 5000,
      }
    );

    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // User has no onboarding profile
    }
    throw error;
  }
}

/**
 * Migrate a single user vector
 */
async function migrateUserVector(userVectorId: string, userId: string): Promise<boolean> {
  try {
    // Fetch user preferences
    const preferences = await fetchUserPreferences(userId);

    if (!preferences || !preferences.isOnboardingCompleted) {
      console.log(`  ⊘ User ${userId}: No completed onboarding profile, skipping`);
      return false;
    }

    // Calculate segments
    const segments = await segmentEngine.assignSegment(preferences);

    if (segments.length === 0) {
      console.log(`  ⊘ User ${userId}: No segments assigned, skipping`);
      return false;
    }

    const primarySegment = segments[0].segment;
    const segmentConfidence = segments[0].score;

    // Prepare segment data for storage
    const segmentData = segments.map((s) => ({
      segment: s.segment,
      score: s.score,
      reasons: s.reasons,
      assignedAt: s.assignedAt.toISOString(),
    }));

    if (DRY_RUN) {
      console.log(`  ✓ [DRY RUN] User ${userId}:`);
      console.log(`    Primary: ${primarySegment} (confidence: ${segmentConfidence.toFixed(2)})`);
      console.log(`    All segments: ${segments.map((s) => s.segment).join(', ')}`);
      return true;
    }

    // Update UserVector
    await prisma.userVector.update({
      where: { id: userVectorId },
      data: {
        segments: segmentData,
        primarySegment,
        segmentConfidence,
        lastSegmentUpdate: new Date(),
      },
    });

    console.log(`  ✓ User ${userId}: Assigned ${primarySegment} (confidence: ${segmentConfidence.toFixed(2)})`);
    return true;
  } catch (error: any) {
    console.error(`  ✗ User ${userId}: Error - ${error.message}`);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('='.repeat(80));
  console.log('User Segmentation Data Migration (IA-002.1)');
  console.log('='.repeat(80));
  console.log();

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No database changes will be made');
    console.log();
  }

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch all UserVectors without segments
    console.log('📊 Fetching UserVectors to migrate...');
    const userVectors = await prisma.userVector.findMany({
      where: {
        OR: [{ segments: null }, { primarySegment: null }],
      },
      select: {
        id: true,
        userId: true,
      },
    });

    stats.total = userVectors.length;
    console.log(`   Found ${stats.total} UserVectors to migrate\n`);

    if (stats.total === 0) {
      console.log('✓ No UserVectors need migration. All done!');
      return;
    }

    // Process in batches
    console.log('🔄 Starting migration...\n');
    for (let i = 0; i < userVectors.length; i += BATCH_SIZE) {
      const batch = userVectors.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(userVectors.length / BATCH_SIZE);

      console.log(`Batch ${batchNumber}/${totalBatches} (${batch.length} records):`);

      for (const uv of batch) {
        try {
          const migrated = await migrateUserVector(uv.id, uv.userId);
          if (migrated) {
            stats.migrated++;
          } else {
            stats.skipped++;
          }
        } catch (error: any) {
          stats.failed++;
          stats.errors.push({
            userId: uv.userId,
            error: error.message,
          });
        }
      }

      console.log(); // Empty line between batches

      // Small delay between batches to avoid overwhelming services
      if (i + BATCH_SIZE < userVectors.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Print summary
    console.log('='.repeat(80));
    console.log('Migration Complete!');
    console.log('='.repeat(80));
    console.log();
    console.log(`Total UserVectors:       ${stats.total}`);
    console.log(`✓ Migrated successfully: ${stats.migrated}`);
    console.log(`⊘ Skipped (no profile):  ${stats.skipped}`);
    console.log(`✗ Failed:                ${stats.failed}`);
    console.log();

    if (stats.failed > 0) {
      console.log('Errors:');
      stats.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. User ${err.userId}: ${err.error}`);
      });
      console.log();
    }

    // Calculate segment distribution
    if (!DRY_RUN && stats.migrated > 0) {
      console.log('📊 Segment Distribution:');
      const distribution = await prisma.userVector.groupBy({
        by: ['primarySegment'],
        _count: true,
        where: {
          primarySegment: { not: null },
        },
      });

      distribution
        .sort((a, b) => b._count - a._count)
        .forEach((item) => {
          const percentage = ((item._count / stats.migrated) * 100).toFixed(1);
          console.log(`   ${item.primarySegment}: ${item._count} (${percentage}%)`);
        });
      console.log();
    }

    // Success rate
    const successRate = stats.total > 0 ? ((stats.migrated / stats.total) * 100).toFixed(1) : 0;
    console.log(`Success Rate: ${successRate}%`);
    console.log();

    if (DRY_RUN) {
      console.log('ℹ️  This was a DRY RUN. To apply changes, run without DRY_RUN=true');
    }
  } catch (error: any) {
    console.error('❌ Migration failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { migrate };
