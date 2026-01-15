/**
 * Cart Service - Gestion du panier utilisateur
 * - CRUD operations
 * - Redis caching (TTL 30min)
 * - DB persistence
 * - Price calculation
 */

import type { CartData as PrismaCartData, CartItem } from '@prisma/client';
import prisma from '../database/prisma';
import RedisClient from '../config/redis';
import { Decimal } from '@prisma/client/runtime/library';

const CART_TTL_SECONDS = 30 * 60; // 30 minutes
const CART_REDIS_PREFIX = 'cart:';

// Cart item types (matching Prisma enum)
type CartItemType = 'FLIGHT' | 'HOTEL' | 'ACTIVITY';

// CartData with items relation
type CartData = PrismaCartData & {
  items: CartItem[];
};

interface AddToCartDTO {
  userId: string;
  type: CartItemType;
  itemId: string;
  itemData: any;
  price: number;
  quantity?: number;
  currency?: string;
}

interface UpdateCartItemDTO {
  quantity: number;
}

export class CartService {
  /**
   * Get cart from Redis or DB
   */
  async getCart(userId: string): Promise<CartData | null> {
    try {
      // Try Redis first
      const redisKey = `${CART_REDIS_PREFIX}${userId}`;
      const cachedCart = await RedisClient.get(redisKey);

      if (cachedCart) {
        console.log(`[CartService] Cache hit for user ${userId}`);
        return JSON.parse(cachedCart);
      }

      // Fallback to DB
      console.log(`[CartService] Cache miss, fetching from DB for user ${userId}`);
      const cart = await prisma.cartData.findFirst({
        where: {
          userId,
          expiresAt: { gte: new Date() }, // Only active carts
        },
        include: {
          items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (cart) {
        // Refresh Redis cache
        await this.cacheCart(cart);
      }

      return cart;
    } catch (error) {
      console.error('[CartService] Error fetching cart:', error);
      throw error;
    }
  }

  /**
   * Add item to cart
   */
  async addToCart(data: AddToCartDTO): Promise<CartData> {
    try {
      const { userId, type, itemId, itemData, price, quantity = 1, currency = 'EUR' } = data;

      // Get or create cart
      let cart = await this.getCart(userId);

      if (!cart) {
        // Create new cart
        cart = await prisma.cartData.create({
          data: {
            userId,
            totalPrice: new Decimal(0),
            currency,
            expiresAt: this.calculateExpiryDate(),
            items: {
              create: {
                type,
                itemId,
                itemData,
                quantity,
                price: new Decimal(price),
                currency,
              },
            },
          },
          include: {
            items: true,
          },
        });
      } else {
        // Check if item already exists in cart
        const existingItem = cart.items.find((item) => item.itemId === itemId && item.type === type);

        if (existingItem) {
          // Item already exists in cart - don't add duplicate, just return current cart
          console.log(`[CartService] Item ${itemId} already in cart, skipping duplicate`);
          return cart;
        } else {
          // Add new item
          await prisma.cartItem.create({
            data: {
              cartId: cart.id,
              type,
              itemId,
              itemData,
              quantity,
              price: new Decimal(price),
              currency,
            },
          });
        }

        // Refresh cart with updated items
        cart = await prisma.cartData.findUnique({
          where: { id: cart.id },
          include: { items: true },
        }) as CartData;
      }

      // Recalculate total price
      cart = await this.recalculateTotalPrice(cart.id);

      // Cache updated cart
      await this.cacheCart(cart);

      return cart;
    } catch (error) {
      console.error('[CartService] Error adding to cart:', error);
      throw error;
    }
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(userId: string, itemId: string, data: UpdateCartItemDTO): Promise<CartData> {
    try {
      const cart = await this.getCart(userId);

      if (!cart) {
        throw new Error('Cart not found');
      }

      const cartItem = cart.items.find((item) => item.id === itemId);

      if (!cartItem) {
        throw new Error('Cart item not found');
      }

      // Update quantity
      await prisma.cartItem.update({
        where: { id: itemId },
        data: {
          quantity: data.quantity,
        },
      });

      // Recalculate total price
      const updatedCart = await this.recalculateTotalPrice(cart.id);

      // Cache updated cart
      await this.cacheCart(updatedCart);

      return updatedCart;
    } catch (error) {
      console.error('[CartService] Error updating cart item:', error);
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeCartItem(userId: string, itemId: string): Promise<CartData> {
    try {
      const cart = await this.getCart(userId);

      if (!cart) {
        throw new Error('Cart not found');
      }

      const cartItem = cart.items.find((item) => item.id === itemId);

      if (!cartItem) {
        throw new Error('Cart item not found');
      }

      // Delete item
      await prisma.cartItem.delete({
        where: { id: itemId },
      });

      // Recalculate total price
      const updatedCart = await this.recalculateTotalPrice(cart.id);

      // Cache updated cart
      await this.cacheCart(updatedCart);

      return updatedCart;
    } catch (error) {
      console.error('[CartService] Error removing cart item:', error);
      throw error;
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId: string): Promise<void> {
    try {
      const cart = await this.getCart(userId);

      if (!cart) {
        return;
      }

      // Delete cart (cascade will delete items)
      await prisma.cartData.delete({
        where: { id: cart.id },
      });

      // Clear Redis cache
      const redisKey = `${CART_REDIS_PREFIX}${userId}`;
      await RedisClient.del(redisKey);

      console.log(`[CartService] Cart cleared for user ${userId}`);
    } catch (error) {
      console.error('[CartService] Error clearing cart:', error);
      throw error;
    }
  }

  /**
   * Recalculate total price
   */
  private async recalculateTotalPrice(cartId: string): Promise<CartData> {
    const cart = await prisma.cartData.findUnique({
      where: { id: cartId },
      include: { items: true },
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    const totalPrice = cart.items.reduce((sum, item) => {
      const itemTotal = Number(item.price) * item.quantity;
      return sum + itemTotal;
    }, 0);

    const updatedCart = await prisma.cartData.update({
      where: { id: cartId },
      data: {
        totalPrice: new Decimal(totalPrice),
      },
      include: { items: true },
    });

    return updatedCart as CartData;
  }

  /**
   * Cache cart in Redis
   */
  private async cacheCart(cart: CartData): Promise<void> {
    try {
      const redisKey = `${CART_REDIS_PREFIX}${cart.userId}`;
      await RedisClient.set(redisKey, JSON.stringify(cart), CART_TTL_SECONDS);
    } catch (error) {
      console.error('[CartService] Error caching cart:', error);
      // Don't throw - caching is optional
    }
  }

  /**
   * Calculate expiry date (30 minutes from now)
   */
  private calculateExpiryDate(): Date {
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 30);
    return expiryDate;
  }

  /**
   * Extend cart expiry
   */
  async extendCartExpiry(userId: string): Promise<CartData | null> {
    try {
      const cart = await this.getCart(userId);

      if (!cart) {
        return null;
      }

      const updatedCart = await prisma.cartData.update({
        where: { id: cart.id },
        data: {
          expiresAt: this.calculateExpiryDate(),
        },
        include: { items: true },
      });

      // Update cache
      await this.cacheCart(updatedCart as CartData);

      return updatedCart as CartData;
    } catch (error) {
      console.error('[CartService] Error extending cart expiry:', error);
      throw error;
    }
  }

  /**
   * Clean up expired carts (cron job)
   */
  async cleanupExpiredCarts(): Promise<number> {
    try {
      const result = await prisma.cartData.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      console.log(`[CartService] Cleaned up ${result.count} expired carts`);
      return result.count;
    } catch (error) {
      console.error('[CartService] Error cleaning up expired carts:', error);
      throw error;
    }
  }
}

export default new CartService();
