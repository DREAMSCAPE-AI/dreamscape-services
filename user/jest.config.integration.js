/** @type {import('jest').Config} */
const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'integration',
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  testTimeout: 30000,
  coverageDirectory: 'coverage/integration',
};
