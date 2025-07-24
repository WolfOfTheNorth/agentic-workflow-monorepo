// =============================================================================
// Jest JSDOM Environment Setup
// Additional setup for DOM and React specific tests
// =============================================================================

import { configure } from '@testing-library/react';

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
  getElementError: (message, container) => {
    const error = new Error(message);
    error.name = 'TestingLibraryElementError';
    error.stack = null;
    return error;
  },
});

// Mock React Router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    pathname: '/test',
    search: '',
    hash: '',
    state: null,
  }),
  useParams: () => ({}),
}));

// Mock environment variables for frontend
window.ENV = {
  API_BASE_URL: 'http://localhost:8000',
  NODE_ENV: 'test',
};

// Mock Vite environment variables
Object.defineProperty(window, 'import.meta', {
  value: {
    env: {
      VITE_API_BASE_URL: 'http://localhost:8000',
      NODE_ENV: 'test',
    },
  },
});

// Mock CSS imports
jest.mock('*.css', () => ({}));
jest.mock('*.scss', () => ({}));
jest.mock('*.sass', () => ({}));
jest.mock('*.less', () => ({}));

// Mock image imports
jest.mock('*.jpg', () => 'test-image.jpg');
jest.mock('*.jpeg', () => 'test-image.jpeg');
jest.mock('*.png', () => 'test-image.png');
jest.mock('*.gif', () => 'test-image.gif');
jest.mock('*.svg', () => 'test-image.svg');

// Mock font imports
jest.mock('*.woff', () => 'test-font.woff');
jest.mock('*.woff2', () => 'test-font.woff2');
jest.mock('*.ttf', () => 'test-font.ttf');
jest.mock('*.eot', () => 'test-font.eot');

// Global DOM cleanup
afterEach(() => {
  // Clean up DOM
  document.body.innerHTML = '';

  // Clear all timers
  jest.clearAllTimers();

  // Clear localStorage and sessionStorage
  localStorage.clear();
  sessionStorage.clear();
});
