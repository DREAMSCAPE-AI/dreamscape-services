/**
 * IA-005 - US-IA-005 : Analyse Contextuelle Simple
 * DR-192 : Intégration API météo
 *
 * Intègre l'API OpenWeatherMap pour récupérer les données météo des destinations.
 * Les résultats sont mis en cache Redis (TTL 30 min) pour limiter les appels externes.
 */

import axios from 'axios';
import Redis from 'ioredis';
import type {
  WeatherData,
  WeatherForecast,
  WeatherCondition,
  DailyForecast,
} from '../types/context.types';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const TTL_WEATHER = 1800;    // 30 min — météo actuelle
const TTL_FORECAST = 3600;   // 1 h  — prévisions

/** Map des codes météo OWM → WeatherCondition interne */
const OWM_CONDITION_MAP: Record<string, WeatherCondition> = {
  Thunderstorm: 'stormy',
  Drizzle:      'rainy',
  Rain:         'rainy',
  Snow:         'snowy',
  Mist:         'foggy',
  Smoke:        'foggy',
  Haze:         'foggy',
  Fog:          'foggy',
  Clear:        'sunny',
  Clouds:       'cloudy',
};

function mapOWMCondition(main: string, temp: number): WeatherCondition {
  if (OWM_CONDITION_MAP[main]) {
    const base = OWM_CONDITION_MAP[main];
    // Affiner sunny/cloudy selon la température
    if (base === 'sunny' && temp >= 30) return 'hot';
    if (base === 'sunny' && temp <= 5)  return 'cold';
    return base;
  }
  return 'partly_cloudy';
}

function isOutdoorFriendly(condition: WeatherCondition, temp: number): boolean {
  const badConditions: WeatherCondition[] = ['stormy', 'rainy', 'snowy', 'foggy'];
  if (badConditions.includes(condition)) return false;
  if (temp < 0 || temp > 40) return false;
  return true;
}

class WeatherService {
  // Getter lazy : lu à chaque appel, après que dotenv ait chargé le .env
  private get apiKey(): string {
    return process.env.OPENWEATHER_API_KEY || '';
  }

  private get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  // ─────────────────────────────────────────────
  // Météo actuelle
  // ─────────────────────────────────────────────

  /**
   * Récupère la météo actuelle pour un code ville (ex: "PAR", "LON", "NYC")
   * ou une ville libre (ex: "Paris,FR").
   * Essaie d'abord le cache Redis avant d'appeler OWM.
   */
  async getCurrentWeather(cityCode: string): Promise<WeatherData | null> {
    const cacheKey = `weather:current:${cityCode.toLowerCase()}`;

    // 1. Cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as WeatherData;
    } catch { /* Redis optionnel */ }

    if (!this.isConfigured) {
      console.warn('⚠️ OPENWEATHER_API_KEY non configurée — météo indisponible');
      return null;
    }

    // 2. Appel API OWM
    try {
      const { data } = await axios.get(`${OWM_BASE}/weather`, {
        params: {
          q:     cityCode,
          appid: this.apiKey,
          units: 'metric',
          lang:  'fr',
        },
        timeout: 5000,
      });

      const condition = mapOWMCondition(data.weather[0].main, data.main.temp);

      const weather: WeatherData = {
        cityCode,
        cityName:            data.name,
        country:             data.sys.country,
        temperature:         Math.round(data.main.temp),
        feelsLike:           Math.round(data.main.feels_like),
        humidity:            data.main.humidity,
        windSpeed:           Math.round((data.wind?.speed ?? 0) * 3.6), // m/s → km/h
        condition,
        conditionDescription: data.weather[0].description,
        uvIndex:             0, // OWM gratuit ne fournit pas l'UV dans /weather
        visibility:          Math.round((data.visibility ?? 10000) / 1000),
        isOutdoorFriendly:   isOutdoorFriendly(condition, data.main.temp),
        fetchedAt:           new Date(),
      };

      // 3. Mise en cache
      try {
        await redis.setex(cacheKey, TTL_WEATHER, JSON.stringify(weather));
      } catch { /* Redis optionnel */ }

      return weather;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`⚠️ Ville non trouvée sur OWM: ${cityCode}`);
      } else {
        console.error('❌ Erreur OWM (météo actuelle):', error.message);
      }
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // Prévisions 5 jours
  // ─────────────────────────────────────────────

  /**
   * Récupère les prévisions météo sur 5 jours pour une ville.
   * Utilisé pour adapter les recommandations sur la période de voyage.
   */
  async getForecast(cityCode: string, days = 5): Promise<WeatherForecast | null> {
    const cacheKey = `weather:forecast:${cityCode.toLowerCase()}:${days}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as WeatherForecast;
    } catch { /* Redis optionnel */ }

    if (!this.isConfigured) return null;

    try {
      const { data } = await axios.get(`${OWM_BASE}/forecast`, {
        params: {
          q:     cityCode,
          appid: this.apiKey,
          units: 'metric',
          lang:  'fr',
          cnt:   days * 8, // 8 créneaux de 3h par jour
        },
        timeout: 5000,
      });

      // Agréger par jour
      const byDay: Record<string, any[]> = {};
      for (const entry of data.list) {
        const date = entry.dt_txt.split(' ')[0];
        if (!byDay[date]) byDay[date] = [];
        byDay[date].push(entry);
      }

      const dailyForecasts: DailyForecast[] = Object.entries(byDay)
        .slice(0, days)
        .map(([date, entries]) => {
          const temps = entries.map((e: any) => e.main.temp);
          const temps_max = entries.map((e: any) => e.main.temp_max);
          const temps_min = entries.map((e: any) => e.main.temp_min);
          const avgTemp = temps.reduce((s, t) => s + t, 0) / temps.length;
          const mainEntry = entries[Math.floor(entries.length / 2)]; // créneau de midi
          const condition = mapOWMCondition(mainEntry.weather[0].main, avgTemp);
          const precipChance = Math.round(
            (entries.filter((e: any) => e.pop > 0.3).length / entries.length) * 100
          );

          return {
            date,
            tempMin: Math.round(Math.min(...temps_min)),
            tempMax: Math.round(Math.max(...temps_max)),
            condition,
            precipitationProbability: precipChance,
            isOutdoorFriendly: isOutdoorFriendly(condition, avgTemp),
          };
        });

      const forecast: WeatherForecast = {
        cityCode,
        days: dailyForecasts,
        fetchedAt: new Date(),
      };

      try {
        await redis.setex(cacheKey, TTL_FORECAST, JSON.stringify(forecast));
      } catch { /* Redis optionnel */ }

      return forecast;
    } catch (error: any) {
      console.error('❌ Erreur OWM (prévisions):', error.message);
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // Utilitaires
  // ─────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      await axios.get(`${OWM_BASE}/weather`, {
        params: { q: 'Paris', appid: this.apiKey, units: 'metric' },
        timeout: 3000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Efface le cache météo d'une ville (utile pour tests/admin) */
  async invalidateCache(cityCode: string): Promise<void> {
    const keys = [
      `weather:current:${cityCode.toLowerCase()}`,
      `weather:forecast:${cityCode.toLowerCase()}:5`,
    ];
    try {
      await redis.del(...keys);
    } catch { /* Redis optionnel */ }
  }
}

export default new WeatherService();
