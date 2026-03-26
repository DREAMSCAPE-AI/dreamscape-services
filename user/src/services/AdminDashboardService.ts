import { prisma } from '@dreamscape/db';
import { Prisma } from '@prisma/client';

interface Period {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
}

export function parsePeriod(period: string, startDate?: string, endDate?: string): Period {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  switch (period) {
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'custom':
      if (!startDate || !endDate) throw new Error('startDate and endDate required for custom period');
      start = new Date(startDate);
      end = new Date(endDate);
      break;
    default:
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime());
  const previousStart = new Date(start.getTime() - duration);

  return { startDate: start, endDate: end, previousStartDate: previousStart, previousEndDate: previousEnd };
}

export async function getStats(period: Period) {
  const { startDate, endDate, previousStartDate, previousEndDate } = period;

  // Users
  const [totalUsers, activeUsers, newUsers, previousNewUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    prisma.user.count({ where: { createdAt: { gte: previousStartDate, lte: previousEndDate } } }),
  ]);

  // Bookings
  const bookingWhere = { createdAt: { gte: startDate, lte: endDate } };
  const previousBookingWhere = { createdAt: { gte: previousStartDate, lte: previousEndDate } };

  const [totalBookings, previousTotalBookings, bookingsByStatus] = await Promise.all([
    prisma.bookingData.count({ where: bookingWhere }),
    prisma.bookingData.count({ where: previousBookingWhere }),
    prisma.bookingData.groupBy({
      by: ['status'],
      where: bookingWhere,
      _count: { id: true },
    }),
  ]);

  // Revenue
  const [revenueResult, previousRevenueResult] = await Promise.all([
    prisma.paymentTransaction.aggregate({
      where: { status: 'SUCCEEDED', createdAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: { status: 'SUCCEEDED', createdAt: { gte: previousStartDate, lte: previousEndDate } },
      _sum: { amount: true },
    }),
  ]);

  const revenue = Number(revenueResult._sum.amount || 0);
  const previousRevenue = Number(previousRevenueResult._sum.amount || 0);

  // Conversion rate: searches vs confirmed bookings
  const [searchCount, confirmedBookings] = await Promise.all([
    prisma.searchHistory.count({ where: { searchedAt: { gte: startDate, lte: endDate } } }),
    prisma.bookingData.count({
      where: {
        ...bookingWhere,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    }),
  ]);

  const [previousSearchCount, previousConfirmedBookings] = await Promise.all([
    prisma.searchHistory.count({ where: { searchedAt: { gte: previousStartDate, lte: previousEndDate } } }),
    prisma.bookingData.count({
      where: {
        ...previousBookingWhere,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    }),
  ]);

  const conversionRate = searchCount > 0 ? (confirmedBookings / searchCount) * 100 : 0;
  const previousConversionRate = previousSearchCount > 0 ? (previousConfirmedBookings / previousSearchCount) * 100 : 0;

  const avgBookingValue = totalBookings > 0 ? revenue / totalBookings : 0;

  const evolution = (current: number, previous: number) =>
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      newInPeriod: newUsers,
      evolution: evolution(newUsers, previousNewUsers),
    },
    bookings: {
      total: totalBookings,
      byStatus: Object.fromEntries(bookingsByStatus.map(b => [b.status, b._count.id])),
      evolution: evolution(totalBookings, previousTotalBookings),
    },
    revenue: {
      total: revenue,
      currency: 'EUR',
      evolution: evolution(revenue, previousRevenue),
    },
    conversionRate: {
      rate: Math.round(conversionRate * 100) / 100,
      evolution: Math.round((conversionRate - previousConversionRate) * 100) / 100,
    },
    avgBookingValue: {
      amount: Math.round(avgBookingValue * 100) / 100,
      currency: 'EUR',
    },
  };
}

export async function getRevenueChart(period: Period) {
  const { startDate, endDate } = period;

  const result = await prisma.$queryRaw<Array<{ date: Date; revenue: number }>>`
    SELECT
      date_trunc('day', "created_at") as date,
      COALESCE(SUM(amount), 0)::float as revenue
    FROM payment_transactions
    WHERE status = 'SUCCEEDED'
      AND "created_at" >= ${startDate}
      AND "created_at" <= ${endDate}
    GROUP BY date_trunc('day', "created_at")
    ORDER BY date
  `;

  return result.map(r => ({
    date: r.date.toISOString().split('T')[0],
    revenue: r.revenue,
  }));
}

export async function getBookingsByDestination(limit: number = 5) {
  const bookings = await prisma.bookingData.findMany({
    where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
    select: { data: true },
  });

  const destinationCounts: Record<string, number> = {};
  for (const booking of bookings) {
    const data = booking.data as any;
    const destination = data?.destination || data?.cityCode || data?.items?.[0]?.itemData?.cityCode || 'Unknown';
    destinationCounts[destination] = (destinationCounts[destination] || 0) + 1;
  }

  return Object.entries(destinationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([destination, count]) => ({ destination, count }));
}

export async function getRecentTransactions(limit: number = 10) {
  const transactions = await prisma.paymentTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const userIds = [...new Set(transactions.map(t => t.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  return transactions.map(t => {
    const user = userMap.get(t.userId);
    return {
      id: t.id,
      userEmail: user?.email || 'Unknown',
      userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
      paymentMethod: t.paymentMethod,
      bookingReference: t.bookingReference,
      createdAt: t.createdAt.toISOString(),
    };
  });
}
