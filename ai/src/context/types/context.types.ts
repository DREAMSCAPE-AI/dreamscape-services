/**
 * IA-005 - US-IA-005 : Analyse Contextuelle Simple
 * DR-193 : Modèle de données contextuelles
 *
 * Structures de données pour l'analyse contextuelle des recommandations.
 * Le contexte permet d'adapter les recommandations selon les conditions réelles
 * (météo, saison, événements) pour une pertinence accrue.
 */

// ─────────────────────────────────────────────
// Météo
// ─────────────────────────────────────────────

/** Conditions météo principales */
export type WeatherCondition =
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'rainy'
  | 'stormy'
  | 'snowy'
  | 'foggy'
  | 'windy'
  | 'hot'
  | 'cold';

/** Données météo actuelles pour une destination */
export interface WeatherData {
  cityCode: string;
  cityName: string;
  country: string;
  temperature: number;         // °C
  feelsLike: number;           // °C
  humidity: number;            // %
  windSpeed: number;           // km/h
  condition: WeatherCondition;
  conditionDescription: string;
  uvIndex: number;             // 0–11+
  visibility: number;          // km
  isOutdoorFriendly: boolean;  // Conditions propices aux activités outdoor
  fetchedAt: Date;
}

/** Prévision météo pour plusieurs jours */
export interface WeatherForecast {
  cityCode: string;
  days: DailyForecast[];
  fetchedAt: Date;
}

export interface DailyForecast {
  date: string;           // ISO date YYYY-MM-DD
  tempMin: number;        // °C
  tempMax: number;        // °C
  condition: WeatherCondition;
  precipitationProbability: number; // %
  isOutdoorFriendly: boolean;
}

// ─────────────────────────────────────────────
// Saisonnalité
// ─────────────────────────────────────────────

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type TravelSeason =
  | 'high_season'   // Pic touristique
  | 'shoulder'      // Intermédiaire
  | 'low_season';   // Hors saison

/** Contexte saisonnier pour une destination */
export interface SeasonalContext {
  currentSeason: Season;
  travelSeason: TravelSeason;
  hemisphere: 'north' | 'south';
  month: number;          // 1–12
  isSchoolHoliday: boolean;
  isWeekend: boolean;
  peakMonths: number[];   // Mois de haute saison [6, 7, 8]
}

// ─────────────────────────────────────────────
// Contexte agrégé d'une destination
// ─────────────────────────────────────────────

/** Contexte complet d'une destination à un instant T */
export interface DestinationContext {
  destinationId?: string;
  cityCode: string;
  weather: WeatherData | null;
  seasonal: SeasonalContext;
  computedAt: Date;
}

// ─────────────────────────────────────────────
// Pondération contextuelle
// ─────────────────────────────────────────────

/**
 * Poids appliqués par dimension contextuelle.
 * Chaque facteur est un multiplicateur [0.5, 1.5] sur le score vectoriel.
 */
export interface ContextWeights {
  weatherMatch: number;    // Météo aligne avec les préférences user
  seasonalFit: number;     // Saison idéale pour la destination
  travelSeasonPenalty: number; // Pénalité si haute saison (foule, prix)
  outdoorBoost: number;    // Boost si météo outdoor et user aime l'outdoor
}

/** Score d'une recommandation après ajustement contextuel */
export interface ContextualScore {
  originalScore: number;
  contextMultiplier: number; // Produit des poids contextuels
  finalScore: number;
  contextBreakdown: ContextWeights;
  contextSummary: string;    // Explication lisible
}

// ─────────────────────────────────────────────
// Requêtes / Réponses API
// ─────────────────────────────────────────────

export interface ContextualRecommendationRequest {
  userId: string;
  cityCode?: string;
  limit?: number;
  applyWeather?: boolean;
  applySeasonal?: boolean;
}

export interface ContextHealthStatus {
  weatherApi: boolean;
  cache: boolean;
  lastWeatherFetch?: Date;
}
