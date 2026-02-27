/**
 * DR-447 — Granular per-type, per-channel notification preferences.
 *
 * Stored as JSON in UserSettings.notificationPreferences.
 * Types NOT listed here are "always-on" and cannot be disabled:
 *   ACCOUNT_SECURITY, SYSTEM, PRICE_ALERT, TRIP_REMINDER
 */

export interface ChannelPreference {
  inApp: boolean;
  email: boolean;
}

export interface NotificationPreferences {
  booking_confirmed: ChannelPreference;
  booking_cancelled: ChannelPreference;
  payment_succeeded: ChannelPreference;
  payment_failed: ChannelPreference;
  refund_processed: ChannelPreference;
  promo_offer: ChannelPreference;
  platform_update: ChannelPreference;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;

/** Default preferences — all in-app enabled; email enabled except promo & platform. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  booking_confirmed: { inApp: true, email: true },
  booking_cancelled: { inApp: true, email: true },
  payment_succeeded: { inApp: true, email: true },
  payment_failed: { inApp: true, email: true },
  refund_processed: { inApp: true, email: true },
  promo_offer: { inApp: true, email: false },
  platform_update: { inApp: true, email: false },
};

/** All valid preference keys (used for validation). */
export const PREFERENCE_KEYS: NotificationPreferenceKey[] = [
  'booking_confirmed',
  'booking_cancelled',
  'payment_succeeded',
  'payment_failed',
  'refund_processed',
  'promo_offer',
  'platform_update',
];

/**
 * Map Prisma NotificationType enum values to preference keys.
 * Types not in this map are always-on (ACCOUNT_SECURITY, SYSTEM, PRICE_ALERT, TRIP_REMINDER).
 */
export const NOTIFICATION_TYPE_TO_PREF_KEY: Record<string, NotificationPreferenceKey> = {
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  PAYMENT_RECEIVED: 'payment_succeeded',
  PAYMENT_FAILED: 'payment_failed',
  REFUND_PROCESSED: 'refund_processed',
  PROMO_OFFER: 'promo_offer',
  PLATFORM_UPDATE: 'platform_update',
};

/** Types that are always sent regardless of user preferences. */
export const ALWAYS_ON_TYPES = new Set([
  'ACCOUNT_SECURITY',
  'SYSTEM',
  'PRICE_ALERT',
  'TRIP_REMINDER',
]);
