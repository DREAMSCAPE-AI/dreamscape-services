/** @type {import('jest').Config} */
const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'unit',
  testMatch: ['**/__tests__/**/*.test.ts'],
  coverageDirectory: 'coverage/unit',
};
