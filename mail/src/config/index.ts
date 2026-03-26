import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '3007', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'no-reply@dreamscape.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'DreamScape',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  },

  kafka: {
    brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
    clientId: process.env.KAFKA_CLIENT_ID || 'mail-service',
  },

  rateLimit: {
    windowMs: parseInt(process.env.MAIL_RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.MAIL_RATE_LIMIT_MAX || '10', 10),
  },

  auth: {
    apiKey: process.env.MAIL_API_KEY || '',
  },
};

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';

if (isProduction && !process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY is required in production');
}

export default config;
