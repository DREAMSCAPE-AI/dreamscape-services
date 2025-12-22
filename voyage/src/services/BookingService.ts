/**
 * Booking Service - Gestion des réservations
 * - Create booking from cart
 * - Update booking status
 * - Handle payment confirmation
 */

import type { BookingData } from '@prisma/client';
import prisma from '../database/prisma';
import CartService from './CartService';
import { Decimal } from '@prisma/client/runtime/library';
import voyageKafkaService from './KafkaService';
import type { VoyageBookingCreatedPayload, VoyageBookingConfirmedPayload } from '@dreamscape/kafka';

// Booking status types (matching Prisma enum)
type BookingStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'FAILED';
type BookingType = 'FLIGHT' | 'HOTEL' | 'ACTIVITY' | 'PACKAGE';

interface CreateBookingFromCartDTO {
  userId: string;
  paymentIntentId: string;
  metadata?: Record<string, any>;
}

interface BookingReference {
  reference: string;
  bookingId: string;
}

export class BookingService {
  /**
   * Generate unique booking reference
   * Format: BOOK-YYYYMMDD-XXXXX
   */
  private generateBookingReference(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();

    return `BOOK-${year}${month}${day}-${random}`;
  }

  /**
   * Determine booking type from cart items
   */
  private determineBookingType(items: any[]): BookingType {
    if (items.length === 1) {
      const itemType = items[0].type;
      if (itemType === 'FLIGHT') return BookingType.FLIGHT;
      if (itemType === 'HOTEL') return BookingType.HOTEL;
      if (itemType === 'ACTIVITY') return BookingType.ACTIVITY;
    }

    // Multiple items = package booking
    return BookingType.PACKAGE;
  }

  /**
   * Create booking from cart (DRAFT status)
   * Called from checkout endpoint
   */
  async createBookingFromCart(data: CreateBookingFromCartDTO): Promise<BookingData> {
    try {
      const { userId, paymentIntentId, metadata } = data;

      // Get user's cart
      const cart = await CartService.getCart(userId);

      if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty or not found');
      }

      // Generate unique booking reference
      const reference = this.generateBookingReference();

      // Determine booking type
      const bookingType = this.determineBookingType(cart.items);

      // Prepare booking data
      const bookingData = {
        userId,
        type: bookingType,
        reference,
        status: BookingStatus.DRAFT,
        paymentIntentId,
        totalAmount: cart.totalPrice,
        currency: cart.currency,
        data: {
          cartId: cart.id,
          items: cart.items.map((item) => ({
            type: item.type,
            itemId: item.itemId,
            itemData: item.itemData,
            quantity: item.quantity,
            price: Number(item.price),
            currency: item.currency,
          })),
          metadata: metadata || {},
          createdFrom: 'cart',
        },
      };

      // Create booking in database
      const booking = await prisma.bookingData.create({
        data: bookingData,
      });

      console.log(`[BookingService] Created DRAFT booking ${reference} for user ${userId}`);

      // Publish booking.created Kafka event
      try {
        const kafkaPayload: VoyageBookingCreatedPayload = {
          bookingId: booking.id,
          bookingReference: reference,
          userId,
          type: bookingType,
          status: 'DRAFT',
          totalAmount: Number(booking.totalAmount),
          currency: booking.currency,
          items: cart.items.map((item) => ({
            type: item.type,
            itemId: item.itemId,
            quantity: item.quantity,
            price: Number(item.price),
            currency: item.currency,
          })),
          paymentIntentId,
          createdAt: booking.createdAt.toISOString(),
        };

        await voyageKafkaService.publishBookingCreated(kafkaPayload);
        console.log(`📨 [BookingService] Published booking.created event for ${reference}`);
      } catch (kafkaError) {
        // Log error but don't fail the booking creation
        console.error(`⚠️ [BookingService] Failed to publish booking.created event for ${reference}:`, kafkaError);
      }

      return booking;
    } catch (error) {
      console.error('[BookingService] Error creating booking from cart:', error);
      throw error;
    }
  }

  /**
   * Update booking status to PENDING_PAYMENT
   * Called when payment is initiated
   */
  async updateBookingToPendingPayment(reference: string): Promise<BookingData> {
    try {
      const booking = await prisma.bookingData.update({
        where: { reference },
        data: {
          status: BookingStatus.PENDING_PAYMENT,
          updatedAt: new Date(),
        },
      });

      console.log(`[BookingService] Updated booking ${reference} to PENDING_PAYMENT`);

      return booking;
    } catch (error) {
      console.error(`[BookingService] Error updating booking ${reference} to PENDING_PAYMENT:`, error);
      throw error;
    }
  }

  /**
   * Confirm booking after successful payment
   * Called from payment.completed Kafka consumer
   */
  async confirmBooking(reference: string, userId: string): Promise<BookingData> {
    try {
      // Find booking
      const booking = await prisma.bookingData.findUnique({
        where: { reference },
      });

      if (!booking) {
        throw new Error(`Booking ${reference} not found`);
      }

      // Verify user owns this booking
      if (booking.userId !== userId) {
        throw new Error(`User ${userId} is not authorized for booking ${reference}`);
      }

      // Check if booking can be confirmed
      if (booking.status === BookingStatus.CONFIRMED) {
        console.log(`[BookingService] Booking ${reference} already confirmed (idempotency)`);
        return booking;
      }

      if (booking.status !== BookingStatus.PENDING_PAYMENT && booking.status !== BookingStatus.DRAFT) {
        throw new Error(`Booking ${reference} cannot be confirmed (current status: ${booking.status})`);
      }

      // Update booking to CONFIRMED
      const updatedBooking = await prisma.bookingData.update({
        where: { reference },
        data: {
          status: BookingStatus.CONFIRMED,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log(`✅ [BookingService] Booking ${reference} confirmed successfully`);

      // Publish booking.confirmed Kafka event
      try {
        const bookingDataPayload = updatedBooking.data as any;
        const kafkaPayload: VoyageBookingConfirmedPayload = {
          bookingId: updatedBooking.id,
          bookingReference: reference,
          userId,
          type: updatedBooking.type as any,
          totalAmount: Number(updatedBooking.totalAmount),
          currency: updatedBooking.currency,
          items: bookingDataPayload.items || [],
          confirmedAt: updatedBooking.confirmedAt?.toISOString() || new Date().toISOString(),
        };

        await voyageKafkaService.publishBookingConfirmed(kafkaPayload);
        console.log(`📨 [BookingService] Published booking.confirmed event for ${reference}`);
      } catch (kafkaError) {
        // Log error but don't fail the confirmation
        console.error(`⚠️ [BookingService] Failed to publish booking.confirmed event for ${reference}:`, kafkaError);
      }

      // Clear user's cart
      try {
        await CartService.clearCart(userId);
        console.log(`🛒 [BookingService] Cart cleared for user ${userId} after booking confirmation`);
      } catch (cartError) {
        console.error(`⚠️ [BookingService] Failed to clear cart for user ${userId}:`, cartError);
        // Don't throw - booking is confirmed, cart clearing is best-effort
      }

      return updatedBooking;
    } catch (error) {
      console.error(`[BookingService] Error confirming booking ${reference}:`, error);
      throw error;
    }
  }

  /**
   * Fail booking after payment failure
   * Called from payment.failed Kafka consumer
   */
  async failBooking(reference: string, userId: string, reason: string): Promise<BookingData> {
    try {
      // Find booking
      const booking = await prisma.bookingData.findUnique({
        where: { reference },
      });

      if (!booking) {
        throw new Error(`Booking ${reference} not found`);
      }

      // Verify user owns this booking
      if (booking.userId !== userId) {
        throw new Error(`User ${userId} is not authorized for booking ${reference}`);
      }

      // Check if booking is already failed
      if (booking.status === BookingStatus.FAILED) {
        console.log(`[BookingService] Booking ${reference} already failed (idempotency)`);
        return booking;
      }

      // Update booking to FAILED
      const updatedBooking = await prisma.bookingData.update({
        where: { reference },
        data: {
          status: BookingStatus.FAILED,
          data: {
            ...(booking.data as object),
            failureReason: reason,
            failedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        },
      });

      console.log(`❌ [BookingService] Booking ${reference} marked as FAILED: ${reason}`);

      // Note: We don't clear the cart here - user might want to retry payment

      return updatedBooking;
    } catch (error) {
      console.error(`[BookingService] Error failing booking ${reference}:`, error);
      throw error;
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(reference: string, userId: string, reason?: string): Promise<BookingData> {
    try {
      // Find booking
      const booking = await prisma.bookingData.findUnique({
        where: { reference },
      });

      if (!booking) {
        throw new Error(`Booking ${reference} not found`);
      }

      // Verify user owns this booking
      if (booking.userId !== userId) {
        throw new Error(`User ${userId} is not authorized for booking ${reference}`);
      }

      // Check if booking is already cancelled
      if (booking.status === BookingStatus.CANCELLED) {
        console.log(`[BookingService] Booking ${reference} already cancelled (idempotency)`);
        return booking;
      }

      // Update booking to CANCELLED
      const updatedBooking = await prisma.bookingData.update({
        where: { reference },
        data: {
          status: BookingStatus.CANCELLED,
          data: {
            ...(booking.data as object),
            cancellationReason: reason || 'User cancelled',
            cancelledAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        },
      });

      console.log(`🚫 [BookingService] Booking ${reference} cancelled: ${reason || 'User cancelled'}`);

      return updatedBooking;
    } catch (error) {
      console.error(`[BookingService] Error cancelling booking ${reference}:`, error);
      throw error;
    }
  }

  /**
   * Get booking by reference
   */
  async getBooking(reference: string): Promise<BookingData | null> {
    try {
      const booking = await prisma.bookingData.findUnique({
        where: { reference },
      });

      return booking;
    } catch (error) {
      console.error(`[BookingService] Error getting booking ${reference}:`, error);
      throw error;
    }
  }

  /**
   * Get user's bookings
   */
  async getUserBookings(userId: string, status?: BookingStatus): Promise<BookingData[]> {
    try {
      const bookings = await prisma.bookingData.findMany({
        where: {
          userId,
          ...(status ? { status } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return bookings;
    } catch (error) {
      console.error(`[BookingService] Error getting bookings for user ${userId}:`, error);
      throw error;
    }
  }
}

export default new BookingService();
