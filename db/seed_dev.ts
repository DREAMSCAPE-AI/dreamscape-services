import { PrismaClient, Role, UserCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function clean() {
  console.log('🧹 Cleaning existing data...');
  await prisma.notification.deleteMany();
  await prisma.gdprRequest.deleteMany();
  await prisma.userConsent.deleteMany();
  await prisma.userPolicyAcceptance.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.userVector.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.userHistory.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.tokenBlacklist.deleteMany();
  await prisma.session.deleteMany();
  await prisma.travelOnboardingProfile.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.userBehavior.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.bookingData.deleteMany();
  await prisma.analytics.deleteMany();
  await prisma.predictionData.deleteMany();
  await prisma.flightData.deleteMany();
  await prisma.hotelData.deleteMany();
  await prisma.locationData.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers() {
  console.log('👥 Seeding users...');

  const accounts = [
    {
      email: 'admin@dreamscape.com',
      password: 'Admin123!',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'Dreamscape',
      role: Role.ADMIN,
      isVerified: true,
      onboardingCompleted: true,
      userCategory: UserCategory.BUSINESS,
      phoneNumber: '+33600000001',
      nationality: 'FR',
      dateOfBirth: new Date('1985-01-01'),
    },
    {
      email: 'moderator@dreamscape.com',
      password: 'Modo123!',
      username: 'moderator',
      firstName: 'Sophie',
      lastName: 'Martin',
      role: Role.MODERATOR,
      isVerified: true,
      onboardingCompleted: true,
      userCategory: UserCategory.LEISURE,
      phoneNumber: '+33600000002',
      nationality: 'FR',
      dateOfBirth: new Date('1990-05-14'),
    },
    {
      email: 'thomas.mayor@dreamscape.com',
      password: 'User123!',
      username: 'thomas.mayor',
      firstName: 'Thomas',
      lastName: 'Mayor',
      role: Role.USER,
      isVerified: true,
      onboardingCompleted: true,
      userCategory: UserCategory.LEISURE,
      phoneNumber: '+33612345678',
      nationality: 'FR',
      dateOfBirth: new Date('1993-03-22'),
    },
    {
      email: 'kevin.coutellier@dreamscape.com',
      password: 'User123!',
      username: 'kevin.coutellier',
      firstName: 'Kevin',
      lastName: 'Coutellier',
      role: Role.USER,
      isVerified: true,
      onboardingCompleted: false,
      userCategory: UserCategory.LEISURE,
      phoneNumber: '+33698765432',
      nationality: 'FR',
      dateOfBirth: new Date('1995-08-10'),
    },
    {
      email: 'unverified@dreamscape.com',
      password: 'User123!',
      username: 'unverified.user',
      firstName: 'John',
      lastName: 'Unverified',
      role: Role.USER,
      isVerified: false,
      onboardingCompleted: false,
      userCategory: UserCategory.LEISURE,
      phoneNumber: null,
      nationality: 'US',
      dateOfBirth: new Date('1998-12-25'),
    },
    {
      email: 'suspended@dreamscape.com',
      password: 'User123!',
      username: 'suspended.user',
      firstName: 'Bob',
      lastName: 'Suspended',
      role: Role.USER,
      isVerified: true,
      onboardingCompleted: true,
      userCategory: UserCategory.LEISURE,
      isSuspended: true,
      suspendedAt: new Date(),
      suspendedReason: 'Violation des conditions d\'utilisation',
      phoneNumber: '+1987654321',
      nationality: 'US',
      dateOfBirth: new Date('1988-06-15'),
    },
  ];

  const created: Record<string, Awaited<ReturnType<typeof prisma.user.create>>> = {};

  for (const account of accounts) {
    const hashedPassword = await bcrypt.hash(account.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: account.email,
        password: hashedPassword,
        username: account.username,
        firstName: account.firstName,
        lastName: account.lastName,
        role: account.role,
        isVerified: account.isVerified,
        onboardingCompleted: account.onboardingCompleted,
        onboardingCompletedAt: account.onboardingCompleted ? new Date() : null,
        userCategory: account.userCategory,
        phoneNumber: account.phoneNumber ?? undefined,
        nationality: account.nationality,
        dateOfBirth: account.dateOfBirth,
        isSuspended: account.isSuspended ?? false,
        suspendedAt: account.suspendedAt ?? null,
        suspendedReason: account.suspendedReason ?? null,
      },
    });
    created[account.email] = user;
    console.log(`   ✅ ${account.role.padEnd(9)} ${account.email}  /  pw: ${account.password}`);
  }

  return created;
}

async function seedProfiles(users: Record<string, { id: string; firstName: string | null; lastName: string | null }>) {
  console.log('👤 Seeding profiles & preferences...');

  const profileData = [
    {
      email: 'admin@dreamscape.com',
      preferences: { language: 'French', currency: 'EUR', travelStyle: ['Business', 'Luxury'] },
      preferredAirlines: ['AF', 'LH'],
      preferredCabinClass: 'BUSINESS',
      budgetRange: { min: 1000, max: 5000 },
    },
    {
      email: 'moderator@dreamscape.com',
      preferences: { language: 'French', currency: 'EUR', travelStyle: ['Cultural', 'Adventure'] },
      preferredAirlines: ['AF', 'EK'],
      preferredCabinClass: 'ECONOMY',
      budgetRange: { min: 300, max: 1500 },
    },
    {
      email: 'thomas.mayor@dreamscape.com',
      preferences: { language: 'French', currency: 'EUR', travelStyle: ['Cultural', 'Adventure'] },
      preferredAirlines: ['AF', 'BA', 'LH'],
      preferredCabinClass: 'ECONOMY',
      budgetRange: { min: 200, max: 800 },
    },
    {
      email: 'kevin.coutellier@dreamscape.com',
      preferences: { language: 'French', currency: 'EUR', travelStyle: ['Luxury', 'Gastronomie'] },
      preferredAirlines: ['AF', 'EK'],
      preferredCabinClass: 'BUSINESS',
      budgetRange: { min: 500, max: 2000 },
    },
  ];

  for (const p of profileData) {
    const user = users[p.email];
    if (!user) continue;

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        preferences: p.preferences,
      },
    });

    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        preferredAirlines: p.preferredAirlines,
        preferredCabinClass: p.preferredCabinClass,
        budgetRange: p.budgetRange,
        preferredDepartureTime: 'morning',
        loyaltyPrograms: [],
      },
    });

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        language: 'French',
        currency: 'EUR',
        timezone: 'Europe/Paris',
      },
    });
  }
}

async function seedLocations() {
  console.log('📍 Seeding locations...');

  const locations = [
    { name: 'Paris', country: 'France', city: 'Paris', coordinates: { lat: 48.8566, lng: 2.3522 }, description: 'La ville lumière' },
    { name: 'Tokyo', country: 'Japan', city: 'Tokyo', coordinates: { lat: 35.6762, lng: 139.6503 }, description: 'Capitale du Japon' },
    { name: 'New York', country: 'United States', city: 'New York', coordinates: { lat: 40.7128, lng: -74.0060 }, description: 'La ville qui ne dort jamais' },
    { name: 'Barcelone', country: 'Spain', city: 'Barcelona', coordinates: { lat: 41.3851, lng: 2.1734 }, description: 'Joyau catalan' },
    { name: 'Dubai', country: 'UAE', city: 'Dubai', coordinates: { lat: 25.2048, lng: 55.2708 }, description: 'Cité du futur' },
  ];

  for (const loc of locations) {
    await prisma.locationData.create({ data: loc });
  }
}

async function seedFlightsAndHotels() {
  console.log('✈️ Seeding flights & hotels...');

  await prisma.flightData.createMany({
    data: [
      { flightNumber: 'AF123', airline: 'Air France', origin: 'CDG', destination: 'NRT', departureTime: new Date('2026-07-15T10:30:00Z'), arrivalTime: new Date('2026-07-16T06:45:00Z'), price: 850.00, currency: 'EUR' },
      { flightNumber: 'AF456', airline: 'Air France', origin: 'CDG', destination: 'JFK', departureTime: new Date('2026-08-01T14:00:00Z'), arrivalTime: new Date('2026-08-01T17:30:00Z'), price: 520.00, currency: 'EUR' },
      { flightNumber: 'EK789', airline: 'Emirates', origin: 'CDG', destination: 'DXB', departureTime: new Date('2026-09-10T22:00:00Z'), arrivalTime: new Date('2026-09-11T06:00:00Z'), price: 650.00, currency: 'EUR' },
    ],
  });

  await prisma.hotelData.createMany({
    data: [
      { name: 'Hotel Le Meurice', location: 'Paris, France', rating: 5.0, pricePerNight: 650.00, currency: 'EUR', amenities: { wifi: true, spa: true, restaurant: true, pool: false, parking: true } },
      { name: 'Park Hyatt Tokyo', location: 'Tokyo, Japan', rating: 5.0, pricePerNight: 480.00, currency: 'EUR', amenities: { wifi: true, spa: true, restaurant: true, pool: true, parking: true } },
      { name: 'W Barcelona', location: 'Barcelona, Spain', rating: 4.5, pricePerNight: 280.00, currency: 'EUR', amenities: { wifi: true, spa: true, restaurant: true, pool: true, parking: false } },
    ],
  });
}

async function seedBookings(users: Record<string, { id: string }>) {
  console.log('📋 Seeding bookings...');

  const thomasId = users['thomas.mayor@dreamscape.com']?.id;
  const kevinId = users['kevin.coutellier@dreamscape.com']?.id;

  if (thomasId) {
    await prisma.bookingData.createMany({
      data: [
        { userId: thomasId, type: 'FLIGHT', reference: 'BKG-001', status: 'CONFIRMED', totalAmount: 850.00, currency: 'EUR', data: { flightNumber: 'AF123', passengers: 1, class: 'Economy' } },
        { userId: thomasId, type: 'HOTEL', reference: 'BKG-002', status: 'COMPLETED', totalAmount: 1300.00, currency: 'EUR', data: { hotelName: 'Hotel Le Meurice', nights: 2, guests: 1 } },
      ],
    });
  }

  if (kevinId) {
    await prisma.bookingData.create({
      data: { userId: kevinId, type: 'FLIGHT', reference: 'BKG-003', status: 'PENDING', totalAmount: 520.00, currency: 'EUR', data: { flightNumber: 'AF456', passengers: 2, class: 'Business' } },
    });
  }
}

async function seedPopularDestinations() {
  console.log('🌍 Seeding popular destinations...');

  const destinations = [
    { iataCode: 'CDG', cityName: 'Paris', countryName: 'France', region: 'Europe', searchCount: 15420, bookingCount: 3240, averagePrice: 450.00, peakSeason: [6, 7, 8, 12], offSeason: [1, 2, 11] },
    { iataCode: 'LHR', cityName: 'London', countryName: 'United Kingdom', region: 'Europe', searchCount: 18750, bookingCount: 4120, averagePrice: 380.00, peakSeason: [6, 7, 8], offSeason: [1, 2, 3] },
    { iataCode: 'JFK', cityName: 'New York', countryName: 'United States', region: 'North America', searchCount: 22100, bookingCount: 5680, averagePrice: 520.00, peakSeason: [6, 7, 8, 12], offSeason: [1, 2] },
    { iataCode: 'NRT', cityName: 'Tokyo', countryName: 'Japan', region: 'Asia', searchCount: 12890, bookingCount: 2340, averagePrice: 780.00, peakSeason: [3, 4, 10, 11], offSeason: [1, 2, 6, 7, 8] },
    { iataCode: 'SYD', cityName: 'Sydney', countryName: 'Australia', region: 'Oceania', searchCount: 8950, bookingCount: 1890, averagePrice: 920.00, peakSeason: [12, 1, 2], offSeason: [6, 7, 8] },
    { iataCode: 'DXB', cityName: 'Dubai', countryName: 'UAE', region: 'Middle East', searchCount: 16720, bookingCount: 3890, averagePrice: 650.00, peakSeason: [11, 12, 1, 2, 3], offSeason: [6, 7, 8, 9] },
    { iataCode: 'BCN', cityName: 'Barcelona', countryName: 'Spain', region: 'Europe', searchCount: 11230, bookingCount: 2670, averagePrice: 320.00, peakSeason: [6, 7, 8, 9], offSeason: [1, 2, 12] },
    { iataCode: 'BKK', cityName: 'Bangkok', countryName: 'Thailand', region: 'Asia', searchCount: 13450, bookingCount: 3120, averagePrice: 580.00, peakSeason: [11, 12, 1, 2], offSeason: [6, 7, 8, 9] },
  ];

  for (const d of destinations) {
    await prisma.popularDestination.upsert({
      where: { iataCode: d.iataCode },
      update: d,
      create: d,
    });
  }
}

async function main() {
  console.log('🌱 Starting dev seed...\n');

  await clean();
  const users = await seedUsers();
  await seedProfiles(users);
  await seedLocations();
  await seedFlightsAndHotels();
  await seedBookings(users);
  await seedPopularDestinations();

  console.log('\n✅ Dev seed completed!');
  console.log('\n📋 Accounts:');
  console.log('   admin@dreamscape.com        /  Admin123!   (ADMIN)');
  console.log('   moderator@dreamscape.com    /  Modo123!    (MODERATOR)');
  console.log('   thomas.mayor@dreamscape.com /  User123!    (USER, verified)');
  console.log('   kevin.coutellier@dreamscape.com / User123! (USER, onboarding incomplet)');
  console.log('   unverified@dreamscape.com   /  User123!    (USER, non vérifié)');
  console.log('   suspended@dreamscape.com    /  User123!    (USER, suspendu)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
