// =============================================================================
// Test Data Fixtures
// Common test data for E2E tests
// =============================================================================

export const testUsers = {
  admin: {
    username: 'admin',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
  },
  user: {
    username: 'testuser',
    email: 'test@example.com',
    password: 'test123',
    role: 'user',
  },
  newUser: {
    username: 'newuser',
    email: 'new@example.com',
    password: 'new123',
    role: 'user',
  },
};

export const testData = {
  // Sample project data
  project: {
    name: 'Test Project',
    description: 'A test project for E2E testing',
    status: 'active',
  },

  // Sample task data
  task: {
    title: 'Test Task',
    description: 'A test task for E2E testing',
    priority: 'high',
    status: 'pending',
  },

  // API endpoints
  endpoints: {
    auth: {
      login: '/api/auth/login/',
      register: '/api/auth/register/',
      logout: '/api/auth/logout/',
      profile: '/api/auth/profile/',
    },
    users: {
      list: '/api/users/',
      detail: (id: number) => `/api/users/${id}/`,
    },
    projects: {
      list: '/api/projects/',
      detail: (id: number) => `/api/projects/${id}/`,
    },
  },

  // Common selectors
  selectors: {
    navigation: {
      menu: '[data-testid="navigation-menu"]',
      home: '[data-testid="nav-home"]',
      projects: '[data-testid="nav-projects"]',
      profile: '[data-testid="nav-profile"]',
    },
    forms: {
      submitButton: '[data-testid="submit-button"]',
      cancelButton: '[data-testid="cancel-button"]',
      errorMessage: '[data-testid="error-message"]',
      successMessage: '[data-testid="success-message"]',
    },
    modals: {
      overlay: '[data-testid="modal-overlay"]',
      closeButton: '[data-testid="modal-close"]',
      confirmButton: '[data-testid="modal-confirm"]',
    },
  },

  // Timeouts (in milliseconds)
  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000,
    navigation: 15000,
    api: 20000,
  },
};
