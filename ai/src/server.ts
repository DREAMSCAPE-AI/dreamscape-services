import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { prisma } from '@dreamscape/db';
import recommendationsRoutes from '@/routes/recommendations';
// import predictionsRoutes from '@/routes/predictions'; // TODO: Fix AmadeusService import
import healthRoutes from '@/routes/health';
import contextRoutes from '@/context/routes/context.routes';
import { apiLimiter } from '@/middleware/rateLimiter';
import { errorHandler } from '@/middleware/errorHandler';
import aiKafkaService from '@/services/KafkaService';
import {
  handleUserPreferencesUpdated,
  handleUserProfileUpdated,
} from '@/handlers/userEventsHandler';
import {
  handleVoyageSearchPerformed,
  handleVoyageBookingCreated,
  handleFlightSelected,
  handleHotelSelected,
} from '@/handlers/voyageEventsHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware
app.use(helmet());

// Parse CORS origins from environment variable (comma-separated list)
const corsOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(apiLimiter);

// Routes
app.use('/api/v1/recommendations', recommendationsRoutes);
// app.use('/api/v1/predictions', predictionsRoutes); // TODO: Fix AmadeusService import
// IA-005 : Analyse Contextuelle Simple
app.use('/api/v1/context', contextRoutes);

// Health check - INFRA-013.1
app.use('/health', healthRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const startServer = async () => {
  try {
    // Initialize database
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Initialize Kafka and subscribe to events - DR-387
    try {
      await aiKafkaService.initialize();
      console.log('✅ Kafka initialized successfully');

      // Subscribe to user and voyage events for AI analysis - DR-388 / DR-389
      await aiKafkaService.subscribeToEvents({
        onUserPreferencesUpdated: handleUserPreferencesUpdated,
        onUserProfileUpdated: handleUserProfileUpdated,
        onSearchPerformed: handleVoyageSearchPerformed,
        onBookingCreated: handleVoyageBookingCreated,
        onFlightSelected: handleFlightSelected,
        onHotelSelected: handleHotelSelected,
      });
      console.log('✅ Subscribed to user and voyage events');
    } catch (kafkaError) {
      console.warn('⚠️ Kafka initialization failed (non-critical):', kafkaError);
      console.warn('⚠️ Service will continue without event consumption');
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

      try {
        // Disconnect Kafka
        await aiKafkaService.shutdown();
        console.log('✅ Kafka disconnected');

        // Disconnect database
        await prisma.$disconnect();
        console.log('✅ Database disconnected');

        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    app.listen(PORT, async () => {
      console.log(`🤖 AI Service running on port ${PORT}`);

      // Check Kafka health
      const kafkaHealth = await aiKafkaService.healthCheck();
      console.log(`📨 Kafka: ${kafkaHealth.healthy ? '✅ Connected' : '⚠️ Not available'}`);
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;