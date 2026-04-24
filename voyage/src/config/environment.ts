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
  duffel: {
    apiToken: process.env.DUFFEL_API_TOKEN || ''
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: process.env.REDIS_ENABLED !== 'false' // Enable by default
  },
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map(origin => origin.trim())
  }
};

// Validate required environment variables
const requiredEnvVars = ['AMADEUS_API_KEY', 'AMADEUS_API_SECRET', 'DUFFEL_API_TOKEN'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  Missing environment variable: ${envVar}`);
  }
}
