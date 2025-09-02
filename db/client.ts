import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDevelopment = !globalThis.process?.env?.NODE_ENV || globalThis.process.env.NODE_ENV === 'development';

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
});

if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}