// =============================================================================
// Base Jest Configuration for Monorepo
// Shared configuration that can be extended by individual packages
// =============================================================================

export default {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',

  // Test file patterns
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)', '**/*.(test|spec).(ts|tsx|js|jsx)'],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{ts,tsx,js,jsx}',
    '!src/**/*.stories.{ts,tsx,js,jsx}',
    '!src/**/*.config.{ts,tsx,js,jsx}',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Coverage output
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Error handling
  errorOnDeprecated: true,

  // Module name mapping for workspace packages
  moduleNameMapping: {
    '^@shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
    '^@api/(.*)$': '<rootDir>/../../packages/api/src/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/../../configs/testing/jest.setup.js'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/coverage/'],

  // Transform ignore patterns
  transformIgnorePatterns: ['/node_modules/(?!(.*\\.mjs$))'],
};
