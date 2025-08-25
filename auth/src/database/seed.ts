import prisma from './prisma.js';
import { connectMongoDB } from './mongodb.js';
import bcrypt from 'bcryptjs';

async function seedPopularDestinations() {
  const popularDestinations = [
    {
      iataCode: 'CDG',
      cityName: 'Paris',
      countryName: 'France',
      region: 'Europe',
      searchCount: 15420,
      bookingCount: 3240,
      averagePrice: 450.00,
      peakSeason: [6, 7, 8, 12], // June, July, August, December
      offSeason: [1, 2, 11] // January, February, November
    },
    {
      iataCode: 'LHR',
      cityName: 'London',
      countryName: 'United Kingdom',
      region: 'Europe',
      searchCount: 18750,
      bookingCount: 4120,
      averagePrice: 380.00,
      peakSeason: [6, 7, 8],
      offSeason: [1, 2, 3]
    },
    {
      iataCode: 'JFK',
      cityName: 'New York',
      countryName: 'United States',
      region: 'North America',
      searchCount: 22100,
      bookingCount: 5680,
      averagePrice: 520.00,
      peakSeason: [6, 7, 8, 12],
      offSeason: [1, 2]
    },
    {
      iataCode: 'NRT',
      cityName: 'Tokyo',
      countryName: 'Japan',
      region: 'Asia',
      searchCount: 12890,
      bookingCount: 2340,
      averagePrice: 780.00,
      peakSeason: [3, 4, 10, 11], // Cherry blossom and autumn
      offSeason: [1, 2, 6, 7, 8]
    },
    {
      iataCode: 'SYD',
      cityName: 'Sydney',
      countryName: 'Australia',
      region: 'Oceania',
      searchCount: 8950,
      bookingCount: 1890,
      averagePrice: 920.00,
      peakSeason: [12, 1, 2], // Summer in Australia
      offSeason: [6, 7, 8] // Winter in Australia
    },
    {
      iataCode: 'DXB',
      cityName: 'Dubai',
      countryName: 'United Arab Emirates',
      region: 'Middle East',
      searchCount: 16720,
      bookingCount: 3890,
      averagePrice: 650.00,
      peakSeason: [11, 12, 1, 2, 3], // Cooler months
      offSeason: [6, 7, 8, 9] // Hot summer months
    },
    {
      iataCode: 'BCN',
      cityName: 'Barcelona',
      countryName: 'Spain',
      region: 'Europe',
      searchCount: 11230,
      bookingCount: 2670,
      averagePrice: 320.00,
      peakSeason: [6, 7, 8, 9],
      offSeason: [1, 2, 12]
    },
    {
      iataCode: 'BKK',
      cityName: 'Bangkok',
      countryName: 'Thailand',
      region: 'Asia',
      searchCount: 13450,
      bookingCount: 3120,
      averagePrice: 580.00,
      peakSeason: [11, 12, 1, 2], // Cool and dry season
      offSeason: [6, 7, 8, 9] // Rainy season
    }
  ];

  console.log('Seeding popular destinations...');
  
  for (const destination of popularDestinations) {
    await prisma.popularDestination.upsert({
      where: { iataCode: destination.iataCode },
      update: destination,
      create: destination
    });
  }
  
  console.log(`Seeded ${popularDestinations.length} popular destinations`);
}

async function seedTestUser() {
  console.log('Seeding test users...');
  
  const testUsers = [
    {
      email: 'test@dreamscape.com',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '+1234567890',
      nationality: 'US',
      dateOfBirth: new Date('1990-01-15'),
      preferences: {
        preferredAirlines: ['AF', 'LH', 'BA'],
        preferredCabinClass: 'ECONOMY',
        budgetRange: { min: 200, max: 800 },
        preferredDepartureTime: 'morning',
        loyaltyPrograms: [
          { airline: 'AF', number: 'FB123456789', tier: 'Silver' }
        ]
      }
    },
    {
      email: 'john.doe@dreamscape.com',
      password: 'SecurePass456!',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '+1987654321',
      nationality: 'CA',
      dateOfBirth: new Date('1985-03-22'),
      preferences: {
        preferredAirlines: ['AC', 'UA', 'DL'],
        preferredCabinClass: 'BUSINESS',
        budgetRange: { min: 800, max: 2000 },
        preferredDepartureTime: 'evening',
        loyaltyPrograms: [
          { airline: 'AC', number: 'AC987654321', tier: 'Gold' }
        ]
      }
    },
    {
      email: 'maria.garcia@dreamscape.com',
      password: 'StrongPass789!',
      firstName: 'Maria',
      lastName: 'Garcia',
      phoneNumber: '+34612345678',
      nationality: 'ES',
      dateOfBirth: new Date('1992-07-10'),
      preferences: {
        preferredAirlines: ['IB', 'VY', 'FR'],
        preferredCabinClass: 'ECONOMY',
        budgetRange: { min: 100, max: 500 },
        preferredDepartureTime: 'afternoon',
        loyaltyPrograms: []
      }
    }
  ];

  for (const userData of testUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        nationality: userData.nationality,
        dateOfBirth: userData.dateOfBirth
      }
    });

    // Create user preferences
    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        preferredAirlines: userData.preferences.preferredAirlines,
        preferredCabinClass: userData.preferences.preferredCabinClass,
        budgetRange: userData.preferences.budgetRange,
        preferredDepartureTime: userData.preferences.preferredDepartureTime,
        loyaltyPrograms: userData.preferences.loyaltyPrograms
      }
    });
  }

  console.log(`Seeded ${testUsers.length} test users with preferences`);
}

async function main() {
  try {
    console.log('Starting database seeding...');
    
    // Connect to MongoDB
    await connectMongoDB();
    
    // Seed PostgreSQL data
    await seedPopularDestinations();
    await seedTestUser();
    
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
