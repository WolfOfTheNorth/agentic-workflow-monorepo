// =============================================================================
// API Test Fixtures
// Common API response fixtures for testing
// =============================================================================

export const apiFixtures = {
  // User fixtures
  user: {
    valid: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    admin: {
      id: 2,
      username: 'admin',
      email: 'admin@example.com',
      isActive: true,
      isAdmin: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    list: [
      {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        isActive: true,
      },
      {
        id: 2,
        username: 'admin',
        email: 'admin@example.com',
        isActive: true,
        isAdmin: true,
      },
    ],
  },

  // Authentication fixtures
  auth: {
    loginSuccess: {
      token: 'mock-jwt-token-12345',
      refreshToken: 'mock-refresh-token-67890',
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
      },
      expiresIn: 3600,
    },
    loginError: {
      error: 'Invalid credentials',
      code: 401,
      message: 'Username or password is incorrect',
    },
    refreshSuccess: {
      token: 'new-mock-jwt-token-12345',
      expiresIn: 3600,
    },
  },

  // Project fixtures
  project: {
    single: {
      id: 1,
      name: 'Test Project',
      description: 'A test project for unit testing',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      owner: {
        id: 1,
        username: 'testuser',
      },
    },
    list: [
      {
        id: 1,
        name: 'Test Project 1',
        description: 'First test project',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        name: 'Test Project 2',
        description: 'Second test project',
        status: 'completed',
        createdAt: '2024-01-02T00:00:00.000Z',
      },
    ],
  },

  // Task fixtures
  task: {
    single: {
      id: 1,
      title: 'Test Task',
      description: 'A test task for unit testing',
      status: 'pending',
      priority: 'high',
      projectId: 1,
      assigneeId: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    list: [
      {
        id: 1,
        title: 'Test Task 1',
        description: 'First test task',
        status: 'pending',
        priority: 'high',
        projectId: 1,
      },
      {
        id: 2,
        title: 'Test Task 2',
        description: 'Second test task',
        status: 'completed',
        priority: 'medium',
        projectId: 1,
      },
    ],
  },

  // API response wrappers
  responses: {
    success: <T>(data: T) => ({
      data,
      message: 'Success',
      success: true,
      timestamp: '2024-01-01T00:00:00.000Z',
    }),

    error: (message: string, code: number = 400) => ({
      error: message,
      code,
      success: false,
      timestamp: '2024-01-01T00:00:00.000Z',
    }),

    paginated: <T>(data: T[], page: number = 1, limit: number = 10) => ({
      data,
      pagination: {
        page,
        limit,
        total: Array.isArray(data) ? data.length : 0,
        totalPages: Math.ceil((Array.isArray(data) ? data.length : 0) / limit),
      },
      success: true,
      timestamp: '2024-01-01T00:00:00.000Z',
    }),
  },

  // Health check fixtures
  health: {
    healthy: {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00.000Z',
      services: {
        database: 'healthy',
        redis: 'healthy',
        external_api: 'healthy',
      },
    },
    unhealthy: {
      status: 'unhealthy',
      timestamp: '2024-01-01T00:00:00.000Z',
      services: {
        database: 'healthy',
        redis: 'unhealthy',
        external_api: 'timeout',
      },
    },
  },

  // Validation error fixtures
  validation: {
    required_field: {
      error: 'Validation failed',
      code: 422,
      details: {
        username: ['This field is required'],
        email: ['This field is required'],
      },
    },
    invalid_format: {
      error: 'Validation failed',
      code: 422,
      details: {
        email: ['Enter a valid email address'],
        password: ['Password must be at least 8 characters'],
      },
    },
  },
};
