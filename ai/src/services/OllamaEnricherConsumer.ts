/**
 * US-IA-010 - Ollama Enrichment Consumer
 *
 * Kafka consumer qui écoute les événements de recommandations générées
 * et les enrichit de manière asynchrone via Ollama (Qwen2.5:7b).
 *
 * Architecture Pattern : 100% Async (hors critical path)
 * - User request → API génère reco (< 500ms) → Response ✅
 * - En parallèle : Kafka event → Ollama enrichment → Cache Redis
 * - Next request → Cache enrichi → Response instantanée
 *
 * @module services/OllamaEnricherConsumer
 * @ticket US-IA-010
 */

import axios, { AxiosError } from 'axios';
import CacheService from './CacheService';

// Configuration
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const ENRICHMENT_TTL = parseInt(process.env.ENRICHMENT_TTL || '86400'); // 24h default

/**
 * Interface pour les événements de recommandations générées
 */
interface RecommendationGeneratedEvent {
  userId: string;
  requestId: string;
  recommendations: Array<{
    id?: string;
    hotelId?: string;
    name: string;
    location: {
      city: string;
      country: string;
    };
    score: number;
    reasons: string[];
  }>;
  timestamp: Date;
}

/**
 * Interface pour l'enrichissement Ollama
 */
interface EnrichedRecommendation {
  id: string;
  enriched_reasons: string[];
  alternatives: string[];
  semantic_tags: string[];
  local_insights: string;
}

interface OllamaEnrichmentResponse {
  destinations: EnrichedRecommendation[];
  global_insights: string;
}

/**
 * Ollama Enrichment Consumer
 *
 * Consomme les événements Kafka et enrichit les recommandations
 * de manière asynchrone (sans impacter le SLA <500ms).
 */
export class OllamaEnricherConsumer {
  private isRunning = false;
  private enrichmentCount = 0;
  private errorCount = 0;

  /**
   * Start the Ollama enrichment consumer
   *
   * Note: Cette méthode doit être appelée au démarrage du serveur
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[OllamaConsumer] Already running');
      return;
    }

    console.log('[OllamaConsumer] Starting Ollama enrichment consumer...');
    console.log(`[OllamaConsumer] Ollama URL: ${OLLAMA_URL}`);
    console.log(`[OllamaConsumer] Model: ${OLLAMA_MODEL}`);

    // Health check
    const health = await this.healthCheck();
    if (!health.healthy) {
      console.warn('[OllamaConsumer] Ollama service not healthy:', health.error);
      console.warn('[OllamaConsumer] Enrichment will be skipped until service is available');
      // Continue anyway (non-critical service)
    } else {
      console.log('[OllamaConsumer] Ollama service healthy ✅');
      if (!health.model_loaded) {
        console.warn(`[OllamaConsumer] Model ${OLLAMA_MODEL} not loaded - pull it first`);
      }
    }

    this.isRunning = true;

    // TODO: Subscribe to Kafka topic 'ai.recommendation.generated'
    // For now, we'll simulate with a placeholder
    // Actual Kafka integration will be done via KafkaService

    console.log('[OllamaConsumer] Consumer started successfully');
  }

  /**
   * Stop the consumer
   */
  async stop(): Promise<void> {
    console.log('[OllamaConsumer] Stopping...');
    this.isRunning = false;
  }

  /**
   * Process recommendation generated event
   *
   * Cette méthode sera appelée par KafkaService pour chaque événement.
   *
   * @param event - Recommendation generated event
   */
  async processRecommendationEvent(event: RecommendationGeneratedEvent): Promise<void> {
    const startTime = Date.now();

    try {
      const { userId, recommendations } = event;

      console.log(`[OllamaConsumer] Processing enrichment for user ${userId} (${recommendations.length} items)`);

      // Check if already enriched (avoid duplicate work)
      const cacheKey = `enriched:${userId}`;
      const existing = await CacheService.get(cacheKey);
      if (existing) {
        console.log(`[OllamaConsumer] Already enriched for user ${userId}, skipping`);
        return;
      }

      // Call Ollama for enrichment (async, non-blocking)
      const enriched = await this.enrichWithOllama({
        userId,
        recommendations: recommendations.slice(0, 10), // Max 10 pour éviter timeout
      });

      // Cache enriched results (24h TTL)
      await CacheService.setex(cacheKey, ENRICHMENT_TTL, JSON.stringify(enriched));

      const duration = Date.now() - startTime;
      this.enrichmentCount++;

      console.log(
        `[OllamaConsumer] ✅ Enriched ${enriched.destinations.length} destinations ` +
        `for user ${userId} in ${duration}ms (total: ${this.enrichmentCount})`
      );

    } catch (error) {
      this.errorCount++;
      const duration = Date.now() - startTime;

      console.error(
        `[OllamaConsumer] ❌ Enrichment failed after ${duration}ms ` +
        `(errors: ${this.errorCount}/${this.enrichmentCount + this.errorCount}):`,
        error instanceof Error ? error.message : error
      );

      // Pas d'impact sur l'user (déjà reçu sa réponse initiale)
      // On log juste l'erreur pour monitoring
    }
  }

  /**
   * Enrich recommendations via Ollama
   *
   * @param data - Recommendation data
   * @returns Enriched recommendations
   */
  private async enrichWithOllama(data: {
    userId: string;
    recommendations: any[];
  }): Promise<OllamaEnrichmentResponse> {
    try {
      const response = await axios.post(
        `${OLLAMA_URL}/api/generate`,
        {
          model: OLLAMA_MODEL,
          prompt: this.buildPrompt(data.recommendations),
          stream: false,
          format: 'json',
          options: {
            temperature: 0.3,
            top_p: 0.9,
            num_predict: 2000,
          }
        },
        {
          timeout: 30000, // 30s timeout (acceptable car async)
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      const rawResponse = response.data.response;

      // Parse JSON
      let enriched: OllamaEnrichmentResponse;
      try {
        enriched = JSON.parse(rawResponse);
      } catch (parseError) {
        // Try to extract JSON from text (Ollama sometimes adds preamble)
        const jsonStart = rawResponse.indexOf('{');
        const jsonEnd = rawResponse.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          enriched = JSON.parse(rawResponse.substring(jsonStart, jsonEnd));
        } else {
          throw new Error('Invalid JSON response from Ollama');
        }
      }

      // Validate schema
      this.validateEnrichment(enriched);

      return enriched;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.code === 'ECONNREFUSED') {
          throw new Error(`Ollama service unavailable at ${OLLAMA_URL}`);
        }
        if (axiosError.response?.status === 404) {
          throw new Error(`Model ${OLLAMA_MODEL} not found - pull it first with: ollama pull ${OLLAMA_MODEL}`);
        }
      }
      throw error;
    }
  }

  /**
   * Build enrichment prompt
   *
   * @param recommendations - Recommendations to enrich
   * @returns Formatted prompt
   */
  private buildPrompt(recommendations: any[]): string {
    const simplified = recommendations.map(r => ({
      id: r.id || r.hotelId || 'unknown',
      name: r.name || '',
      location: r.location || {},
      score: r.score || 0,
      reasons: r.reasons || [],
    }));

    const recoJson = JSON.stringify(simplified, null, 2);

    return `Tu es un expert en voyages. Enrichis ces recommandations avec du contexte sémantique.

Input:
${recoJson}

Output attendu (JSON strict):
{
  "destinations": [
    {
      "id": "hotel-123",
      "enriched_reasons": ["Raison 1", "Raison 2", "Raison 3"],
      "alternatives": ["id-456", "id-789"],
      "semantic_tags": ["romantic", "beach", "luxury"],
      "local_insights": "Info locale utile"
    }
  ],
  "global_insights": "Analyse globale des préférences"
}

Règles:
- Output JSON uniquement (pas de texte avant/après)
- Max 3 enriched_reasons par destination (spécifiques, pas génériques)
- Max 2 alternatives (IDs existants uniquement)
- Tags depuis: romantic, family-friendly, adventure, relaxation, luxury, budget, cultural, nature, beach, mountains, city-break, etc.
- Local insights: 1 phrase max (info pratique)`;
  }

  /**
   * Validate enrichment schema
   *
   * @param enriched - Enrichment response
   * @throws Error if invalid
   */
  private validateEnrichment(enriched: any): void {
    if (!enriched.destinations || !Array.isArray(enriched.destinations)) {
      throw new Error('Invalid enrichment: missing destinations array');
    }

    if (typeof enriched.global_insights !== 'string') {
      throw new Error('Invalid enrichment: missing global_insights');
    }

    // Validate each destination
    for (const dest of enriched.destinations) {
      if (!dest.id) {
        throw new Error('Invalid enrichment: destination missing id');
      }

      // Truncate if too many
      if (dest.enriched_reasons && dest.enriched_reasons.length > 3) {
        dest.enriched_reasons = dest.enriched_reasons.slice(0, 3);
      }

      if (dest.alternatives && dest.alternatives.length > 2) {
        dest.alternatives = dest.alternatives.slice(0, 2);
      }

      if (dest.semantic_tags && dest.semantic_tags.length > 5) {
        dest.semantic_tags = dest.semantic_tags.slice(0, 5);
      }
    }
  }

  /**
   * Health check for Ollama service
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    model_loaded?: boolean;
    error?: string;
  }> {
    try {
      const response = await axios.get(`${OLLAMA_URL}/api/tags`, {
        timeout: 2000,
      });

      const models = response.data.models || [];
      const modelLoaded = models.some((m: any) =>
        m.name && m.name.startsWith(OLLAMA_MODEL.split(':')[0])
      );

      return {
        healthy: true,
        model_loaded: modelLoaded,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get consumer stats
   *
   * @returns Stats object
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      enrichmentCount: this.enrichmentCount,
      errorCount: this.errorCount,
      successRate: this.enrichmentCount + this.errorCount > 0
        ? (this.enrichmentCount / (this.enrichmentCount + this.errorCount) * 100).toFixed(1) + '%'
        : 'N/A',
    };
  }
}

// Export singleton instance
export default new OllamaEnricherConsumer();
