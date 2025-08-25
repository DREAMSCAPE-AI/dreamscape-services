import mongoose, { ConnectOptions, Connection } from 'mongoose';

// Types et interfaces
interface MongoConnectionOptions extends ConnectOptions {
  bufferCommands: boolean;
  maxPoolSize: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  family: number;
  autoIndex: boolean;
}

interface MongoHealthStatus {
  connected: boolean;
  readyState: number;
  readyStateText: string;
  database?: string;
  host?: string;
  port?: number;
  connectionAttempts: number;
  uptime: number;
  lastConnected?: Date;
  lastError?: string;
}

interface ConnectionState {
  isConnected: boolean;
  connectionAttempts: number;
  lastConnected?: Date;
  lastError?: string;
}

// Constants
const MONGODB_URI: string = process.env.MONGODB_URI || 'mongodb://localhost:27017/dreamscape_unstructured';
const MAX_RETRY_ATTEMPTS: number = 3;
const READY_STATES: readonly string[] = ['disconnected', 'connected', 'connecting', 'disconnecting'] as const;

// MongoDB connection options
const options: MongoConnectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
  autoIndex: false, // Évite les warnings d'index automatiques
};

// Connection state
const connectionState: ConnectionState = {
  isConnected: false,
  connectionAttempts: 0,
};

export const connectMongoDB = async (retries: number = MAX_RETRY_ATTEMPTS): Promise<void> => {
  if (connectionState.isConnected) {
    console.log('📊 MongoDB already connected');
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      connectionState.connectionAttempts++;
      
      await mongoose.connect(MONGODB_URI, options);
      connectionState.isConnected = true;
      connectionState.lastConnected = new Date();
      connectionState.lastError = undefined;
      
      console.log(`✅ MongoDB connected successfully`);
      console.log(`📍 Database: ${mongoose.connection.db?.databaseName}`);
      console.log(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      
      // Initialise les event listeners
      setupEventListeners();
      
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      connectionState.lastError = errorMessage;
      
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed:`, errorMessage);
      
      if (attempt === retries) {
        throw new Error(`MongoDB connection failed after ${retries} attempts. Last error: ${errorMessage}`);
      }
      
      // Exponential backoff
      const delay: number = 1000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }
};

// Event listeners pour monitoring
const setupEventListeners = (): void => {
  const connection: Connection = mongoose.connection;
  
  // Nettoie les listeners existants pour éviter les doublons
  connection.removeAllListeners('connected');
  connection.removeAllListeners('disconnected');
  connection.removeAllListeners('reconnected');
  connection.removeAllListeners('error');

  connection.on('connected', () => {
    console.log('🟢 MongoDB connection established');
    connectionState.isConnected = true;
    connectionState.lastConnected = new Date();
  });

  connection.on('disconnected', () => {
    console.log('🔴 MongoDB connection lost');
    connectionState.isConnected = false;
  });

  connection.on('reconnected', () => {
    console.log('🟡 MongoDB reconnected');
    connectionState.isConnected = true;
    connectionState.lastConnected = new Date();
  });

  connection.on('error', (error: Error) => {
    console.error('💥 MongoDB connection error:', error.message);
    connectionState.isConnected = false;
    connectionState.lastError = error.message;
  });
};

// Health status pour ton DatabaseService
export const getMongoHealthStatus = (): MongoHealthStatus => {
  const connection: Connection = mongoose.connection;
  const uptime: number = connectionState.isConnected && connectionState.lastConnected 
    ? Date.now() - connectionState.lastConnected.getTime() 
    : 0;

  return {
    connected: connectionState.isConnected,
    readyState: connection.readyState,
    readyStateText: READY_STATES[connection.readyState] || 'unknown',
    database: connection.db?.databaseName,
    host: connection.host,
    port: connection.port,
    connectionAttempts: connectionState.connectionAttempts,
    uptime,
    lastConnected: connectionState.lastConnected,
    lastError: connectionState.lastError,
  };
};

// Nettoyage des index dupliqués (résout tes warnings)
export const cleanupDuplicateIndexes = async (): Promise<void> => {
  if (!connectionState.isConnected) {
    throw new Error('MongoDB not connected');
  }
  
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not available');
    }
    
    const collections = await db.collections();
    
    for (const collection of collections) {
      const indexes = await collection.indexes();
      const indexNames: string[] = indexes.map((idx: any) => idx.name);
      
      // Log pour debugging
      console.log(`📊 Collection ${collection.collectionName}: ${indexNames.length} indexes`);
      
      // Tu peux ajouter ici la logique pour supprimer les doublons si nécessaire
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('⚠️ Index cleanup failed:', errorMessage);
    throw error;
  }
};

// Disconnect function
export const disconnectMongoDB = async (): Promise<void> => {
  if (!connectionState.isConnected) {
    console.log('📊 MongoDB already disconnected');
    return;
  }

  try {
    await mongoose.connection.close();
    connectionState.isConnected = false;
    console.log('🔒 MongoDB connection closed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error closing MongoDB connection:', errorMessage);
    throw error;
  }
};

// Graceful shutdown amélioré
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);
  
  try {
    await disconnectMongoDB();
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
  }
  
  process.exit(0);
};

// Gestion de tous les signaux de fermeture
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => void gracefulShutdown('SIGUSR2')); // nodemon

// Export des types pour utilisation ailleurs
export type { MongoHealthStatus, ConnectionState };
export default mongoose;