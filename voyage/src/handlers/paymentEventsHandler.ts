/**
 * Payment Events Handler for Voyage Service
 * DR-391: Saga Pattern - Handles payment events to confirm/cancel bookings
 */

import {
  type MessageHandler,
  type PaymentCompletedPayload,
  type PaymentFailedPayload,
} from '@dreamscape/kafka';
import { PrismaClient, BookingStatus } from '@prisma/client';
import voyageKafkaService from '@/services/KafkaService';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `${process.env.DATABASE_URL}?schema=voyage`,
    },
  },
});

/**
 * Handle payment.completed event
 * Confirms booking after successful payment (DR-393)
 */
export const handlePaymentCompleted: MessageHandler<PaymentCompletedPayload> = async ({
  event,
  message,
}) => {
  const { paymentId, bookingId, userId, amount, currency, method, metadata, completedAt } = event.payload;

  console.log(`[Voyage] Payment completed: ${paymentId} for booking ${bookingId}`);

  try {
    // Find booking by reference (bookingId from payment)
    const booking = await prisma.bookingData.findUnique({
      where: { reference: bookingId },
    });

    if (!booking) {
      console.error(`[Voyage] Booking not found: ${bookingId}`);
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Verify booking belongs to user
    if (booking.userId !== userId) {
      console.error(`[Voyage] User mismatch: booking ${bookingId} belongs to ${booking.userId}, not ${userId}`);
      throw new Error(`User ${userId} is not authorized for booking ${bookingId}`);
    }

    // Check if booking is in pending status
    if (booking.status !== BookingStatus.PENDING) {
      console.warn(`[Voyage] Booking ${bookingId} is not in PENDING status (current: ${booking.status})`);
      // Idempotency: If already confirmed, don't fail
      if (booking.status === BookingStatus.CONFIRMED) {
        console.log(`[Voyage] Booking ${bookingId} already confirmed, skipping`);
        return;
      }
      throw new Error(`Booking ${bookingId} cannot be confirmed (status: ${booking.status})`);
    }

    // Update booking status to CONFIRMED
    const updatedBooking = await prisma.bookingData.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ [Voyage] Booking ${bookingId} confirmed successfully`);

    // Publish voyage.booking.confirmed event
    try {
      await voyageKafkaService.publishBookingConfirmed(
        {
          bookingId: booking.reference,
          userId: booking.userId,
          bookingType: booking.type,
          status: 'confirmed',
          totalAmount: Number(booking.totalAmount),
          currency: booking.currency,
          paymentId,
          confirmedAt: updatedBooking.updatedAt.toISOString(),
        },
        event.metadata?.correlationId
      );
      console.log(`📤 [Voyage] Published booking.confirmed event for ${bookingId}`);
    } catch (publishError) {
      console.error(`⚠️ [Voyage] Failed to publish booking.confirmed event:`, publishError);
      // Don't throw - booking is confirmed in DB, event publishing is best-effort
    }

  } catch (error) {
    console.error(`❌ [Voyage] Failed to process payment.completed for ${bookingId}:`, error);
    throw error; // Re-throw for Kafka retry
  }
};

/**
 * Handle payment.failed event
 * Cancels booking after failed payment (DR-394)
 */
export const handlePaymentFailed: MessageHandler<PaymentFailedPayload> = async ({
  event,
  message,
}) => {
  const { paymentId, bookingId, userId, errorCode, errorMessage, failedAt } = event.payload;

  console.log(`[Voyage] Payment failed: ${paymentId} for booking ${bookingId} - ${errorMessage}`);

  try {
    // Find booking by reference
    const booking = await prisma.bookingData.findUnique({
      where: { reference: bookingId },
    });

    if (!booking) {
      console.error(`[Voyage] Booking not found: ${bookingId}`);
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Verify booking belongs to user
    if (booking.userId !== userId) {
      console.error(`[Voyage] User mismatch: booking ${bookingId} belongs to ${booking.userId}, not ${userId}`);
      throw new Error(`User ${userId} is not authorized for booking ${bookingId}`);
    }

    // Check if booking is in pending status
    if (booking.status !== BookingStatus.PENDING) {
      console.warn(`[Voyage] Booking ${bookingId} is not in PENDING status (current: ${booking.status})`);
      // Idempotency: If already cancelled, don't fail
      if (booking.status === BookingStatus.CANCELLED) {
        console.log(`[Voyage] Booking ${bookingId} already cancelled, skipping`);
        return;
      }
      // If confirmed, this is a problem - payment shouldn't fail after confirmation
      if (booking.status === BookingStatus.CONFIRMED) {
        console.error(`[Voyage] Payment failed but booking ${bookingId} is already CONFIRMED - manual intervention required`);
        throw new Error(`Inconsistent state: booking ${bookingId} is confirmed but payment failed`);
      }
    }

    // Update booking status to CANCELLED
    const updatedBooking = await prisma.bookingData.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ [Voyage] Booking ${bookingId} cancelled successfully`);

    // Publish voyage.booking.cancelled event
    try {
      await voyageKafkaService.publishBookingCancelled(
        {
          bookingId: booking.reference,
          userId: booking.userId,
          reason: `payment_failed: ${errorCode} - ${errorMessage}`,
          cancelledAt: updatedBooking.updatedAt.toISOString(),
        },
        event.metadata?.correlationId
      );
      console.log(`📤 [Voyage] Published booking.cancelled event for ${bookingId}`);
    } catch (publishError) {
      console.error(`⚠️ [Voyage] Failed to publish booking.cancelled event:`, publishError);
      // Don't throw - booking is cancelled in DB, event publishing is best-effort
    }

  } catch (error) {
    console.error(`❌ [Voyage] Failed to process payment.failed for ${bookingId}:`, error);
    throw error; // Re-throw for Kafka retry
  }
};
