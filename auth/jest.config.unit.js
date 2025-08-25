module.exports = {
    ...require('./jest.config.cjs'),
    displayName: 'Unit Tests',
    testMatch: ['**/tests/unit/**/*.test.ts'],
    coverageDirectory: 'coverage/unit',
};