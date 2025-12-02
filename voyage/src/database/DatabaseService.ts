import prisma from './prisma';
import type { PrismaClient } from '../../../db/node_modules/@prisma/client';

// Types et interfaces
interface DatabaseHealth {
  postgresql: boolean;
  overall: boolean;
  details: {
    postgresql: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      connected: boolean;
      error?: string;
    };
  };
  timestamp: string;
}

interface InitializationResult {
  success: boolean;
  postgresql: boolean;
  errors: string[];
}

export class DatabaseService {
  private static instance: DatabaseService;
  private isInitialized: boolean = false;
  private postgresqlHealthy: boolean = false;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Convenience wrapper used by services to initialize DB.
   * Keeps backward compatibility with `DatabaseService.connect()` usage.
   */
  public static async connect() {
    return DatabaseService.getInstance().initialize();
  }

  /**
   * Initialize PostgreSQL connection
   */
  public async initialize(): Promise<InitializationResult> {
    if (this.isInitialized) {
      console.log('📊 Database service already initialized');
      return {
        success: true,
        postgresql: this.postgresqlHealthy,
        errors: []
      };
    }

    const result: InitializationResult = {
      success: false,
      postgresql: false,
      errors: []
    };

    // PostgreSQL connection
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
      throw new Error(`Database connection failed: ${errorMessage}`);
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
   * Get Prisma client for database operations
   */
  public getPrismaClient(): PrismaClient {
    if (!this.postgresqlHealthy) {
      throw new Error('PostgreSQL not available');
    }
    return prisma;
  }

  /**
   * Health check for PostgreSQL with timeout and performance metrics
   */
  public async healthCheck(timeoutMs: number = 5000): Promise<DatabaseHealth> {
    const startTime = Date.now();

    const health: DatabaseHealth = {
      postgresql: false,
      overall: false,
      details: {
        postgresql: {
          status: 'unhealthy',
          connected: false
        }
      },
      timestamp: new Date().toISOString()
    };

    // PostgreSQL health check with timeout
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

    health.overall = health.postgresql;

    console.log(`🏥 Health check completed in ${Date.now() - startTime}ms`);
    return health;
  }

  /**
   * Check if database is ready for operations
   */
  public isReady(): { ready: boolean; postgresql: boolean } {
    return {
      ready: this.isInitialized && this.postgresqlHealthy,
      postgresql: this.postgresqlHealthy
    };
  }

  /**
   * Get basic stats about database connection
   */
  public getStats(): {
    initialized: boolean;
    postgresql: boolean;
    uptime: number;
  } {
    return {
      initialized: this.isInitialized,
      postgresql: this.postgresqlHealthy,
      uptime: process.uptime()
    };
  }

  /**
   * Graceful shutdown
   */
  public async disconnect(): Promise<void> {
    if (this.postgresqlHealthy) {
      try {
        await prisma.$disconnect();
        console.log('🔒 PostgreSQL disconnected');
        this.postgresqlHealthy = false;
      } catch (error) {
        console.error('❌ Error disconnecting PostgreSQL:', error);
      }
    }

    this.isInitialized = false;
    console.log('🔒 Database service disconnected');
  }
}

// Export des types pour utilisation dans les routes
export type { DatabaseHealth, InitializationResult };
export default DatabaseService;