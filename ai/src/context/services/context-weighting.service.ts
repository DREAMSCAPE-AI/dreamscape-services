/**
 * IA-005 - US-IA-005 : Analyse Contextuelle Simple
 * DR-194 : Algorithme de pondération contextuelle
 *
 * Calcule des multiplicateurs contextuels (météo, saisonnalité) qui ajustent
 * les scores vectoriels existants. Approche non-destructive : le score ML
 * de base est multiplié, jamais remplacé.
 *
 * Dimensions vectorielles utilisées :
 *   [0] Préférence climatique  (0 = froid, 1 = tropical)
 *   [2] Budget                 (0 = économique, 1 = luxe)
 *   [3] Niveau d'activité      (0 = repos, 1 = aventure)
 *   [5] Urbain vs Rural        (0 = campagne, 1 = ville)
 */

import type {
  WeatherData,
  SeasonalContext,
  DestinationContext,
  ContextWeights,
  ContextualScore,
  Season,
  TravelSeason,
} from '../types/context.types';

// ─────────────────────────────────────────────
// Constantes de pondération
// ─────────────────────────────────────────────

/** Limites des multiplicateurs pour éviter des distorsions extrêmes */
const MIN_MULTIPLIER = 0.7;
const MAX_MULTIPLIER = 1.3;

/** Score seuil en dessous duquel on ne boost plus (évite de remonter du bruit) */
const MIN_SCORE_FOR_BOOST = 0.2;

// ─────────────────────────────────────────────
// Helpers saisonniers
// ─────────────────────────────────────────────

function getCurrentSeason(month: number, hemisphere: 'north' | 'south'): Season {
  const northSeasons: Season[] = [
    'winter', 'winter',           // Jan, Fév
    'spring', 'spring', 'spring', // Mar, Avr, Mai
    'summer', 'summer', 'summer', // Jun, Jul, Aoû
    'autumn', 'autumn', 'autumn', // Sep, Oct, Nov
    'winter',                     // Déc
  ];
  const season = northSeasons[month - 1];
  if (hemisphere === 'south') {
    const flip: Record<Season, Season> = {
      winter: 'summer', summer: 'winter',
      spring: 'autumn', autumn: 'spring',
    };
    return flip[season];
  }
  return season;
}

function getTravelSeason(month: number, peakMonths: number[]): TravelSeason {
  if (peakMonths.includes(month)) return 'high_season';
  const shoulderMonths = peakMonths.flatMap(m => [
    ((m - 2 + 12) % 12) + 1,
    (m % 12) + 1,
  ]);
  if (shoulderMonths.includes(month)) return 'shoulder';
  return 'low_season';
}

export function buildSeasonalContext(
  peakMonths: number[] = [6, 7, 8], // Par défaut été boréal
  hemisphere: 'north' | 'south' = 'north'
): SeasonalContext {
  const now = new Date();
  const month = now.getMonth() + 1;
  const dayOfWeek = now.getDay();

  return {
    currentSeason:  getCurrentSeason(month, hemisphere),
    travelSeason:   getTravelSeason(month, peakMonths),
    hemisphere,
    month,
    isSchoolHoliday: [7, 8].includes(month) || [12, 1].includes(month),
    isWeekend:       dayOfWeek === 0 || dayOfWeek === 6,
    peakMonths,
  };
}

// ─────────────────────────────────────────────
// Calcul des poids contextuels
// ─────────────────────────────────────────────

class ContextWeightingService {

  /**
   * Calcule les poids contextuels à partir des données de la destination
   * et du vecteur de préférences utilisateur.
   *
   * @param context  Contexte agrégé de la destination
   * @param userVector  Vecteur 8D de l'utilisateur
   */
  computeWeights(context: DestinationContext, userVector: number[]): ContextWeights {
    const weatherMatch      = this.computeWeatherMatch(context.weather, userVector);
    const seasonalFit       = this.computeSeasonalFit(context.seasonal, userVector);
    const travelSeasonPenalty = this.computeSeasonPenalty(context.seasonal, userVector);
    const outdoorBoost      = this.computeOutdoorBoost(context.weather, userVector);

    return { weatherMatch, seasonalFit, travelSeasonPenalty, outdoorBoost };
  }

  /**
   * Applique les poids contextuels à un score vectoriel de base.
   * Le multiplicateur final est le produit de tous les poids, clampé dans [MIN, MAX].
   */
  applyContextualScore(
    baseScore: number,
    weights: ContextWeights,
    contextSummary?: string,
  ): ContextualScore {
    if (baseScore < MIN_SCORE_FOR_BOOST) {
      return {
        originalScore:     baseScore,
        contextMultiplier: 1.0,
        finalScore:        baseScore,
        contextBreakdown:  weights,
        contextSummary:    'Score trop bas pour ajustement contextuel',
      };
    }

    const rawMultiplier =
      weights.weatherMatch *
      weights.seasonalFit *
      weights.travelSeasonPenalty *
      weights.outdoorBoost;

    const contextMultiplier = Math.max(
      MIN_MULTIPLIER,
      Math.min(MAX_MULTIPLIER, rawMultiplier)
    );

    return {
      originalScore:    baseScore,
      contextMultiplier,
      finalScore:       Math.min(1.0, baseScore * contextMultiplier),
      contextBreakdown: weights,
      contextSummary:   contextSummary ?? this.buildSummary(weights, contextMultiplier),
    };
  }

  /**
   * Applique le contexte sur une liste de recommandations déjà scorées.
   * Retourne les recommandations ré-ordonnées avec leur score contextuel.
   */
  applyContextToRecommendations<T extends { score: number; itemVector?: number[] }>(
    recommendations: T[],
    context: DestinationContext,
    userVector: number[],
  ): (T & { contextualScore: ContextualScore })[] {
    return recommendations
      .map(rec => {
        const weights = this.computeWeights(context, userVector);
        const contextualScore = this.applyContextualScore(rec.score, weights);
        return { ...rec, contextualScore };
      })
      .sort((a, b) => b.contextualScore.finalScore - a.contextualScore.finalScore);
  }

  // ─────────────────────────────────────────────
  // Facteurs individuels
  // ─────────────────────────────────────────────

  /**
   * Alignement météo ↔ préférences climatiques de l'utilisateur.
   * Vec[0] = préférence climatique (0 = froid, 1 = tropical)
   * Vec[3] = niveau d'activité     (0 = repos, 1 = aventure)
   */
  private computeWeatherMatch(
    weather: WeatherData | null,
    userVector: number[]
  ): number {
    if (!weather) return 1.0; // Neutre si pas de données

    const climatePreference = userVector[0] ?? 0.5; // 0=froid, 1=chaud
    const temp = weather.temperature;

    // Score de correspondance température/préférence [0, 1]
    let tempMatch: number;
    if (climatePreference > 0.6) {
      // User préfère chaud : boosté si temp ≥ 20°C
      tempMatch = temp >= 20 ? 1.0 : Math.max(0, temp / 20);
    } else if (climatePreference < 0.4) {
      // User préfère froid : boosté si temp ≤ 15°C
      tempMatch = temp <= 15 ? 1.0 : Math.max(0, 1 - (temp - 15) / 25);
    } else {
      // User neutre : optimal entre 15°C et 25°C
      const deviation = Math.max(0, Math.abs(temp - 20) - 5);
      tempMatch = Math.max(0, 1 - deviation / 20);
    }

    // Pénalité météo mauvaise (stormy, rainy, snowy)
    const badWeather = ['stormy', 'rainy', 'snowy'].includes(weather.condition);
    const weatherPenalty = badWeather ? 0.85 : 1.0;

    // Multiplicateur final [0.8, 1.2]
    return 0.8 + tempMatch * 0.4 * weatherPenalty;
  }

  /**
   * Adéquation saisonnière de la destination.
   * Les destinations beach sont meilleures en été, ski en hiver, etc.
   */
  private computeSeasonalFit(
    seasonal: SeasonalContext,
    userVector: number[]
  ): number {
    const activityLevel = userVector[3] ?? 0.5; // 0=repos, 1=aventure
    const { currentSeason, isSchoolHoliday } = seasonal;

    // User aventure → bonus été/printemps (activités outdoor)
    let fit = 1.0;
    if (activityLevel > 0.6) {
      if (currentSeason === 'summer' || currentSeason === 'spring') fit = 1.1;
      else if (currentSeason === 'winter') fit = 0.9;
    }

    // User repos → neutre toute saison (wellness/spa partout)
    // Légère préférence automne/printemps (moins de foule)
    if (activityLevel < 0.4) {
      if (currentSeason === 'autumn' || currentSeason === 'spring') fit = 1.05;
    }

    // Bonus famille en vacances scolaires
    if (isSchoolHoliday) fit *= 1.05;

    return fit;
  }

  /**
   * Pénalité haute saison.
   * User budget (vec[2] < 0.4) pénalisé en haute saison (prix élevés).
   */
  private computeSeasonPenalty(
    seasonal: SeasonalContext,
    userVector: number[]
  ): number {
    const budget = userVector[2] ?? 0.5; // 0=économique, 1=luxe
    const { travelSeason } = seasonal;

    if (travelSeason === 'high_season') {
      // User budget : pénalisé par les prix de haute saison
      if (budget < 0.4) return 0.85;
      // User luxe : indifférent ou légèrement pénalisé (foule)
      if (budget > 0.7) return 0.95;
      return 0.9;
    }

    if (travelSeason === 'low_season') {
      // User budget : bonus hors saison (prix bas)
      if (budget < 0.4) return 1.1;
      // User luxe : pénalisé (certains services fermés)
      if (budget > 0.7) return 0.95;
      return 1.0;
    }

    return 1.0; // Shoulder saison — neutre
  }

  /**
   * Boost outdoor : si météo propice ET user aime l'activité outdoor.
   * Vec[3] = niveau d'activité
   */
  private computeOutdoorBoost(
    weather: WeatherData | null,
    userVector: number[]
  ): number {
    if (!weather) return 1.0;

    const activityLevel = userVector[3] ?? 0.5;

    if (weather.isOutdoorFriendly && activityLevel > 0.6) {
      return 1.1; // Météo + user actif → boost
    }

    if (!weather.isOutdoorFriendly && activityLevel > 0.7) {
      return 0.9; // Mauvaise météo + user très actif → légère pénalité
    }

    return 1.0;
  }

  // ─────────────────────────────────────────────
  // Explication lisible
  // ─────────────────────────────────────────────

  private buildSummary(weights: ContextWeights, multiplier: number): string {
    const parts: string[] = [];

    if (weights.weatherMatch > 1.05) parts.push('météo idéale');
    else if (weights.weatherMatch < 0.9) parts.push('météo défavorable');

    if (weights.seasonalFit > 1.05) parts.push('saison parfaite');
    else if (weights.seasonalFit < 0.95) parts.push('saison sous-optimale');

    if (weights.travelSeasonPenalty < 0.9) parts.push('haute saison (prix élevés)');
    else if (weights.travelSeasonPenalty > 1.05) parts.push('hors-saison (bon prix)');

    if (weights.outdoorBoost > 1.05) parts.push('conditions outdoor excellentes');

    if (parts.length === 0) return 'Conditions contextuelles neutres';

    const direction = multiplier >= 1.0 ? '↑' : '↓';
    return `${direction} ${parts.join(', ')}`;
  }
}

export default new ContextWeightingService();
export { ContextWeightingService };
