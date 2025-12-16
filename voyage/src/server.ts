import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Server } from 'http';
import { config } from '@/config/environment';
import routes from '@/routes';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { apiLimiter } from '@/middleware/rateLimiter';
import DatabaseService, { type InitializationResult } from '@/database/DatabaseService';
import redisClient from '@/config/redis';
import voyageKafkaService from '@/services/KafkaService';

// Types pour l'application
interface ServerState {
  isRunning: boolean;
  startedAt?: Date;
  server?: Server;
  dbService?: DatabaseService;
  shutdownInProgress: boolean;
}

interface RootResponse {
  message: string;
  version: string;
  status: 'running' | 'starting' | 'shutting-down';
  timestamp: string;
  uptime: number;
  environment: string;
  health_endpoint: string;
  databases: {
    postgresql: boolean;
  };
}

// État global du serveur
const serverState: ServerState = {
  isRunning: false,
  shutdownInProgress: false
};

// Configuration de l'application Express
function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration
  app.use(cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    exposedHeaders: ['x-total-count', 'x-page-count']
  }));

  // Compression middleware
  app.use(compression({
    filter: (req: Request, res: Response) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Logging middleware avec format personnalisé
  const morganFormat = config.nodeEnv === 'production' 
    ? 'combined' 
    : ':method :url :status :response-time ms - :res[content-length]';
    
  app.use(morgan(morganFormat, {
    skip: (req: Request) => {
      // Skip health check logs pour éviter le spam
      return req.url.startsWith('/api/health');
    }
  }));

  // Body parsing middleware
  app.use(express.json({ 
    limit: '10mb',
    type: ['application/json', 'application/vnd.api+json']
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // Rate limiting (avant les routes)
  app.use('/api', apiLimiter);

  // API routes
  app.use('/api', routes);

  // Root endpoint avec informations détaillées
  app.get('/', (req: Request, res: Response<RootResponse>): void => {
    const dbService = DatabaseService.getInstance();
    const readiness = dbService.isReady();
    
    const response: RootResponse = {
      message: 'Dreamscape API Server',
      version: process.env.npm_package_version || '1.0.0',
      status: serverState.shutdownInProgress ? 'shutting-down' : 'running',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: config.nodeEnv,
      health_endpoint: `/api/health`,
      databases: {
        postgresql: readiness.postgresql
      }
    };

    res.json(response);
  });

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (doit être en dernier)
  app.use(errorHandler);

  return app;
}

// Validation de la configuration
function validateConfig(): void {
  const requiredEnvVars = ['NODE_ENV', 'PORT'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!config.port || config.port < 1000 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}. Must be between 1000 and 65535`);
  }
}

// Initialisation de la base de données avec retry
async function initializeDatabase(maxRetries: number = 3): Promise<InitializationResult> {
  const dbService = DatabaseService.getInstance();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Database initialization attempt ${attempt}/${maxRetries}...`);
      const result = await dbService.initialize();
      
      if (result.success) {
        console.log('✅ Database initialization successful');
        console.log(`📊 PostgreSQL: ${result.postgresql ? '✅' : '❌'}`);
        return result;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown database error');
      console.error(`❌ Database initialization attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = 2000 * attempt; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Database initialization failed after all retries');
}

// Graceful shutdown amélioré
async function gracefulShutdown(signal: string): Promise<void> {
  if (serverState.shutdownInProgress) {
    console.log('⚠️ Shutdown already in progress, forcing exit...');
    process.exit(1);
  }

  serverState.shutdownInProgress = true;
  console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);
  
  const shutdownTimeout = setTimeout(() => {
    console.error('⏰ Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000); // 30 secondes max pour le shutdown

  try {
    // 1. Arrêter d'accepter de nouvelles connexions
    if (serverState.server) {
      console.log('🔒 Closing HTTP server...');
      await new Promise<void>((resolve, reject) => {
        serverState.server!.close((error) => {
          if (error) {
            reject(error);
          } else {
            console.log('✅ HTTP server closed');
            resolve();
          }
        });
      });
    }

    // 2. Fermer la connexion Redis
    if (redisClient.isReady()) {
      console.log('🔒 Closing Redis connection...');
      await redisClient.disconnect();
      console.log('✅ Redis connection closed');
    }

    // 2.5. Fermer la connexion Kafka - DR-402 / DR-403
    try {
      await voyageKafkaService.shutdown();
      console.log('✅ Kafka disconnected');
    } catch (kafkaError) {
      console.warn('⚠️ Error closing Kafka connection:', kafkaError);
    }

    // 3. Fermer les connexions de base de données
    if (serverState.dbService) {
      console.log('🔒 Closing database connections...');
      await serverState.dbService.disconnect();
      console.log('✅ Database connections closed');
    }

    clearTimeout(shutdownTimeout);
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
function setupErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('💥 Unhandled Rejection:', reason);
    process.exit(1);
  });

  // Signaux de fermeture
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => void gracefulShutdown('SIGUSR2')); // nodemon
}

// Fonction principale de démarrage
async function startServer(): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting Dreamscape API Server...');
    console.log(`📍 Environment: ${config.nodeEnv}`);
    console.log(`🔧 Node.js: ${process.version}`);
    console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

    // 1. Validation de la configuration
    validateConfig();
    console.log('✅ Configuration validated');

    // 2. Setup des error handlers
    setupErrorHandlers();
    console.log('✅ Error handlers setup');

    // 3. Initialisation de la base de données
    serverState.dbService = DatabaseService.getInstance();
    const dbResult = await initializeDatabase();

    if (!dbResult.postgresql) {
      throw new Error('PostgreSQL connection is required for the application to start');
    }

    // 3.5. Initialisation de Redis (optionnel - pour le cache)
    try {
      await redisClient.connect();
      console.log('✅ Redis connected (cache enabled)');
    } catch (redisError) {
      console.warn('⚠️ Redis connection failed - cache disabled, continuing without cache');
    }

    // 3.6. Initialisation de Kafka - DR-402 / DR-403
    try {
      await voyageKafkaService.initialize();
      console.log('✅ Kafka initialized successfully');
    } catch (kafkaError) {
      console.warn('⚠️ Kafka initialization failed (non-critical):', kafkaError);
      console.warn('⚠️ Service will continue without event publishing');
    }

    // 4. Création de l'application Express
    const app = createApp();
    console.log('✅ Express app created');

    // 5. Démarrage du serveur HTTP
    serverState.server = app.listen(config.port, async () => {
      serverState.isRunning = true;
      serverState.startedAt = new Date();

      const startupTime = Date.now() - startTime;
      console.log('\n🎉 Server started successfully!');
      console.log(`🚀 Dreamscape API server running on port ${config.port}`);
      console.log(`🌐 CORS origin: ${config.cors.origin}`);
      console.log(`🔗 Health check: http://localhost:${config.port}/api/health`);
      console.log(`💾 Databases: PostgreSQL ✅`);
      console.log(`🔴 Redis Cache: ${redisClient.isReady() ? '✅ enabled' : '⚠️ disabled'}`);

      // Check Kafka health - DR-402 / DR-403
      const kafkaHealth = await voyageKafkaService.healthCheck();
      console.log(`📨 Kafka: ${kafkaHealth.healthy ? '✅ Connected' : '⚠️ Not available'}`);

      console.log(`⏱️  Startup time: ${startupTime}ms`);
      console.log(`🆔 Process ID: ${process.pid}`);
      console.log('📊 Server ready to accept connections\n');
    });

    // Gestion des erreurs du serveur
    serverState.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.port} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const startupTime = Date.now() - startTime;
    
    console.error('\n💥 Failed to start server:');
    console.error(`❌ Error: ${errorMessage}`);
    console.error(`⏱️  Failed after: ${startupTime}ms`);
    
    if (error instanceof Error && error.stack) {
      console.error('📍 Stack trace:', error.stack);
    }
    
    process.exit(1);
  }
}

// Export pour les tests
export { createApp, serverState };

// Démarrer le serveur directement (ES Modules)
startServer().catch((error) => {
  console.error('💥 Failed to start server:', error);
  process.exit(1);
});