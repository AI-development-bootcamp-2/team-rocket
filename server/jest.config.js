/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/database/migrations/**', '!src/database/seeds/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
