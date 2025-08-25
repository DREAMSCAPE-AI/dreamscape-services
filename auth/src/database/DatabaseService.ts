import prisma from './prisma';
import { connectMongoDB, getMongoHealthStatus, disconnectMongoDB, type MongoHealthStatus } from './mongodb';
import { 
  FlightData,
  UserActivity,
  Analytics
} from './schemas';
import mongoose from 'mongoose';

// Types et interfaces
interface DatabaseHealth {
  postgresql: boolean;
  mongodb: boolean;
  overall: boolean;
  details: {
    postgresql: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      connected: boolean;
      error?: string;
    };
    mongodb: MongoHealthStatus & {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
  };
  timestamp: string;
}

interface MongoModels {
  FlightData: typeof FlightData;
  UserActivity: typeof UserActivity;
  Analytics: typeof Analytics;
}

interface InitializationResult {
  success: boolean;
  postgresql: boolean;
  mongodb: boolean;
  errors: string[];
}

export class DatabaseService {
  private static instance: DatabaseService;
  private isInitialized: boolean = false;
  private postgresqlHealthy: boolean = false;
  private mongodbHealthy: boolean = false;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Convenience wrapper used by services to initialize DBs.
   * Keeps backward compatibility with `DatabaseService.connect()` usage.
   */
  public static async connect() {
    return DatabaseService.getInstance().initialize();
  }

  /**
   * Initialize both PostgreSQL and MongoDB connections
   */
  public async initialize(): Promise<InitializationResult> {
    if (this.isInitialized) {
      console.log('📊 Database service already initialized');
      return {
        success: true,
        postgresql: this.postgresqlHealthy,
        mongodb: this.mongodbHealthy,
        errors: []
      };
    }

    const result: InitializationResult = {
      success: false,
      postgresql: false,
      mongodb: false,
      errors: []
    };

    // PostgreSQL connection (critique)
    try {
      await prisma.$connect();
      await this.testPostgreSQLConnection();
      this.postgresqlHealthy = true;
      result.postgresql = true;
      console.log('✅ PostgreSQL connected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown PostgreSQL error';
      result.errors.push(`PostgreSQL: ${errorMessage}`);
      console.error('❌ PostgreSQL connection failed:', errorMessage);
    }

    // MongoDB connection (non-critique)
    try {
      await connectMongoDB();
      this.mongodbHealthy = true;
      result.mongodb = true;
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown MongoDB error';
      result.errors.push(`MongoDB: ${errorMessage}`);
      console.warn('⚠️ MongoDB connection failed (non-critical):', errorMessage);
    }

    // L'app peut fonctionner sans MongoDB, mais pas sans PostgreSQL
    if (!result.postgresql) {
      throw new Error(`Critical database connection failed: ${result.errors.join(', ')}`);
    }

    this.isInitialized = true;
    result.success = true;
    console.log('🚀 Database service initialized successfully');
    
    return result;
  }

  /**
   * Test PostgreSQL connection with a simple query
   */
  private async testPostgreSQLConnection(): Promise<void> {
    await prisma.$queryRaw`SELECT 1 as test`;
  }

  /**
   * Get Prisma client for structured data operations
   */
  public getPrismaClient() {
    if (!this.postgresqlHealthy) {
      throw new Error('PostgreSQL not available');
    }
    return prisma;
  }

  /**
   * Get MongoDB models for unstructured data operations
   */
  public getMongoModels(): MongoModels {
    if (!this.mongodbHealthy) {
      throw new Error('MongoDB not available');
    }
    return {
      FlightData,
      UserActivity,
      Analytics
    };
  }

  /**
   * Health check for both databases with timeout and performance metrics
   */
  public async healthCheck(timeoutMs: number = 5000): Promise<DatabaseHealth> {
    const startTime = Date.now();

    const health: DatabaseHealth = {
      postgresql: false,
      mongodb: false,
      overall: false,
      details: {
        postgresql: {
          status: 'unhealthy',
          connected: false
        },
        mongodb: {
          ...getMongoHealthStatus(),
          status: 'unhealthy'
        }
      },
      timestamp: new Date().toISOString()
    };

    // PostgreSQL health check avec timeout
    const pgStart = Date.now();
    try {
      await Promise.race([
        this.testPostgreSQLConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PostgreSQL health check timeout')), timeoutMs)
        )
      ]);
      
      health.postgresql = true;
      health.details.postgresql = {
        status: 'healthy',
        responseTime: Date.now() - pgStart,
        connected: true
      };
      this.postgresqlHealthy = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      health.details.postgresql = {
        status: 'unhealthy',
        responseTime: Date.now() - pgStart,
        connected: false,
        error: errorMessage
      };
      this.postgresqlHealthy = false;
      console.error('PostgreSQL health check failed:', errorMessage);
    }

    // MongoDB health check (plus léger que findOne())
    const mongoStart = Date.now();
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        // Simple ping au lieu de findOne()
        await mongoose.connection.db.admin().ping();
        
        health.mongodb = true;
        health.details.mongodb = {
          ...getMongoHealthStatus(),
          status: 'healthy',
          responseTime: Date.now() - mongoStart
        };
        this.mongodbHealthy = true;
      } else {
        throw new Error('MongoDB not connected');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      health.mongodb = false;
      health.details.mongodb = {
        ...getMongoHealthStatus(),
        status: 'unhealthy',
        responseTime: Date.now() - mongoStart,
        error: errorMessage
      };
      this.mongodbHealthy = false;
      console.error('MongoDB health check failed:', errorMessage);
    }

    // Overall health (PostgreSQL critique, MongoDB optionnel)
    health.overall = health.postgresql; // MongoDB n'est pas critique

    console.log(`🏥 Health check completed in ${Date.now() - startTime}ms`);
    return health;
  }

  /**
   * Check if databases are ready for operations
   */
  public isReady(): { ready: boolean; postgresql: boolean; mongodb: boolean } {
    return {
      ready: this.isInitialized && this.postgresqlHealthy,
      postgresql: this.postgresqlHealthy,
      mongodb: this.mongodbHealthy
    };
  }

  /**
   * Get basic stats about database connections
   */
  public getStats(): {
    initialized: boolean;
    postgresql: boolean;
    mongodb: boolean;
    uptime: number;
  } {
    return {
      initialized: this.isInitialized,
      postgresql: this.postgresqlHealthy,
      mongodb: this.mongodbHealthy,
      uptime: process.uptime()
    };
  }

  /**
   * Graceful shutdown
   */
  public async disconnect(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    // PostgreSQL disconnect
    if (this.postgresqlHealthy) {
      shutdownPromises.push(
        prisma.$disconnect()
          .then(() => {
            console.log('🔒 PostgreSQL disconnected');
            this.postgresqlHealthy = false;
          })
          .catch((error) => {
            console.error('❌ Error disconnecting PostgreSQL:', error);
          })
      );
    }

    // MongoDB disconnect
    if (this.mongodbHealthy) {
      shutdownPromises.push(
        disconnectMongoDB()
          .then(() => {
            this.mongodbHealthy = false;
          })
          .catch((error) => {
            console.error('❌ Error disconnecting MongoDB:', error);
          })
      );
    }

    await Promise.allSettled(shutdownPromises);
    this.isInitialized = false;
    console.log('🔒 Database service disconnected');
  }
}

// Export des types pour utilisation dans les routes
export type { DatabaseHealth, MongoModels, InitializationResult };
export default DatabaseService;