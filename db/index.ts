// Export Prisma client
export { prisma } from './client';
// Re-export all Prisma types
export * from '@prisma/client';

// Default export for compatibility
import { prisma } from './client';
export default prisma;