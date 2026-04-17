import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo bookings & payments...');

  // Get first user in DB (your admin account)
  const users = await prisma.user.findMany({ take: 3, orderBy: { createdAt: 'asc' } });
  if (users.length === 0) {
    console.error('❌ No users found. Create an account first.');
    return;
  }

  // Use up to 3 users, cycling if fewer
  const getUser = (i: number) => users[i % users.length];

  // Clean existing demo bookings/payments to avoid duplicates
  await prisma.paymentTransaction.deleteMany({
    where: { bookingReference: { startsWith: 'DEMO-' } },
  });
  await prisma.bookingData.deleteMany({
    where: { reference: { startsWith: 'DEMO-' } },
  });

  console.log(`👤 Using ${users.length} user(s): ${users.map(u => u.email).join(', ')}`);

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // ---- BOOKINGS ----
  const bookingsData = [
    {
      userId: getUser(0).id,
      type: 'FLIGHT' as const,
      reference: 'DEMO-FLT-001',
      status: 'CONFIRMED' as const,
      totalAmount: 349.90,
      currency: 'EUR',
      confirmedAt: daysAgo(5),
      createdAt: daysAgo(6),
      data: { from: 'CDG', to: 'JFK', departure: '2026-04-15T08:00:00Z', passengers: 2 },
    },
    {
      userId: getUser(0).id,
      type: 'HOTEL' as const,
      reference: 'DEMO-HTL-001',
      status: 'COMPLETED' as const,
      totalAmount: 520.00,
      currency: 'EUR',
      confirmedAt: daysAgo(20),
      createdAt: daysAgo(22),
      data: { hotel: 'Le Meurice Paris', checkIn: '2026-03-01', checkOut: '2026-03-04', rooms: 1 },
    },
    {
      userId: getUser(1).id,
      type: 'PACKAGE' as const,
      reference: 'DEMO-PKG-001',
      status: 'PENDING' as const,
      totalAmount: 1250.00,
      currency: 'EUR',
      confirmedAt: null,
      createdAt: daysAgo(2),
      data: { destination: 'Bali', duration: '7 nuits', included: ['vol', 'hôtel', 'transfert'] },
    },
    {
      userId: getUser(1).id,
      type: 'ACTIVITY' as const,
      reference: 'DEMO-ACT-001',
      status: 'CONFIRMED' as const,
      totalAmount: 89.00,
      currency: 'EUR',
      confirmedAt: daysAgo(1),
      createdAt: daysAgo(3),
      data: { activity: 'Tour Eiffel - Accès sommet', date: '2026-04-20', participants: 2 },
    },
    {
      userId: getUser(2).id,
      type: 'TRANSFER' as const,
      reference: 'DEMO-TRF-001',
      status: 'CANCELLED' as const,
      totalAmount: 75.00,
      currency: 'EUR',
      confirmedAt: null,
      createdAt: daysAgo(10),
      data: { from: 'CDG', to: 'Paris Centre', type: 'VTC', passengers: 3 },
    },
    {
      userId: getUser(0).id,
      type: 'FLIGHT' as const,
      reference: 'DEMO-FLT-002',
      status: 'PENDING_PAYMENT' as const,
      totalAmount: 210.50,
      currency: 'EUR',
      confirmedAt: null,
      createdAt: daysAgo(1),
      data: { from: 'ORY', to: 'BCN', departure: '2026-05-10T06:30:00Z', passengers: 1 },
    },
    {
      userId: getUser(1).id,
      type: 'HOTEL' as const,
      reference: 'DEMO-HTL-002',
      status: 'CONFIRMED' as const,
      totalAmount: 890.00,
      currency: 'EUR',
      confirmedAt: daysAgo(4),
      createdAt: daysAgo(5),
      data: { hotel: 'W Barcelona', checkIn: '2026-05-10', checkOut: '2026-05-14', rooms: 1 },
    },
    {
      userId: getUser(2).id,
      type: 'PACKAGE' as const,
      reference: 'DEMO-PKG-002',
      status: 'FAILED' as const,
      totalAmount: 3200.00,
      currency: 'EUR',
      confirmedAt: null,
      createdAt: daysAgo(8),
      data: { destination: 'Maldives', duration: '10 nuits', included: ['vol first class', 'resort 5*'] },
    },
  ];

  const createdBookings: any[] = [];
  for (const b of bookingsData) {
    const booking = await prisma.bookingData.create({ data: b as any });
    createdBookings.push(booking);
    console.log(`  ✅ Booking ${booking.reference} (${booking.status})`);
  }

  // ---- PAYMENT TRANSACTIONS ----
  const paymentsData = [
    {
      bookingIndex: 0, // DEMO-FLT-001 CONFIRMED
      paymentIntentId: 'pi_demo_flt001_succeeded',
      status: 'SUCCEEDED' as const,
      paymentMethod: 'card',
      confirmedAt: daysAgo(5),
      createdAt: daysAgo(6),
    },
    {
      bookingIndex: 1, // DEMO-HTL-001 COMPLETED
      paymentIntentId: 'pi_demo_htl001_succeeded',
      status: 'SUCCEEDED' as const,
      paymentMethod: 'card',
      confirmedAt: daysAgo(20),
      createdAt: daysAgo(22),
    },
    {
      bookingIndex: 3, // DEMO-ACT-001 CONFIRMED
      paymentIntentId: 'pi_demo_act001_succeeded',
      status: 'SUCCEEDED' as const,
      paymentMethod: 'apple_pay',
      confirmedAt: daysAgo(1),
      createdAt: daysAgo(3),
    },
    {
      bookingIndex: 4, // DEMO-TRF-001 CANCELLED
      paymentIntentId: 'pi_demo_trf001_refunded',
      status: 'REFUNDED' as const,
      paymentMethod: 'card',
      confirmedAt: daysAgo(9),
      refundedAt: daysAgo(8),
      createdAt: daysAgo(10),
    },
    {
      bookingIndex: 5, // DEMO-FLT-002 PENDING_PAYMENT
      paymentIntentId: 'pi_demo_flt002_pending',
      status: 'PENDING' as const,
      paymentMethod: null,
      createdAt: daysAgo(1),
    },
    {
      bookingIndex: 6, // DEMO-HTL-002 CONFIRMED
      paymentIntentId: 'pi_demo_htl002_succeeded',
      status: 'SUCCEEDED' as const,
      paymentMethod: 'google_pay',
      confirmedAt: daysAgo(4),
      createdAt: daysAgo(5),
    },
    {
      bookingIndex: 7, // DEMO-PKG-002 FAILED
      paymentIntentId: 'pi_demo_pkg002_failed',
      status: 'FAILED' as const,
      paymentMethod: 'card',
      failureReason: 'insufficient_funds',
      failedAt: daysAgo(8),
      createdAt: daysAgo(8),
      metadata: { declineCode: 'insufficient_funds', network: 'visa' },
    },
  ];

  for (const p of paymentsData) {
    const booking = createdBookings[p.bookingIndex];
    const { bookingIndex, ...paymentData } = p;
    await prisma.paymentTransaction.create({
      data: {
        ...paymentData,
        bookingId: booking.id,
        bookingReference: booking.reference,
        userId: booking.userId,
        amount: booking.totalAmount,
        currency: booking.currency,
      } as any,
    });
    console.log(`  💳 Payment ${paymentData.paymentIntentId} (${paymentData.status})`);
  }

  console.log('\n✅ Demo seed complete!');
  console.log(`   ${createdBookings.length} bookings + ${paymentsData.length} payments created`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
