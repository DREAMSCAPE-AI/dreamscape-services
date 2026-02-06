import { PrismaClient } from '@prisma/client';
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

  // Seed Privacy Policy (GDPR)
  console.log('🔒 Seeding privacy policy...');
  const privacyPolicy = await prisma.privacyPolicy.create({
    data: {
      version: '1.0.0',
      title: 'DreamScape Privacy Policy',
      content: `1. Introduction

DreamScape ("we", "our", "us") is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and share your information when you use our travel platform services.

2. Data We Collect

We collect the following categories of personal data:
- Identity Data: first name, last name, email address
- Profile Data: phone number, date of birth, nationality, travel preferences
- Technical Data: IP address, browser type, device information
- Usage Data: search history, booking history, browsing patterns
- Payment Data: payment method details (processed securely via Stripe)
- Location Data: approximate location based on IP for relevant search results

3. How We Use Your Data

We process your personal data for the following purposes:
- Account management and authentication
- Flight, hotel, and activity search and booking services
- Personalized travel recommendations powered by AI
- Payment processing and booking confirmations
- Customer support and communication
- Service improvement and analytics (with your consent)
- Marketing communications (with your consent)

4. Legal Basis (GDPR Article 6)

- Contract performance: account management, bookings, payments
- Legitimate interest: service improvement, security, fraud prevention
- Consent: marketing, analytics, personalized recommendations
- Legal obligation: tax records, regulatory compliance

5. Data Sharing

We share your data with:
- Amadeus GDS: flight and hotel search/booking
- Stripe: payment processing
- OpenAI: AI-powered recommendations (anonymized)
- Cloud providers: secure data hosting (AWS/GCP)

We never sell your personal data to third parties.

6. Data Retention

- Account data: retained while account is active + 30 days after deletion request
- Booking data: 5 years (legal/tax requirements)
- Analytics data: 2 years (anonymized after)
- Payment data: as required by financial regulations

7. Your Rights (GDPR Articles 15-22)

You have the right to:
- Access your personal data (Article 15)
- Rectify inaccurate data (Article 16)
- Request erasure of your data (Article 17)
- Restrict processing (Article 18)
- Data portability - export your data (Article 20)
- Object to processing (Article 21)
- Withdraw consent at any time

Exercise these rights via Settings > Data & Privacy or contact privacy@dreamscape.com.

8. Cookies

We use cookies for essential functionality, preferences, analytics, and marketing. Manage your cookie preferences via our cookie consent banner or Settings > Data & Privacy.

9. Security

We implement industry-standard security measures including encryption at rest and in transit, access controls, and regular security audits.

10. Contact

Data Protection Officer: dpo@dreamscape.com
Support: privacy@dreamscape.com

11. Changes

We will notify you of material changes to this policy via email and in-app notifications. Continued use after changes constitutes acceptance.

Last updated: February 2026`,
      effectiveAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  console.log(`   Created privacy policy v${privacyPolicy.version} (id: ${privacyPolicy.id})`);

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