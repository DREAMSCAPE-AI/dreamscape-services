import { prisma } from '@dreamscape/db';

interface ListPaymentsParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function listPayments(params: ListPaymentsParams) {
  const { page, limit, search, status, startDate, endDate, minAmount, maxAmount, sortBy = 'createdAt', sortOrder = 'desc' } = params;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (minAmount !== undefined || maxAmount !== undefined) {
    where.amount = {};
    if (minAmount !== undefined) where.amount.gte = minAmount;
    if (maxAmount !== undefined) where.amount.lte = maxAmount;
  }

  if (search) {
    where.OR = [
      { bookingReference: { contains: search, mode: 'insensitive' } },
      { paymentIntentId: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [payments, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.paymentTransaction.count({ where }),
  ]);

  // Enrich with user info
  const userIds = [...new Set(payments.map((p) => p.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    payments: payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      user: userMap.get(p.userId) ?? null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPaymentById(id: string) {
  const payment = await prisma.paymentTransaction.findUnique({ where: { id } });
  if (!payment) throw new Error('Payment not found');

  const user = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { id: true, email: true, firstName: true, lastName: true, username: true },
  });

  const booking = await prisma.bookingData.findUnique({
    where: { id: payment.bookingId },
    select: { id: true, reference: true, type: true, status: true, totalAmount: true, currency: true, createdAt: true },
  });

  return {
    ...payment,
    amount: Number(payment.amount),
    user,
    booking: booking ? { ...booking, totalAmount: Number(booking.totalAmount) } : null,
  };
}

export async function updatePaymentStatus(id: string, status: string) {
  const existing = await prisma.paymentTransaction.findUnique({ where: { id } });
  if (!existing) throw new Error('Payment not found');

  const validStatuses = ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');

  const updateData: any = { status };
  const now = new Date();
  if (status === 'SUCCEEDED' && !existing.confirmedAt) updateData.confirmedAt = now;
  if (status === 'FAILED' && !existing.failedAt) updateData.failedAt = now;
  if (status === 'REFUNDED' && !existing.refundedAt) updateData.refundedAt = now;

  const payment = await prisma.paymentTransaction.update({ where: { id }, data: updateData });
  return { ...payment, amount: Number(payment.amount) };
}
