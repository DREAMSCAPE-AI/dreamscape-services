import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test database URL if not provided
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/dreamscape_test?schema=public';
}

// Set JWT secret for tests
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-key';
}

// Increase timeout for async operations
jest.setTimeout(10000);