// =============================================================================
// Jest Node.js Environment Setup
// Additional setup for Node.js specific tests
// =============================================================================

// Node.js specific globals and polyfills
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock fetch for Node.js environment
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Mock process.env defaults for testing
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = 'http://localhost:8000';

// Database connection mock
global.mockDatabase = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  query: jest.fn(),
};

// File system operations mock
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Path operations mock
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
  dirname: jest.fn(path => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn(path => path.split('/').pop()),
}));
