import prisma from './prisma.js';
import bcrypt from 'bcryptjs';

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

    // Seed PostgreSQL data
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
