/**
 * Database Service - Handles database operations for payment service
 * Uses Prisma Client for PostgreSQL operations
 */

import { PrismaClient, PaymentTransactionStatus } from '@dreamscape/db';
import type Stripe from 'stripe';

interface CreateTransactionData {
  paymentIntentId: string;
  bookingId: string;
  bookingReference: string;
  userId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

interface UpdateTransactionData {
  status?: PaymentTransactionStatus;
  paymentMethod?: string;
  stripeCustomerId?: string;
  confirmedAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
  failureReason?: string;
}

class DatabaseService {
  private prisma: PrismaClient;
  private isInitialized = false;

  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[DatabaseService] Already initialized');
      return;
    }

    try {
      await this.prisma.$connect();
      this.isInitialized = true;
      console.log('✅ [DatabaseService] Database connected');
    } catch (error) {
      console.error('❌ [DatabaseService] Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Shutdown database connection
   */
  async shutdown(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.isInitialized = false;
      console.log('[DatabaseService] Database disconnected');
    }
  }

  // ========== IDEMPOTENCE - WEBHOOK EVENT TRACKING ==========

  /**
   * Check if a webhook event has already been processed
   * @param eventId Stripe event ID
   * @returns true if event was already processed
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const event = await this.prisma.processedWebhookEvent.findUnique({
      where: { eventId },
    });

    return event !== null;
  }

  /**
   * Mark a webhook event as processed
   * @param eventId Stripe event ID
   * @param eventType Stripe event type
   * @param payload Optional event payload for debugging
   */
  async markEventAsProcessed(
    eventId: string,
    eventType: string,
    payload?: Record<string, any>
  ): Promise<void> {
    try {
      await this.prisma.processedWebhookEvent.create({
        data: {
          eventId,
          eventType,
          processed: true,
          payload: payload || {},
        },
      });

      console.log(`[DatabaseService] Marked event ${eventId} as processed`);
    } catch (error) {
      // If unique constraint fails, event was already processed (race condition)
      if ((error as any).code === 'P2002') {
        console.log(`[DatabaseService] Event ${eventId} was already marked as processed`);
        return;
      }
      throw error;
    }
  }

  // ========== PAYMENT TRANSACTIONS ==========

  /**
   * Create a new payment transaction record
   */
  async createTransaction(data: CreateTransactionData): Promise<void> {
    try {
      await this.prisma.paymentTransaction.create({
        data: {
          paymentIntentId: data.paymentIntentId,
          bookingId: data.bookingId,
          bookingReference: data.bookingReference,
          userId: data.userId,
          amount: data.amount,
          currency: data.currency,
          status: PaymentTransactionStatus.PENDING,
          metadata: data.metadata || {},
        },
      });

      console.log(`[DatabaseService] Created transaction record for ${data.paymentIntentId}`);
    } catch (error) {
      console.error('[DatabaseService] Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Update a payment transaction
   */
  async updateTransaction(
    paymentIntentId: string,
    updates: UpdateTransactionData
  ): Promise<void> {
    try {
      await this.prisma.paymentTransaction.update({
        where: { paymentIntentId },
        data: updates,
      });

      console.log(`[DatabaseService] Updated transaction ${paymentIntentId}`);
    } catch (error) {
      console.error(`[DatabaseService] Error updating transaction ${paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Get a payment transaction by payment intent ID
   */
  async getTransactionByPaymentIntent(paymentIntentId: string) {
    return await this.prisma.paymentTransaction.findUnique({
      where: { paymentIntentId },
    });
  }

  /**
   * Get all transactions for a booking
   */
  async getTransactionsByBooking(bookingId: string) {
    return await this.prisma.paymentTransaction.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all transactions for a user
   */
  async getTransactionsByUser(userId: string) {
    return await this.prisma.paymentTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Health check - verify database connection
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      if (!this.isInitialized) {
        return {
          healthy: false,
          details: { error: 'Database not initialized' },
        };
      }

      // Simple query to check connection
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        healthy: true,
        details: { connected: true },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
