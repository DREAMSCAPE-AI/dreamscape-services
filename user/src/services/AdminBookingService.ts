import { prisma } from '@dreamscape/db';

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

export async function listBookings(params: ListBookingsParams) {
  const { page, limit, search, status, type, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = params;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) where.status = status;
  if (type) where.type = type;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  // Search by reference first, then filter by user if needed
  if (search) {
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
  }

  const [bookings, total] = await Promise.all([
    prisma.bookingData.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.bookingData.count({ where }),
  ]);

  const enriched = await enrichWithUsers(
    bookings.map((b) => ({ ...b, totalAmount: Number(b.totalAmount) }))
  );

  return {
    bookings: enriched,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
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

  return { ...booking, totalAmount: Number(booking.totalAmount), user };
}

export async function bulkUpdateBookingStatus(ids: string[], status: string) {
  const validStatuses = ['DRAFT', 'PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FAILED'];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');

  const updateData: any = { status };
  if (status === 'CONFIRMED') updateData.confirmedAt = new Date();

  await prisma.bookingData.updateMany({
    where: { id: { in: ids } },
    data: updateData,
  });

  return { updated: ids.length };
}
