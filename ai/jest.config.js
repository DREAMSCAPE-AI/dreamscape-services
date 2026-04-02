module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        skipLibCheck: true,
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/database/(.*)$': '<rootDir>/src/database/$1',
    '^@/handlers/(.*)$': '<rootDir>/src/handlers/$1',
    '^@/accommodations/(.*)$': '<rootDir>/src/accommodations/$1',
    '^@dreamscape/db$': '<rootDir>/../db/index.ts',
    '^@dreamscape/kafka$': '<rootDir>/../shared/kafka/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/server.ts',
    '!src/database/seed.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  verbose: true,
  testTimeout: 15000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
