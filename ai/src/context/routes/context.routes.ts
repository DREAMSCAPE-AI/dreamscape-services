/**
 * IA-005 - US-IA-005 : Analyse Contextuelle Simple
 * DR-195 : API de contexte
 *
 * Endpoints exposant les données contextuelles et les recommandations ajustées.
 *
 * Routes :
 *   GET  /api/v1/context/weather/:cityCode      → météo actuelle
 *   GET  /api/v1/context/forecast/:cityCode     → prévisions 5 jours
 *   GET  /api/v1/context/seasonal               → contexte saisonnier actuel
 *   POST /api/v1/context/recommendations        → recommandations contextualisées
 *   GET  /api/v1/context/health                 → statut du module contexte
 *   DELETE /api/v1/context/cache/:cityCode      → invalider le cache météo (admin)
 */

import { Router, Request, Response } from 'express';
import weatherService from '../services/weather.service';
import contextWeightingService, { buildSeasonalContext } from '../services/context-weighting.service';
import type {
  DestinationContext,
  ContextualRecommendationRequest,
} from '../types/context.types';

const router = Router();

// ─────────────────────────────────────────────
// GET /weather/:cityCode — Météo actuelle
// ─────────────────────────────────────────────

/**
 * Retourne la météo actuelle pour une ville.
 * Utilise le cache Redis si disponible.
 *
 * Exemple : GET /api/v1/context/weather/Paris,FR
 */
router.get('/weather/:cityCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cityCode } = req.params;

    const weather = await weatherService.getCurrentWeather(cityCode);

    if (!weather) {
      res.status(404).json({
        success: false,
        error: 'Données météo indisponibles',
        hint: 'Vérifiez que OPENWEATHER_API_KEY est configurée et que le code ville est valide.',
      });
      return;
    }

    res.json({ success: true, data: weather });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération météo',
      message: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
});

// ─────────────────────────────────────────────
// GET /forecast/:cityCode — Prévisions
// ─────────────────────────────────────────────

router.get('/forecast/:cityCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cityCode } = req.params;
    const days = Math.min(parseInt(req.query.days as string || '5'), 5);

    const forecast = await weatherService.getForecast(cityCode, days);

    if (!forecast) {
      res.status(404).json({
        success: false,
        error: 'Prévisions indisponibles pour cette ville',
      });
      return;
    }

    res.json({ success: true, data: forecast });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des prévisions',
    });
  }
});

// ─────────────────────────────────────────────
// GET /seasonal — Contexte saisonnier actuel
// ─────────────────────────────────────────────

router.get('/seasonal', (_req: Request, res: Response): void => {
  try {
    const seasonal = buildSeasonalContext();
    res.json({ success: true, data: seasonal });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur contexte saisonnier' });
  }
});

// ─────────────────────────────────────────────
// POST /recommendations — Recommandations contextualisées
// ─────────────────────────────────────────────

/**
 * Applique le contexte météo + saisonnier sur une liste de recommandations.
 *
 * Body attendu :
 * {
 *   userId: string,
 *   cityCode: string,
 *   userVector: number[8],
 *   recommendations: Array<{ id: string, score: number, [key: string]: any }>,
 *   applyWeather?: boolean,    // défaut: true
 *   applySeasonal?: boolean,   // défaut: true
 * }
 */
router.post('/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      cityCode,
      userVector,
      recommendations,
      applyWeather = true,
      applySeasonal = true,
    } = req.body as ContextualRecommendationRequest & {
      userVector: number[];
      recommendations: Array<{ id: string; score: number; [key: string]: any }>;
    };

    if (!userId) {
      res.status(400).json({ success: false, error: 'userId requis' });
      return;
    }

    if (!userVector || userVector.length !== 8) {
      res.status(400).json({ success: false, error: 'userVector (8 dimensions) requis' });
      return;
    }

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      res.status(400).json({ success: false, error: 'recommendations (liste non vide) requises' });
      return;
    }

    // Récupérer la météo si cityCode présent et applyWeather activé
    const weather = (cityCode && applyWeather)
      ? await weatherService.getCurrentWeather(cityCode)
      : null;

    // Construire le contexte saisonnier si applySeasonal activé
    const seasonal = applySeasonal
      ? buildSeasonalContext()
      : buildSeasonalContext(); // toujours disponible, même si non appliqué

    // Assembler le DestinationContext
    const context: DestinationContext = {
      cityCode: cityCode ?? 'unknown',
      weather:  applyWeather ? weather : null,
      seasonal,
      computedAt: new Date(),
    };

    // Appliquer la pondération contextuelle sur les recommandations
    const contextualRecs = contextWeightingService.applyContextToRecommendations(
      recommendations,
      context,
      userVector,
    );

    res.json({
      success: true,
      userId,
      count:   contextualRecs.length,
      context: {
        cityCode:     context.cityCode,
        weather:      context.weather ? { condition: context.weather.condition, temperature: context.weather.temperature } : null,
        season:       context.seasonal.currentSeason,
        travelSeason: context.seasonal.travelSeason,
      },
      data: contextualRecs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'application du contexte',
      message: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
});

// ─────────────────────────────────────────────
// GET /health — Statut du module contexte
// ─────────────────────────────────────────────

router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const weatherApiOk = await weatherService.healthCheck();
    const seasonal = buildSeasonalContext();

    const status = {
      module:     'context',
      weatherApi: weatherApiOk,
      seasonal:   true,
      currentSeason: seasonal.currentSeason,
      travelSeason:  seasonal.travelSeason,
    };

    res.status(weatherApiOk ? 200 : 206).json({ success: true, data: status });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Module contexte indisponible' });
  }
});

// ─────────────────────────────────────────────
// DELETE /cache/:cityCode — Invalider le cache (admin)
// ─────────────────────────────────────────────

router.delete('/cache/:cityCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cityCode } = req.params;
    await weatherService.invalidateCache(cityCode);
    res.json({ success: true, message: `Cache météo invalidé pour ${cityCode}` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur invalidation cache' });
  }
});

export default router;
