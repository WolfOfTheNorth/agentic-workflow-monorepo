// =============================================================================
// Jest Configuration for Node.js Environment
// For testing backend code, utilities, and non-DOM components
// =============================================================================

import baseConfig from './jest.base.js';

export default {
  ...baseConfig,
  displayName: 'Node.js Tests',
  testEnvironment: 'node',

  // Node.js specific setup
  setupFilesAfterEnv: [
    '<rootDir>/../../configs/testing/jest.setup.js',
    '<rootDir>/../../configs/testing/jest.node.setup.js',
  ],

  // Coverage collection (Node.js specific)
  collectCoverageFrom: [
    ...baseConfig.collectCoverageFrom,
    '!src/**/*.browser.{ts,tsx,js,jsx}',
    '!src/**/*.client.{ts,tsx,js,jsx}',
  ],

  // Test file patterns (Node.js specific)
  testMatch: [
    '**/__tests__/**/*.node.(test|spec).(ts|tsx|js|jsx)',
    '**/*.node.(test|spec).(ts|tsx|js|jsx)',
    '**/tests/**/*.(test|spec).(ts|js)',
    '**/*.(test|spec).(ts|js)', // Include all .ts/.js tests by default
  ],

  // Transform ignore patterns for Node.js
  transformIgnorePatterns: ['/node_modules/(?!(.*\\.mjs$|@testing-library))'],
};
