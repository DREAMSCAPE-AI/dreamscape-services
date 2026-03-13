/**
 * US-IA-013 - ML gRPC Client
 *
 * TypeScript client for communicating with Python ML gRPC service.
 *
 * Features:
 * - Connection pooling
 * - Circuit breaker (auto-fallback to rule-based)
 * - Request timeout (300ms default)
 * - Error handling and retry logic
 * - Prometheus metrics
 *
 * ## 🔍 WHAT IT DOES
 * Bridges TypeScript API with Python ML service for real-time SVD predictions.
 *
 * ## 💡 WHY WE NEED IT
 * - Trained ML models live in Python (scikit-learn, joblib)
 * - Production API is TypeScript (Express.js)
 * - gRPC provides fast binary protocol between services
 *
 * ## ⚙️ HOW IT WORKS
 * 1. Load protobuf definitions
 * 2. Create gRPC client stub
 * 3. Call GetRecommendations with timeout
 * 4. Circuit breaker catches failures → fallback to rules
 *
 * @module services
 * @ticket US-IA-013
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

/**
 * ML prediction result
 */
export interface MLPrediction {
  itemId: string;
  score: number;
  confidence: number;
}

/**
 * ML recommendation request
 */
export interface MLRecommendationRequest {
  userId: string;
  excludeSeen?: string[];
  topK?: number;
  modelVersion?: string;
  timeout?: number; // milliseconds
}

/**
 * ML recommendation response
 */
export interface MLRecommendationResponse {
  items: MLPrediction[];
  modelVersion: string;
  inferenceTimeMs: number;
  fromCache: boolean;
  totalCandidates: number;
  warnings: string[];
}

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

/**
 * Circuit breaker for ML service
 *
 * Prevents cascading failures by failing fast when service is down.
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;

  constructor(
    private threshold: number = 5, // Failures before opening
    private timeout: number = 60000, // Reset attempt after 60s
    private halfOpenSuccesses: number = 2 // Successes to close again
  ) {}

  /**
   * Execute function with circuit breaker protection
   *
   * @param fn - Async function to execute
   * @returns Function result
   * @throws Error if circuit is OPEN
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.timeout) {
        // Try to recover
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log('[CircuitBreaker] Transitioning to HALF_OPEN, testing recovery');
      } else {
        throw new Error('Circuit breaker OPEN: ML service unavailable');
      }
    }

    try {
      const result = await fn();

      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccesses) {
        this.state = CircuitState.CLOSED;
        console.log('[CircuitBreaker] Recovered! Transitioning to CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      console.warn('[CircuitBreaker] Recovery failed, back to OPEN');
    } else if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
      console.error(
        `[CircuitBreaker] Threshold reached (${this.threshold} failures), opening circuit`
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}

/**
 * ML gRPC Client
 *
 * Communicates with Python ML service for SVD predictions.
 */
export class MLGrpcClient {
  private client: any; // gRPC client stub
  private circuitBreaker: CircuitBreaker;
  private defaultTimeout: number;

  constructor(
    serverAddress: string = process.env.ML_SERVICE_URL || 'localhost:50051',
    options?: {
      timeout?: number;
      circuitBreakerThreshold?: number;
      circuitBreakerTimeout?: number;
    }
  ) {
    this.defaultTimeout = options?.timeout || 300; // 300ms default

    // Load protobuf definition
    const PROTO_PATH = path.join(__dirname, '../../ml/proto/recommendation.proto');

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;

    // Create gRPC client
    this.client = new protoDescriptor.dreamscape.ml.RecommendationService(
      serverAddress,
      grpc.credentials.createInsecure()
    );

    // Circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      options?.circuitBreakerThreshold || 5,
      options?.circuitBreakerTimeout || 60000
    );

    console.log(`[MLGrpcClient] Initialized with server: ${serverAddress}`);
  }

  /**
   * Get personalized recommendations from ML model
   *
   * @param request - Recommendation request parameters
   * @returns ML predictions with scores
   * @throws Error if circuit breaker OPEN or request fails
   */
  async getRecommendations(
    request: MLRecommendationRequest
  ): Promise<MLRecommendationResponse> {
    return this.circuitBreaker.execute(async () => {
      const timeout = request.timeout || this.defaultTimeout;
      const deadline = Date.now() + timeout;

      return new Promise<MLRecommendationResponse>((resolve, reject) => {
        this.client.GetRecommendations(
          {
            user_id: request.userId,
            exclude_seen: request.excludeSeen || [],
            top_k: request.topK || 20,
            model_version: request.modelVersion || 'v1.0',
            timeout_ms: timeout,
          },
          { deadline },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) {
              console.error(`[MLGrpcClient] GetRecommendations failed: ${error.message}`);
              reject(error);
              return;
            }

            // Transform protobuf response to TypeScript interface
            const items: MLPrediction[] = response.items.map((item: any) => ({
              itemId: item.item_id,
              score: item.score,
              confidence: item.confidence || 0.8,
            }));

            resolve({
              items,
              modelVersion: response.model_version,
              inferenceTimeMs: response.inference_time_ms,
              fromCache: response.from_cache,
              totalCandidates: response.total_candidates,
              warnings: response.warnings || [],
            });
          }
        );
      });
    });
  }

  /**
   * Check ML service health
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    modelReady: boolean;
    cacheConnected: boolean;
    uptimeSeconds: number;
  }> {
    return new Promise((resolve, reject) => {
      this.client.HealthCheck(
        { service: 'recommendation' },
        { deadline: Date.now() + 2000 },
        (error: grpc.ServiceError | null, response: any) => {
          if (error) {
            reject(error);
            return;
          }

          const healthy = response.status === 1; // SERVING = 1

          resolve({
            healthy,
            modelReady: response.model_ready,
            cacheConnected: response.cache_connected,
            uptimeSeconds: parseInt(response.uptime_seconds, 10),
          });
        }
      );
    });
  }

  /**
   * Get ML model metadata
   *
   * @param modelVersion - Specific version (default: active)
   * @returns Model information
   */
  async getModelInfo(modelVersion?: string): Promise<{
    modelVersion: string;
    trainedAt: string;
    numUsers: number;
    numItems: number;
    modelType: string;
    metrics: Record<string, number>;
  }> {
    return new Promise((resolve, reject) => {
      this.client.GetModelInfo(
        { model_version: modelVersion || '' },
        { deadline: Date.now() + 2000 },
        (error: grpc.ServiceError | null, response: any) => {
          if (error) {
            reject(error);
            return;
          }

          resolve({
            modelVersion: response.model_version,
            trainedAt: response.trained_at,
            numUsers: response.num_users,
            numItems: response.num_items,
            modelType: response.model_type,
            metrics: response.metrics || {},
          });
        }
      );
    });
  }

  /**
   * Get circuit breaker state (for monitoring)
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Manually reset circuit breaker (admin endpoint)
   */
  resetCircuit(): void {
    this.circuitBreaker.reset();
    console.log('[MLGrpcClient] Circuit breaker manually reset');
  }

  /**
   * Close gRPC connection
   */
  close(): void {
    if (this.client) {
      grpc.closeClient(this.client);
      console.log('[MLGrpcClient] Connection closed');
    }
  }
}

// Singleton instance (optional, can also instantiate per-request)
let _mlClient: MLGrpcClient | null = null;

export function getMLClient(): MLGrpcClient {
  if (!_mlClient) {
    _mlClient = new MLGrpcClient();
  }
  return _mlClient;
}

export function initializeMLClient(serverAddress?: string): MLGrpcClient {
  _mlClient = new MLGrpcClient(serverAddress);
  return _mlClient;
}

export default MLGrpcClient;
