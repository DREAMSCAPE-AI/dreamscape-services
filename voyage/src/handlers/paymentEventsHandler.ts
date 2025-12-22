/**
 * Payment Events Handler for Voyage Service
 * DR-391: Saga Pattern - Handles payment events to confirm/cancel bookings
 * DR-505: Cart flow - Create booking from cart after payment confirmation
 */

import {
  type MessageHandler,
  type PaymentCompletedPayload,
  type PaymentFailedPayload,
} from '@dreamscape/kafka';
import prisma from '@/database/prisma';
import voyageKafkaService from '@/services/KafkaService';
import BookingService from '@/services/BookingService';

// Booking status types (matching Prisma enum)
type BookingStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'FAILED';

/**
 * Handle payment.completed event
 * Confirms booking after successful payment (DR-393 + DR-505)
 * - Confirms booking status
 * - Clears user's cart
 */
export const handlePaymentCompleted: MessageHandler<PaymentCompletedPayload> = async ({
  event,
  message,
}) => {
  const { paymentId, bookingId, userId, amount, currency, method, metadata, completedAt } = event.payload;

  console.log(`[Voyage] Payment completed: ${paymentId} for booking ${bookingId}`);

  try {
    // Use BookingService to confirm booking and clear cart
    const updatedBooking = await BookingService.confirmBooking(bookingId, userId);

    console.log(`✅ [Voyage] Booking ${bookingId} confirmed successfully`);

    // Publish voyage.booking.confirmed event
    try {
      await voyageKafkaService.publishBookingConfirmed(
        {
          bookingId: updatedBooking.reference,
          userId: updatedBooking.userId,
          bookingType: updatedBooking.type,
          status: 'confirmed',
          totalAmount: Number(updatedBooking.totalAmount),
          currency: updatedBooking.currency,
          paymentId,
          confirmedAt: updatedBooking.confirmedAt?.toISOString() || new Date().toISOString(),
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
 * Marks booking as FAILED after payment failure (DR-394 + DR-505)
 * Note: Cart is NOT cleared - user can retry payment
 */
export const handlePaymentFailed: MessageHandler<PaymentFailedPayload> = async ({
  event,
  message,
}) => {
  const { paymentId, bookingId, userId, errorCode, errorMessage, failedAt } = event.payload;

  console.log(`[Voyage] Payment failed: ${paymentId} for booking ${bookingId} - ${errorMessage}`);

  try {
    // Use BookingService to mark booking as failed
    const reason = `payment_failed: ${errorCode || 'UNKNOWN'} - ${errorMessage || 'Payment processing failed'}`;
    const updatedBooking = await BookingService.failBooking(bookingId, userId, reason);

    console.log(`❌ [Voyage] Booking ${bookingId} marked as FAILED`);

    // Publish voyage.booking.cancelled event (for failed payment)
    try {
      await voyageKafkaService.publishBookingCancelled(
        {
          bookingId: updatedBooking.reference,
          userId: updatedBooking.userId,
          reason,
          cancelledAt: updatedBooking.updatedAt.toISOString(),
        },
        event.metadata?.correlationId
      );
      console.log(`📤 [Voyage] Published booking.cancelled event for ${bookingId}`);
    } catch (publishError) {
      console.error(`⚠️ [Voyage] Failed to publish booking.cancelled event:`, publishError);
      // Don't throw - booking is failed in DB, event publishing is best-effort
    }

  } catch (error) {
    console.error(`❌ [Voyage] Failed to process payment.failed for ${bookingId}:`, error);
    throw error; // Re-throw for Kafka retry
  }
};
