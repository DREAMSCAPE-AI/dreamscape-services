import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { DatabaseService } from './database/DatabaseService';
import router from './routes/auth';
import healthRoutes from './routes/health';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import redisClient from './config/redis';
import authKafkaService from './services/KafkaService';

dotenv.config();


const app = express();
const PORT = 3001; // Force port 3001


app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', router);

// Health check routes - INFRA-013.1
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes); // Alternative path for consistency

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const startServer = async () => {
  try {
    // Initialize database
    const dbService = DatabaseService.getInstance();
    const initResult = await dbService.initialize();

    if (initResult.success) {
      console.log('✅ Database initialized successfully');
      console.log(`📊 PostgreSQL: ${initResult.postgresql ? '✅' : '❌'}`);
    } else {
      console.error('❌ Database initialization failed:', initResult.errors);
      throw new Error(`Database initialization failed: ${initResult.errors.join(', ')}`);
    }

    // Initialize Redis
    try {
      await redisClient.connect();
      console.log('✅ Redis initialized successfully');
    } catch (error) {
      console.warn('⚠️ Redis initialization failed (non-critical):', error);
      console.warn('⚠️ Service will continue without Redis caching and session management');
    }

    // Initialize Kafka - DR-374 / DR-375
    try {
      await authKafkaService.initialize();
      console.log('✅ Kafka initialized successfully');
    } catch (error) {
      console.warn('⚠️ Kafka initialization failed (non-critical):', error);
      console.warn('⚠️ Service will continue without event publishing');
    }

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

      try {
        // Disconnect database
        await dbService.disconnect();

        // Disconnect Redis
        if (redisClient.isReady()) {
          await redisClient.disconnect();
          console.log('✅ Redis disconnected');
        }

        // Disconnect Kafka - DR-374 / DR-375
        await authKafkaService.shutdown();
        console.log('✅ Kafka disconnected');

        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    app.listen(PORT, async () => {
      console.log(`🚀 Auth service running on port ${PORT}`);
      console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
      console.log(`💾 Redis: ${redisClient.isReady() ? '✅ Connected' : '⚠️ Not available'}`);

      // Check Kafka health - DR-374 / DR-375
      const kafkaHealth = await authKafkaService.healthCheck();
      console.log(`📨 Kafka: ${kafkaHealth.healthy ? '✅ Connected' : '⚠️ Not available'}`);
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer().catch(error => {
    console.error('💥 Fatal error during server startup:', error);
    process.exit(1);
  });
}

export { app, startServer };