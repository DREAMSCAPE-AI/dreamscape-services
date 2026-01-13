// Test setup file for Jest
// This file runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.PORT = '3002';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/dreamscape_test?schema=user';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  error: jest.fn(), // Mock console.error
  warn: jest.fn(),  // Mock console.warn
  log: jest.fn(),   // Mock console.log (optional)
};

// Global test utilities
export const createMockRequest = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  user: undefined,
  ...overrides,
});

export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
};

// Clean up after all tests
afterAll(async () => {
  // Close any open connections or cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
});
