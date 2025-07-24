// =============================================================================
// Jest Configuration for JSDOM Environment
// For testing React components and DOM-dependent code
// =============================================================================

import baseConfig from './jest.base.js';

export default {
  ...baseConfig,
  displayName: 'JSDOM Tests',
  testEnvironment: 'jsdom',

  // JSDOM specific setup
  setupFilesAfterEnv: [
    '<rootDir>/../../configs/testing/jest.setup.js',
    '<rootDir>/../../configs/testing/jest.jsdom.setup.js',
  ],

  // Test file patterns (JSDOM/React specific)
  testMatch: [
    '**/__tests__/**/*.browser.(test|spec).(ts|tsx|js|jsx)',
    '**/*.browser.(test|spec).(ts|tsx|js|jsx)',
    '**/__tests__/**/*.(test|spec).(tsx|jsx)',
    '**/*.(test|spec).(tsx|jsx)', // Include all .tsx/.jsx tests by default
  ],

  // Module name mapping with React-specific paths
  moduleNameMapping: {
    ...baseConfig.moduleNameMapping,
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/../../configs/testing/__mocks__/fileMock.js',
  },

  // Transform configuration for React
  transform: {
    ...baseConfig.transform,
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // JSDOM environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
};
