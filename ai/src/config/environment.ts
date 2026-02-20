import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  amadeus: {
    apiKey: process.env.AMADEUS_API_KEY!,
    apiSecret: process.env.AMADEUS_API_SECRET!,
    baseUrl: process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com'
  },
  // IA-005 : Analyse Contextuelle — optionnel, le service dégrade gracieusement si absent
  openWeather: {
    apiKey: process.env.OPENWEATHER_API_KEY || '',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  }
};

// Validate required environment variables
const requiredEnvVars = ['AMADEUS_API_KEY', 'AMADEUS_API_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
