import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { prisma } from '@dreamscape/db';
// import activitiesRoutes from './routes/activities'; // TODO: Fix AmadeusService import

import profileRoutes from './routes/profile';
import healthRoutes from './routes/health';
import onboardingRoutes from '@routes/onboarding';
import aiIntegrationRoutes from '@routes/aiIntegration';
import historyRoutes from '@routes/history';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { userKafkaService } from './services/KafkaService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());

// CORS configuration - allow multiple origins for development
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://172.21.160.1:5173',
  // Add any other development origins as needed
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(apiLimiter);

// Static files for avatar uploads
app.use('/uploads', express.static('uploads'));

// Routes
// app.use('/api/v1/activities', activitiesRoutes); // TODO: Fix AmadeusService import
app.use('/api/v1/users/profile', profileRoutes);
app.use('/api/v1/users/onboarding', onboardingRoutes);
app.use('/api/v1/users/history', historyRoutes);
app.use('/api/v1/ai', aiIntegrationRoutes);

// Health check routes - INFRA-013.1
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes); // Alternative path for consistency

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
    // Test database connection
    await prisma.$connect();
    console.log('✅ PostgreSQL database connected successfully');

    // Initialize Kafka service
    try {
      await userKafkaService.initialize();
      console.log('✅ Kafka service initialized successfully');
    } catch (kafkaError) {
      console.warn('⚠️  Kafka service initialization failed (continuing without Kafka):', kafkaError);
      // Continue without Kafka - service should still work
    }

    // Create uploads directory if it doesn't exist
    const fs = require('fs');
    const uploadsDir = 'uploads/avatars';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    app.listen(PORT, () => {
      console.log(`🚀 User service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handler
const shutdown = async () => {
  console.log('\n🛑 Shutting down user service...');

  try {
    // Close Kafka connections
    await userKafkaService.shutdown();
    console.log('✅ Kafka service disconnected');

    // Close database connections
    await prisma.$disconnect();
    console.log('✅ Database disconnected');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();

export default app;