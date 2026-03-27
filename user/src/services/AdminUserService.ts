import { prisma } from '@dreamscape/db';

interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  status?: 'active' | 'suspended';
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function listUsers(params: ListUsersParams) {
  const { page, limit, search, role, status, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = params;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) where.role = role;

  if (status === 'suspended') where.isSuspended = true;
  else if (status === 'active') where.isSuspended = false;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  // lastLoginAt sort maps to createdAt at list level (approximation)
  const prismaSort = sortBy === 'lastLoginAt' ? 'createdAt' : sortBy;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        userCategory: true,
        createdAt: true,
        updatedAt: true,
        onboardingCompleted: true,
        isSuspended: true,
        suspendedAt: true,
        suspendedReason: true,
        _count: {
          select: { searches: true, favorites: true, notifications: true },
        },
        sessions: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { [prismaSort]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(({ sessions, ...u }) => ({
      ...u,
      lastLoginAt: sessions[0]?.createdAt ?? null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(id: string) {
  const [user, lastSession, revenueResult, bookingsCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        dateOfBirth: true,
        nationality: true,
        role: true,
        userCategory: true,
        isVerified: true,
        isSuspended: true,
        suspendedAt: true,
        suspendedReason: true,
        onboardingCompleted: true,
        onboardingCompletedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { searches: true, favorites: true, history: true, notifications: true },
        },
      },
    }),
    prisma.session.findFirst({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: { userId: id, status: 'SUCCEEDED' },
      _sum: { amount: true },
    }),
    prisma.bookingData.count({ where: { userId: id } }),
  ]);

  if (!user) throw new Error('User not found');

  return {
    ...user,
    lastLoginAt: lastSession?.createdAt ?? null,
    revenueGenerated: Number(revenueResult._sum.amount ?? 0),
    bookingsCount,
  };
}

interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  isVerified?: boolean;
  userCategory?: string;
}

export async function updateUser(id: string, data: UpdateUserData) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('User not found');

  if (data.email && data.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailTaken) throw new Error('Email already in use');
  }

  const user = await prisma.user.update({
    where: { id },
    data: data as any,
    select: {
      id: true, email: true, username: true, firstName: true, lastName: true,
      role: true, isVerified: true, userCategory: true, isSuspended: true, updatedAt: true,
    },
  });

  return user;
}

export async function deleteUser(id: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('User not found');
  await prisma.user.delete({ where: { id } });
  return { id };
}

export async function suspendUser(id: string, reason?: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('User not found');
  if (existing.isSuspended) throw new Error('User already suspended');

  return prisma.user.update({
    where: { id },
    data: { isSuspended: true, suspendedAt: new Date(), suspendedReason: reason ?? null },
    select: { id: true, isSuspended: true, suspendedAt: true, suspendedReason: true },
  });
}

export async function reactivateUser(id: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('User not found');
  if (!existing.isSuspended) throw new Error('User is not suspended');

  return prisma.user.update({
    where: { id },
    data: { isSuspended: false, suspendedAt: null, suspendedReason: null },
    select: { id: true, isSuspended: true },
  });
}

export async function getUserActivity(id: string, page: number, limit: number) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new Error('User not found');

  const [historyItems, bookings, payments] = await Promise.all([
    prisma.userHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, actionType: true, entityType: true, entityId: true, createdAt: true },
    }),
    prisma.bookingData.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, type: true, reference: true, status: true, totalAmount: true, currency: true, createdAt: true },
    }),
    prisma.paymentTransaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, status: true, amount: true, currency: true, bookingReference: true, createdAt: true },
    }),
  ]);

  const normalized = [
    ...historyItems.map((h) => ({
      id: `history-${h.id}`,
      type: 'history' as const,
      label: `${h.actionType} — ${h.entityType}`,
      detail: h.entityId,
      createdAt: h.createdAt.toISOString(),
    })),
    ...bookings.map((b) => ({
      id: `booking-${b.id}`,
      type: 'booking' as const,
      label: `Réservation ${b.type}`,
      detail: b.reference,
      status: b.status,
      amount: Number(b.totalAmount),
      currency: b.currency,
      createdAt: b.createdAt.toISOString(),
    })),
    ...payments.map((p) => ({
      id: `payment-${p.id}`,
      type: 'payment' as const,
      label: `Paiement ${p.status}`,
      detail: p.bookingReference,
      status: p.status,
      amount: Number(p.amount),
      currency: p.currency,
      createdAt: p.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = normalized.length;
  const skip = (page - 1) * limit;
  const items = normalized.slice(skip, skip + limit);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

interface ExportFilters {
  search?: string;
  role?: string;
  status?: 'active' | 'suspended';
  startDate?: string;
  endDate?: string;
  ids?: string[];
}

export async function exportUsers(filters: ExportFilters) {
  const where: any = {};

  if (filters.ids && filters.ids.length > 0) {
    where.id = { in: filters.ids };
  } else {
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.role) where.role = filters.role;
    if (filters.status === 'suspended') where.isSuspended = true;
    else if (filters.status === 'active') where.isSuspended = false;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isVerified: true, isSuspended: true, createdAt: true,
      sessions: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  const userIds = users.map((u) => u.id);
  const [bookingCounts, revenues] = await Promise.all([
    prisma.bookingData.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { id: true },
    }),
    prisma.paymentTransaction.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: 'SUCCEEDED' },
      _sum: { amount: true },
    }),
  ]);

  const bookingMap = new Map(bookingCounts.map((b) => [b.userId, b._count.id]));
  const revenueMap = new Map(revenues.map((r) => [r.userId, Number(r._sum.amount ?? 0)]));

  const escapeCSV = (val: any) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const headers = ['id', 'email', 'firstName', 'lastName', 'role', 'isVerified', 'isSuspended', 'createdAt', 'lastLoginAt', 'bookingsCount', 'revenueGenerated'];
  const rows = users.map((u) => [
    u.id, u.email, u.firstName ?? '', u.lastName ?? '',
    u.role, u.isVerified, u.isSuspended,
    u.createdAt.toISOString(),
    u.sessions[0]?.createdAt?.toISOString() ?? '',
    bookingMap.get(u.id) ?? 0,
    revenueMap.get(u.id) ?? 0,
  ].map(escapeCSV).join(','));

  return [headers.join(','), ...rows].join('\n');
}
