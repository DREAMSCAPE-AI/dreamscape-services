import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.userBehavior.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.bookingData.deleteMany();
  await prisma.flightData.deleteMany();
  await prisma.hotelData.deleteMany();
  await prisma.locationData.deleteMany();
  await prisma.predictionData.deleteMany();
  await prisma.analytics.deleteMany();

  // Seed Users
  console.log('👥 Seeding users...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user1 = await prisma.user.create({
    data: {
      email: 'thomas.mayor@example.com',
      password: hashedPassword,
      firstName: 'Thomas',
      lastName: 'Mayor',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'kevin.coutellier@example.com',
      password: hashedPassword,
      firstName: 'Kevin',
      lastName: 'Coutellier',
    },
  });

  // Seed User Profiles
  console.log('👤 Seeding user profiles...');
  await prisma.userProfile.create({
    data: {
      userId: user1.id,
      firstName: 'Thomas',
      lastName: 'Mayor',
      phone: '+33 1 23 45 67 89',
      preferences: {
        notifications: true,
        newsletter: false,
        language: 'French',
        currency: 'EUR',
        travelStyle: ['Cultural', 'Adventure'],
        interests: ['Photography', 'History']
      },
    },
  });

  await prisma.userProfile.create({
    data: {
      userId: user2.id,
      firstName: 'Kevin',
      lastName: 'Coutellier',
      phone: '+33 1 98 76 54 32',
      preferences: {
        notifications: true,
        newsletter: true,
        language: 'French',
        currency: 'EUR',
        travelStyle: ['Luxury', 'Gastronomie'],
        interests: ['Food', 'Art', 'Nature']
      },
    },
  });

  // Seed Locations
  console.log('📍 Seeding locations...');
  const paris = await prisma.locationData.create({
    data: {
      name: 'Paris',
      country: 'France',
      city: 'Paris',
      coordinates: { lat: 48.8566, lng: 2.3522 },
      description: 'La ville lumière, capitale de la France',
    },
  });

  const tokyo = await prisma.locationData.create({
    data: {
      name: 'Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      coordinates: { lat: 35.6762, lng: 139.6503 },
      description: 'Capitale dynamique du Japon',
    },
  });

  // Seed Flights
  console.log('✈️ Seeding flights...');
  await prisma.flightData.create({
    data: {
      flightNumber: 'AF123',
      airline: 'Air France',
      origin: 'CDG',
      destination: 'NRT',
      departureTime: new Date('2025-09-15T10:30:00Z'),
      arrivalTime: new Date('2025-09-16T06:45:00Z'),
      price: 850.00,
      currency: 'EUR',
    },
  });

  // Seed Hotels
  console.log('🏨 Seeding hotels...');
  await prisma.hotelData.create({
    data: {
      name: 'Hotel Le Meurice',
      location: 'Paris, France',
      rating: 5.0,
      pricePerNight: 650.00,
      currency: 'EUR',
      amenities: {
        wifi: true,
        spa: true,
        restaurant: true,
        pool: false,
        parking: true
      },
    },
  });

  // Seed Sample Booking
  console.log('📋 Seeding bookings...');
  await prisma.bookingData.create({
    data: {
      userId: user1.id,
      type: 'FLIGHT',
      reference: 'BKG-001',
      status: 'CONFIRMED',
      totalAmount: 850.00,
      currency: 'EUR',
      data: {
        flightNumber: 'AF123',
        passengers: 1,
        class: 'Economy'
      },
    },
  });

  // Seed Analytics
  console.log('📊 Seeding analytics...');
  await prisma.analytics.create({
    data: {
      service: 'auth',
      event: 'user_login',
      userId: user1.id,
      data: {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      },
    },
  });

  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });