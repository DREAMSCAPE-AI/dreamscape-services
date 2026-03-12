import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

import config from './config';
import healthRoutes from './routes/health';
import mailRoutes from './routes/mail';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { mailRateLimiter } from './middleware/rateLimiter';
import mailKafkaService from './services/KafkaService';

const app = express();

// ── Middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));

// ── Routes ──────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/v1/mail', mailRateLimiter, mailRoutes);

// ── Error handling ──────────────────────────────────
app.use(errorHandler);
app.use('*', notFoundHandler);

// ── Server start ────────────────────────────────────
const startServer = async () => {
  try {
    // Kafka consumer (non-critical — service still works via REST)
    await mailKafkaService.initialize();

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully…`);
      await mailKafkaService.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    app.listen(config.port, () => {
      console.log(`🚀 Mail service running on port ${config.port} (${config.nodeEnv})`);
    });
  } catch (error) {
    console.error('💥 Failed to start mail service:', error);
    process.exit(1);
  }
};

startServer();

export { app, startServer };
