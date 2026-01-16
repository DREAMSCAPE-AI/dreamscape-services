/**
 * Payment Routes
 * API endpoints for payment processing
 */

import { Router, Request, Response } from 'express';
import type { CreatePaymentIntentRequest, RefundRequest } from '../types/payment';
import paymentService from '../services/PaymentService';
import webhookService from '../services/WebhookService';

const router = Router();

/**
 * POST /api/v1/payment/create-intent
 * Create a Stripe Payment Intent for a booking
 *
 * Request body:
 * {
 *   amount: number (in cents),
 *   currency: string,
 *   bookingId: string,
 *   bookingReference: string,
 *   userId: string,
 *   metadata?: object
 * }
 */
router.post('/create-intent', async (req: Request, res: Response): Promise<void> => {
  try {
    const request: CreatePaymentIntentRequest = req.body;

    // Validate request
    if (!request.amount || !request.currency || !request.bookingId || !request.bookingReference || !request.userId) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['amount', 'currency', 'bookingId', 'bookingReference', 'userId'],
      });
      return;
    }

    // Validate amount
    if (request.amount <= 0) {
      res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be greater than 0',
      });
      return;
    }

    // Create payment intent
    const paymentIntent = await paymentService.createPaymentIntent(request);

    res.status(200).json({
      success: true,
      data: paymentIntent,
    });
  } catch (error) {
    console.error('[PaymentRoutes] Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/payment/config
 * Get Stripe publishable key for frontend
 */
router.get('/config', (req: Request, res: Response): void => {
  try {
    const publishableKey = paymentService.getPublishableKey();

    res.status(200).json({
      success: true,
      data: {
        publishableKey,
      },
    });
  } catch (error) {
    console.error('[PaymentRoutes] Error getting config:', error);
    res.status(500).json({
      error: 'Failed to get payment config',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/payment/webhook
 * Stripe webhook endpoint
 *
 * IMPORTANT: This endpoint must receive the RAW body (not parsed JSON)
 * The signature verification requires the raw request body
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      res.status(400).json({
        error: 'Missing stripe-signature header',
      });
      return;
    }

    // Get raw body as Buffer (set by express.raw() middleware)
    const payload = req.body;

    if (!Buffer.isBuffer(payload)) {
      res.status(400).json({
        error: 'Invalid request body',
        message: 'Webhook endpoint expects raw body',
      });
      return;
    }

    // Process webhook
    const result = await webhookService.processWebhook(payload, signature as string);

    if (result.success) {
      res.status(200).json({ received: true });
    } else {
      res.status(400).json({
        error: result.message,
        details: result.error,
      });
    }
  } catch (error) {
    console.error('[PaymentRoutes] Webhook error:', error);
    res.status(400).json({
      error: 'Webhook handler failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/payment/refund
 * Process a refund for a payment
 *
 * Request body:
 * {
 *   paymentIntentId: string,
 *   amount?: number (optional, full refund if not specified),
 *   reason?: string,
 *   bookingId: string,
 *   userId: string
 * }
 */
router.post('/refund', async (req: Request, res: Response): Promise<void> => {
  try {
    const request: RefundRequest = req.body;

    // Validate request
    if (!request.paymentIntentId || !request.bookingId || !request.userId) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['paymentIntentId', 'bookingId', 'userId'],
      });
      return;
    }

    // Process refund
    const refund = await paymentService.processRefund(request);

    res.status(200).json({
      success: true,
      data: refund,
    });
  } catch (error) {
    console.error('[PaymentRoutes] Error processing refund:', error);
    res.status(500).json({
      error: 'Failed to process refund',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/payment/cancel/:paymentIntentId
 * Cancel a payment intent
 */
router.post('/cancel/:paymentIntentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
      res.status(400).json({
        error: 'Missing payment intent ID',
      });
      return;
    }

    await paymentService.cancelPaymentIntent(paymentIntentId);

    res.status(200).json({
      success: true,
      message: 'Payment intent canceled successfully',
    });
  } catch (error) {
    console.error('[PaymentRoutes] Error canceling payment intent:', error);
    res.status(500).json({
      error: 'Failed to cancel payment intent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
