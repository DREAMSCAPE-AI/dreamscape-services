/**
 * Segments Module
 *
 * Exports all segment-related services, types, and utilities
 */

// Services
export { SegmentEngineService } from './segment-engine.service';
export { SegmentToVectorService } from './segment-to-vector.service';
export type { FeatureVector, EnrichedUserVector } from './segment-to-vector.service';

// Types
export * from './types';
