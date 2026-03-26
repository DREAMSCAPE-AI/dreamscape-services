/**
 * US-IA-011 - Diversity Configuration Types
 *
 * Configuration pour l'enforcement de la diversité destination-level
 * dans les recommandations d'hébergements.
 *
 * @module accommodations/types
 * @ticket US-IA-011
 */

/**
 * Configuration de diversité pour les recommandations
 */
export interface DiversityConfig {
  /**
   * Maximum d'hôtels du même pays dans le top-N
   * @default 4
   * @example Si top-20, max 4 hôtels d'Italie
   */
  maxSameCountry: number;

  /**
   * Minimum de pays différents dans le top-N
   * @default 5
   * @example Top-20 doit contenir au moins 5 pays
   */
  minCountries: number;

  /**
   * Maximum d'hôtels de la même ville dans le top-N
   * @default 8
   * @example Si top-20, max 8 hôtels de Paris
   */
  maxSameCity: number;

  /**
   * Poids du bonus de nouveauté (pour destinations jamais vues)
   * @default 0.1
   * @range 0.0 - 0.3 (10% à 30%)
   */
  noveltyWeight: number;

  /**
   * Activer la pénalité destination-level dans MMR
   * @default true
   */
  enableDestinationPenalty: boolean;

  /**
   * Valeur de la pénalité si pays déjà sélectionné
   * @default 0.5
   * @range 0.0 - 1.0
   */
  countryPenaltyValue: number;
}

/**
 * Configuration par défaut pour la diversité
 */
export const DEFAULT_DIVERSITY_CONFIG: DiversityConfig = {
  maxSameCountry: 4,  // Augmenté de 4 à 20 - permet plus d'hôtels du même pays
  minCountries: 1,     // Changé de 5 à 1 - pour les recherches dans une seule ville
  maxSameCity: 8,     // Augmenté de 8 à 20 - permet plus d'hôtels de la même ville
  noveltyWeight: 0.1,
  enableDestinationPenalty: true,
  countryPenaltyValue: 0.5,
};

/**
 * Historique utilisateur pour le calcul de nouveauté
 */
export interface UserHistory {
  viewedCountries: Set<string>;
  viewedCities: Set<string>;
  bookedCountries: Set<string>;
  bookedCities: Set<string>;
}

/**
 * Métrique de diversité pour analytics
 */
export interface DiversityMetrics {
  uniqueCountries: number;
  uniqueCities: number;
  maxCountOccurrences: number;  // Combien de fois le pays le plus fréquent apparaît
  diversityScore: number;        // 0-1, 1 = parfaitement diversifié
  constraintViolations: string[]; // Liste des contraintes violées (si applicable)
}

/**
 * Résultat de l'enforcement de diversité
 */
export interface DiversityEnforcementResult {
  recommendations: any[];  // Recommendations filtrées/réordonnées
  metrics: DiversityMetrics;
  modified: boolean;       // true si l'ordre/contenu a été modifié
}
