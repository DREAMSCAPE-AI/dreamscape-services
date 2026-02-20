import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { prisma } from '@dreamscape/db';
// import activitiesRoutes from './routes/activities'; // TODO: Fix AmadeusService import

import profileRoutes from './routes/profile';
import healthRoutes from './routes/health';
import onboardingRoutes from '@routes/onboarding';
import aiIntegrationRoutes from '@routes/aiIntegration';
import favoritesRoutes from './routes/favorites';
import historyRoutes from '@routes/history';
import gdprRoutes from './routes/gdpr';
import notificationRoutes from './routes/notificationRoutes';
import { socketService } from './services/SocketService';
import { auditLogger } from './middleware/auditLogger';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { userKafkaService } from './services/KafkaService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());

// CORS configuration - allow multiple origins from environment or defaults
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(origin => origin.trim());

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

// Audit logging middleware (logs access to sensitive routes)
app.use(auditLogger);

// Routes
// app.use('/api/v1/activities', activitiesRoutes); // TODO: Fix AmadeusService import
app.use('/api/v1/users/profile', profileRoutes);
app.use('/api/v1/users/onboarding', onboardingRoutes);
app.use('/api/v1/users/history', historyRoutes);
app.use('/api/v1/ai', aiIntegrationRoutes);
app.use('/api/v1/users/favorites', favoritesRoutes);
app.use('/api/v1/users/gdpr', gdprRoutes);
app.use('/api/v1/users/notifications', notificationRoutes);

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

    // Initialize Socket.io
    const io = new SocketServer(httpServer, {
      cors: { origin: allowedOrigins, credentials: true },
    });

    socketService.initialize(io);

    // Socket.io auth middleware — validates JWT before allowing connection
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) return next(new Error('Authentication required'));

        const secret = process.env.JWT_SECRET;
        if (!secret) return next(new Error('Server misconfiguration'));

        const decoded = jwt.verify(token, secret) as { id: string; type?: string };
        if (decoded.type !== 'access') return next(new Error('Invalid token type'));

        socket.data.userId = decoded.id;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    io.on('connection', (socket) => {
      const userId: string = socket.data.userId;
      socket.join(`user:${userId}`);
      console.log(`[Socket.io] User ${userId} connected`);

      socket.on('disconnect', () => {
        console.log(`[Socket.io] User ${userId} disconnected`);
      });
    });

    httpServer.listen(PORT, () => {
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
    // Close HTTP server (and Socket.io)
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    console.log('✅ HTTP server closed');

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