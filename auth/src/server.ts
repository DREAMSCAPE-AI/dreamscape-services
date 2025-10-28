import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { DatabaseService } from './database/DatabaseService';
import router from './routes/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

dotenv.config();


const app = express();
const PORT = process.env.PORT || 3001;


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

app.get('/health', async (req, res) => {
  const dbService = DatabaseService.getInstance();
  const startTime = process.uptime();

  try {
    // Check database connectivity
    const dbHealthy = await dbService.healthCheck();

    res.json({
      status: 'ok',
      service: 'auth-service',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(startTime),
      environment: process.env.NODE_ENV || 'development',
      database: {
        postgresql: dbHealthy.postgresql || false,
        mongodb: dbHealthy.mongodb || false
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      error: 'Database health check failed'
    });
  }
});

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const startServer = async () => {
  try {
    const dbService = DatabaseService.getInstance();
    const initResult = await dbService.initialize();
    
    if (initResult.success) {
      console.log('✅ Database initialized successfully');
      console.log(`📊 PostgreSQL: ${initResult.postgresql ? '✅' : '❌'}`);
      console.log(`📊 MongoDB: ${initResult.mongodb ? '✅' : '⚠️ (non-critical)'}`);
    } else {
      console.error('❌ Database initialization failed:', initResult.errors);
      throw new Error(`Database initialization failed: ${initResult.errors.join(', ')}`);
    }
    
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);
      
      try {
        await dbService.disconnect();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    app.listen(PORT, () => {
      console.log(`🚀 Auth service running on port ${PORT}`);
      console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
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