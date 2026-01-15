/**
 * Cart Routes - RESTful API for shopping cart management
 * - Add items to cart
 * - Get cart for user
 * - Update cart item quantity
 * - Remove cart item
 * - Clear cart
 * - Checkout and create booking
 */

import { Router, Request, Response } from 'express';
import CartService from '@/services/CartService';
import BookingService from '@/services/BookingService';

// Cart item types (matching Prisma enum)
type CartItemType = 'FLIGHT' | 'HOTEL' | 'ACTIVITY';

const router = Router();

interface BookingDataPayload {
  cartId: string;
  items: Array<{
    type: string;
    itemId: string;
    itemData: unknown;
    quantity: number;
    price: number;
    currency: string;
  }>;
  metadata?: Record<string, unknown>;
  createdFrom: string;
}

/**
 * GET /api/v1/cart
 * Get user's cart with all items
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Replace with actual user ID from JWT token after auth integration
    const userId = (req as any).user?.id || req.query.userId as string;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const cart = await CartService.getCart(userId);

    if (!cart) {
      res.json({
        data: null,
        meta: {
          message: 'No active cart found'
        }
      });
      return;
    }

    res.json({
      data: cart,
      meta: {
        itemCount: cart.items.length,
        expiresAt: cart.expiresAt
      }
    });
  } catch (error) {
    console.error('[CartRoutes] GET /cart error:', error);
    res.status(500).json({
      error: 'Failed to get cart',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/cart/items
 * Add item to cart
 * Body: { type, itemId, itemData, price, quantity?, currency? }
 */
router.post('/items', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Replace with actual user ID from JWT token after auth integration
    const userId = (req as any).user?.id || req.body.userId;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const { type, itemId, itemData, price, quantity = 1, currency = 'EUR' } = req.body;

    // Validate required fields
    if (!type || !itemId || !itemData || price === undefined) {
      res.status(400).json({
        error: 'Missing required fields: type, itemId, itemData, price'
      });
      return;
    }

    // Validate cart item type
    const validTypes: CartItemType[] = ['FLIGHT', 'HOTEL', 'ACTIVITY'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        error: `Invalid item type. Must be one of: ${validTypes.join(', ')}`
      });
      return;
    }

    // Validate price is a positive number
    if (typeof price !== 'number' || price <= 0) {
      res.status(400).json({
        error: 'Price must be a positive number'
      });
      return;
    }

    // Validate quantity is a positive integer
    if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      res.status(400).json({
        error: 'Quantity must be a positive integer'
      });
      return;
    }

    const cart = await CartService.addToCart({
      userId,
      type,
      itemId,
      itemData,
      price,
      quantity,
      currency
    });

    res.status(201).json({
      data: cart,
      meta: {
        itemCount: cart.items.length,
        totalPrice: cart.totalPrice,
        expiresAt: cart.expiresAt,
        message: 'Item added to cart successfully'
      }
    });
  } catch (error) {
    console.error('[CartRoutes] POST /cart/items error:', error);
    res.status(500).json({
      error: 'Failed to add item to cart',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/v1/cart/items/:itemId
 * Update cart item quantity
 * Body: { quantity }
 */
router.put('/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Replace with actual user ID from JWT token after auth integration
    const userId = (req as any).user?.id || req.body.userId;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!itemId) {
      res.status(400).json({
        error: 'Missing item ID'
      });
      return;
    }

    if (quantity === undefined || typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      res.status(400).json({
        error: 'Quantity must be a positive integer'
      });
      return;
    }

    const cart = await CartService.updateCartItem(userId, itemId, { quantity });

    res.json({
      data: cart,
      meta: {
        itemCount: cart.items.length,
        totalPrice: cart.totalPrice,
        message: 'Cart item updated successfully'
      }
    });
  } catch (error) {
    console.error('[CartRoutes] PUT /cart/items/:itemId error:', error);

    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      error: 'Failed to update cart item',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/v1/cart/items/:itemId
 * Remove item from cart
 */
router.delete('/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Replace with actual user ID from JWT token after auth integration
    const userId = (req as any).user?.id || req.query.userId as string;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const { itemId } = req.params;

    if (!itemId) {
      res.status(400).json({
        error: 'Missing item ID'
      });
      return;
    }

    const cart = await CartService.removeCartItem(userId, itemId);

    res.json({
      data: cart,
      meta: {
        itemCount: cart.items.length,
        totalPrice: cart.totalPrice,
        message: 'Item removed from cart successfully'
      }
    });
  } catch (error) {
    console.error('[CartRoutes] DELETE /cart/items/:itemId error:', error);

    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      error: 'Failed to remove cart item',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/v1/cart
 * Clear entire cart
 */
router.delete('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Replace with actual user ID from JWT token after auth integration
    const userId = (req as any).user?.id || req.query.userId as string;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    await CartService.clearCart(userId);

    res.json({
      data: null,
      meta: {
        message: 'Cart cleared successfully'
      }
    });
  } catch (error) {
    console.error('[CartRoutes] DELETE /cart error:', error);
    res.status(500).json({
      error: 'Failed to clear cart',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/cart/checkout
 * Validate cart and prepare for payment
 * - Validates all items are still available
 * - Creates a DRAFT booking with paymentIntentId
 * - Returns booking reference and payment details
 */
router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Replace with actual user ID from JWT token after auth integration
    const userId = (req as any).user?.id || req.body.userId;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const cart = await CartService.getCart(userId);

    if (!cart || cart.items.length === 0) {
      res.status(400).json({
        error: 'Cart is empty or not found'
      });
      return;
    }

    // TODO: Phase 3 - Implement availability validation
    // - Check flight availability with Amadeus API
    // - Check hotel availability with Amadeus API
    // - Check activity availability (when implemented)
    // - Return 409 Conflict if any item is no longer available

    // Step 1: Create Stripe Payment Intent via Payment Service
    const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';

    let paymentIntent: {
      paymentIntentId: string;
      clientSecret: string;
      amount: number;
      currency: string;
      status: string;
    };

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const paymentResponse = await fetch(`${PAYMENT_SERVICE_URL}/api/v1/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(Number(cart.totalPrice) * 100), // Convert to cents
          currency: cart.currency.toLowerCase(),
          bookingId: 'temp', // Will be updated after booking creation
          bookingReference: 'temp', // Will be updated after booking creation
          userId,
          metadata: req.body.metadata || {},
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!paymentResponse.ok) {
        throw new Error(`Payment service error: ${paymentResponse.statusText}`);
      }

      const paymentData = await paymentResponse.json() as { success: boolean; data: typeof paymentIntent };
      paymentIntent = paymentData.data;

      console.log(`✅ [CartRoutes] Payment Intent created: ${paymentIntent.paymentIntentId}`);
    } catch (paymentError: any) {
      console.error('[CartRoutes] Failed to create payment intent:', paymentError);

      // Check if it's a timeout/connection error
      const isConnectionError = paymentError.name === 'AbortError' ||
                                paymentError.code === 'ECONNREFUSED' ||
                                paymentError.cause?.code === 'ECONNREFUSED';

      res.status(503).json({
        error: 'Failed to initialize payment',
        message: isConnectionError
          ? 'Payment service is not available. Please ensure the payment service is running on port 3004.'
          : (paymentError instanceof Error ? paymentError.message : 'Payment service unavailable')
      });
      return;
    }

    // Step 2: Create DRAFT booking with real Payment Intent ID
    const booking = await BookingService.createBookingFromCart({
      userId,
      paymentIntentId: paymentIntent.paymentIntentId,
      metadata: req.body.metadata || {},
    });

    console.log(`✅ [CartRoutes] Booking created: ${booking.reference} with Payment Intent: ${paymentIntent.paymentIntentId}`);

    const bookingData = booking.data as unknown as BookingDataPayload;

    res.json({
      data: {
        bookingReference: booking.reference,
        bookingId: booking.id,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        items: bookingData.items,
        status: booking.status,
        createdAt: booking.createdAt,
        // Payment details from Stripe
        payment: {
          clientSecret: paymentIntent.clientSecret,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
          paymentIntentId: paymentIntent.paymentIntentId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency
        }
      },
      meta: {
        message: 'Booking created successfully. Ready for payment.',
        nextSteps: [
          'Complete payment using the payment client secret',
          'Booking will be confirmed after successful payment (via Kafka event)',
          'Cart will be cleared automatically after confirmation'
        ]
      }
    });

    console.log('[CartRoutes] Checkout completed - Booking created:', booking.reference);
  } catch (error) {
    console.error('[CartRoutes] POST /cart/checkout error:', error);
    res.status(500).json({
      error: 'Failed to process checkout',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/v1/cart/extend
 * Extend cart expiry by 30 minutes
 */
router.put('/extend', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Replace with actual user ID from JWT token after auth integration
    const userId = (req as any).user?.id || req.body.userId;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID'
      });
      return;
    }

    const cart = await CartService.extendCartExpiry(userId);

    if (!cart) {
      res.status(404).json({
        error: 'Cart not found or expired'
      });
      return;
    }

    res.json({
      data: cart,
      meta: {
        expiresAt: cart.expiresAt,
        message: 'Cart expiry extended by 30 minutes'
      }
    });
  } catch (error) {
    console.error('[CartRoutes] PUT /cart/extend error:', error);
    res.status(500).json({
      error: 'Failed to extend cart expiry',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
