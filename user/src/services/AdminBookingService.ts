import axios from 'axios';
import { prisma } from '@dreamscape/db';
import notificationService from './NotificationService';
import { sendBookingConfirmationEmail, isSendGridConfigured } from './EmailService';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';

interface ListBookingsParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  minAmount?: number;
  maxAmount?: number;
  destination?: string;
}

function extractDestination(type: string, data: any): string | null {
  if (!data) return null;
  switch (type) {
    case 'FLIGHT': return data.to || data.destination || null;
    case 'HOTEL': return data.hotel || data.city || data.destination || null;
    case 'PACKAGE': return data.destination || null;
    case 'ACTIVITY': return data.location || data.city || data.destination || null;
    case 'TRANSFER': return data.to || data.destination || null;
    default: return data.destination || null;
  }
}

async function enrichWithUsers<T extends { userId: string }>(items: T[]) {
  const userIds = [...new Set(items.map((i) => i.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return items.map((item) => ({ ...item, user: userMap.get(item.userId) ?? null }));
}

function buildWhere(params: Omit<ListBookingsParams, 'page' | 'limit' | 'sortBy' | 'sortOrder' | 'destination'>) {
  const { search, status, type, startDate, endDate, minAmount, maxAmount } = params;
  const where: any = {};

  if (status) where.status = status;
  if (type) where.type = type;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
  }

  if (minAmount !== undefined || maxAmount !== undefined) {
    where.totalAmount = {};
    if (minAmount !== undefined) where.totalAmount.gte = minAmount;
    if (maxAmount !== undefined) where.totalAmount.lte = maxAmount;
  }

  return { where, searchTerm: search };
}

async function applySearchToWhere(where: any, search?: string) {
  if (!search) return where;
  const matchingUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  const userIds = matchingUsers.map((u) => u.id);
  where.OR = [
    { reference: { contains: search, mode: 'insensitive' } },
    ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
  ];
  return where;
}

export async function listBookings(params: ListBookingsParams) {
  const { page, limit, sortBy = 'createdAt', sortOrder = 'desc', destination } = params;

  const { where, searchTerm } = buildWhere(params);
  await applySearchToWhere(where, searchTerm);

  // Destination requires in-memory filter (JSON field varies by type)
  if (destination) {
    const allBookings = await prisma.bookingData.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    });
    const enriched = await enrichWithUsers(
      allBookings.map((b) => ({ ...b, totalAmount: Number(b.totalAmount) }))
    );
    const withDest = enriched.map((b) => ({
      ...b,
      destination: extractDestination(b.type, b.data as any),
    }));
    const filtered = withDest.filter((b) =>
      b.destination?.toLowerCase().includes(destination.toLowerCase())
    );
    const total = filtered.length;
    const skip = (page - 1) * limit;
    return {
      bookings: filtered.slice(skip, skip + limit),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  const skip = (page - 1) * limit;
  const [bookings, total] = await Promise.all([
    prisma.bookingData.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip, take: limit }),
    prisma.bookingData.count({ where }),
  ]);

  const enriched = await enrichWithUsers(
    bookings.map((b) => ({ ...b, totalAmount: Number(b.totalAmount) }))
  );

  return {
    bookings: enriched.map((b) => ({
      ...b,
      destination: extractDestination(b.type, b.data as any),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getBookingById(id: string) {
  const booking = await prisma.bookingData.findUnique({ where: { id } });
  if (!booking) throw new Error('Booking not found');

  const user = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { id: true, email: true, firstName: true, lastName: true, username: true },
  });

  let payment = null;
  if (booking.paymentIntentId) {
    const p = await prisma.paymentTransaction.findUnique({
      where: { paymentIntentId: booking.paymentIntentId },
    });
    if (p) payment = { ...p, amount: Number(p.amount) };
  }

  return {
    ...booking,
    totalAmount: Number(booking.totalAmount),
    destination: extractDestination(booking.type, booking.data as any),
    user,
    payment,
  };
}

export async function updateBookingStatus(id: string, status: string) {
  const existing = await prisma.bookingData.findUnique({ where: { id } });
  if (!existing) throw new Error('Booking not found');

  const validStatuses = ['DRAFT', 'PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FAILED'];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');

  const updateData: any = { status };
  if (status === 'CONFIRMED' && !existing.confirmedAt) {
    updateData.confirmedAt = new Date();
  }

  const booking = await prisma.bookingData.update({ where: { id }, data: updateData });
  const user = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  return {
    ...booking,
    totalAmount: Number(booking.totalAmount),
    destination: extractDestination(booking.type, booking.data as any),
    user,
  };
}

export async function bulkUpdateBookingStatus(ids: string[], status: string) {
  const validStatuses = ['DRAFT', 'PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FAILED'];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');

  const updateData: any = { status };
  if (status === 'CONFIRMED') updateData.confirmedAt = new Date();

  await prisma.bookingData.updateMany({ where: { id: { in: ids } }, data: updateData });
  return { updated: ids.length };
}

export async function cancelBooking(id: string, refund: boolean, reason: string) {
  const booking = await prisma.bookingData.findUnique({ where: { id } });
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'CANCELLED') throw new Error('Booking already cancelled');
  if (booking.status === 'COMPLETED') throw new Error('Cannot cancel a completed booking');

  const updated = await prisma.bookingData.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  if (refund && booking.paymentIntentId) {
    try {
      await axios.post(`${PAYMENT_SERVICE_URL}/api/v1/payment/refund`, {
        paymentIntentId: booking.paymentIntentId,
        bookingId: id,
        userId: booking.userId,
        reason: reason || 'Admin cancellation',
      });
    } catch (err: any) {
      console.error('[AdminBookingService] Refund call failed:', err?.message);
      // Booking is already cancelled — refund failure is non-blocking
    }
  }

  try {
    await notificationService.createNotification(booking.userId, {
      type: 'BOOKING_CANCELLED',
      title: 'Réservation annulée',
      message: reason || 'Votre réservation a été annulée par l\'administration.',
      metadata: { bookingId: id, reference: booking.reference },
    });
  } catch (err) {
    console.error('[AdminBookingService] Notification failed:', err);
  }

  const user = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  return {
    ...updated,
    totalAmount: Number(updated.totalAmount),
    destination: extractDestination(updated.type, updated.data as any),
    user,
  };
}

export async function modifyBooking(
  id: string,
  updates: { totalAmount?: number; notes?: string; data?: Record<string, any> }
) {
  const booking = await prisma.bookingData.findUnique({ where: { id } });
  if (!booking) throw new Error('Booking not found');

  const updateData: any = {};
  if (updates.totalAmount !== undefined) updateData.totalAmount = updates.totalAmount;
  if (updates.data || updates.notes !== undefined) {
    const existingData = (booking.data as Record<string, any>) || {};
    updateData.data = {
      ...existingData,
      ...(updates.data || {}),
      ...(updates.notes !== undefined ? { adminNotes: updates.notes } : {}),
    };
  }

  const updated = await prisma.bookingData.update({ where: { id }, data: updateData });
  const user = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  return {
    ...updated,
    totalAmount: Number(updated.totalAmount),
    destination: extractDestination(updated.type, updated.data as any),
    user,
  };
}

export async function resendConfirmationEmail(id: string) {
  if (!isSendGridConfigured()) {
    throw new Error('SENDGRID_NOT_CONFIGURED');
  }

  const booking = await prisma.bookingData.findUnique({ where: { id } });
  if (!booking) throw new Error('Booking not found');

  const user = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { email: true, firstName: true, lastName: true },
  });
  if (!user) throw new Error('User not found');

  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const destination = extractDestination(booking.type, booking.data as any);

  await sendBookingConfirmationEmail({
    to: user.email,
    userName,
    reference: booking.reference,
    type: booking.type,
    destination,
    totalAmount: Number(booking.totalAmount),
    currency: booking.currency,
  });

  return { success: true };
}

export async function exportBookings(filters: Omit<ListBookingsParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>) {
  const { where, searchTerm } = buildWhere(filters);
  await applySearchToWhere(where, searchTerm);

  const bookings = await prisma.bookingData.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const enriched = await enrichWithUsers(
    bookings.map((b) => ({ ...b, totalAmount: Number(b.totalAmount) }))
  );

  const headers = ['id', 'reference', 'type', 'status', 'destination', 'userId', 'userEmail', 'totalAmount', 'currency', 'confirmedAt', 'createdAt'];
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const rows = enriched.map((b) => {
    const dest = extractDestination(b.type, b.data as any);
    return [
      b.id,
      b.reference,
      b.type,
      b.status,
      dest || '',
      b.userId,
      b.user?.email || '',
      b.totalAmount,
      b.currency,
      (b as any).confirmedAt?.toISOString() || '',
      b.createdAt.toISOString(),
    ].map(escape).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
