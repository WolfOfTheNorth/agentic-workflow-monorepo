// =============================================================================
// API Client Mocks
// Mock implementations of API clients for testing
// =============================================================================

import { apiFixtures } from '../fixtures/api-fixtures';

export class MockApiClient {
  private responses: Map<string, any> = new Map();
  private delays: Map<string, number> = new Map();
  private callCounts: Map<string, number> = new Map();

  // Mock response setup
  mockResponse(endpoint: string, response: any, delay: number = 0) {
    this.responses.set(endpoint, response);
    this.delays.set(endpoint, delay);
  }

  mockSuccess<T>(endpoint: string, data: T, delay: number = 0) {
    this.mockResponse(endpoint, apiFixtures.responses.success(data), delay);
  }

  mockError(endpoint: string, message: string, code: number = 400, delay: number = 0) {
    this.mockResponse(endpoint, apiFixtures.responses.error(message, code), delay);
  }

  // Get call count for endpoint
  getCallCount(endpoint: string): number {
    return this.callCounts.get(endpoint) || 0;
  }

  // Reset all mocks
  reset() {
    this.responses.clear();
    this.delays.clear();
    this.callCounts.clear();
  }

  // HTTP methods
  async get(endpoint: string): Promise<any> {
    return this.makeRequest('GET', endpoint);
  }

  async post(endpoint: string, data?: any): Promise<any> {
    return this.makeRequest('POST', endpoint, data);
  }

  async put(endpoint: string, data?: any): Promise<any> {
    return this.makeRequest('PUT', endpoint, data);
  }

  async delete(endpoint: string): Promise<any> {
    return this.makeRequest('DELETE', endpoint);
  }

  async patch(endpoint: string, data?: any): Promise<any> {
    return this.makeRequest('PATCH', endpoint, data);
  }

  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const key = `${method}:${endpoint}`;

    // Increment call count
    this.callCounts.set(key, (this.callCounts.get(key) || 0) + 1);

    // Add delay if specified
    const delay = this.delays.get(key) || 0;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Return mock response or default
    if (this.responses.has(key)) {
      const response = this.responses.get(key);

      // Simulate network error
      if (response instanceof Error) {
        throw response;
      }

      return response;
    }

    // Default responses for common endpoints
    return this.getDefaultResponse(method, endpoint, data);
  }

  private getDefaultResponse(method: string, endpoint: string, data?: any): any {
    // Health check
    if (endpoint.includes('/health')) {
      return apiFixtures.health.healthy;
    }

    // Auth endpoints
    if (endpoint.includes('/auth/login')) {
      return apiFixtures.auth.loginSuccess;
    }

    if (endpoint.includes('/auth/register')) {
      return apiFixtures.responses.success({
        message: 'User registered successfully',
      });
    }

    // User endpoints
    if (endpoint.includes('/users') && method === 'GET') {
      if (endpoint.match(/\/users\/\d+/)) {
        return apiFixtures.responses.success(apiFixtures.user.valid);
      }
      return apiFixtures.responses.paginated(apiFixtures.user.list);
    }

    // Project endpoints
    if (endpoint.includes('/projects') && method === 'GET') {
      if (endpoint.match(/\/projects\/\d+/)) {
        return apiFixtures.responses.success(apiFixtures.project.single);
      }
      return apiFixtures.responses.paginated(apiFixtures.project.list);
    }

    // Default success response
    return apiFixtures.responses.success({
      message: `${method} ${endpoint} completed successfully`,
      data: data || null,
    });
  }
}

// Global mock instance
export const mockApiClient = new MockApiClient();

// Jest mock factory
export const createApiClientMock = () => {
  const mock = new MockApiClient();

  return {
    get: jest.fn().mockImplementation(endpoint => mock.get(endpoint)),
    post: jest.fn().mockImplementation((endpoint, data) => mock.post(endpoint, data)),
    put: jest.fn().mockImplementation((endpoint, data) => mock.put(endpoint, data)),
    delete: jest.fn().mockImplementation(endpoint => mock.delete(endpoint)),
    patch: jest.fn().mockImplementation((endpoint, data) => mock.patch(endpoint, data)),
    mockResponse: mock.mockResponse.bind(mock),
    mockSuccess: mock.mockSuccess.bind(mock),
    mockError: mock.mockError.bind(mock),
    reset: mock.reset.bind(mock),
    getCallCount: mock.getCallCount.bind(mock),
  };
};

// React Query mock helpers
export const createQueryClientMock = () => {
  const queryCache = new Map();

  return {
    getQueryData: jest.fn(key => queryCache.get(JSON.stringify(key))),
    setQueryData: jest.fn((key, data) => queryCache.set(JSON.stringify(key), data)),
    invalidateQueries: jest.fn(),
    clear: jest.fn(() => queryCache.clear()),
    cache: queryCache,
  };
};
