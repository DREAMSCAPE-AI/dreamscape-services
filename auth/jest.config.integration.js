module.exports = {
    ...require('./jest.config.cjs'),
    displayName: 'Integration Tests',
    testMatch: ['**/tests/integration/**/*.test.ts', '**/tests/routes/**/*.test.ts'],
    coverageDirectory: 'coverage/integration',
};