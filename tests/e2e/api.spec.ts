// =============================================================================
// API Integration E2E Tests
// Tests for frontend-backend API integration
// =============================================================================

import { test, expect } from '@playwright/test';
import { ApiUtils } from './utils/api';
import { AuthUtils } from './utils/auth';
import { testUsers, testData } from './fixtures/test-data';

test.describe('API Integration', () => {
  let apiUtils: ApiUtils;

  test.beforeEach(async ({ page }) => {
    apiUtils = new ApiUtils(page);
  });

  test('should check backend health', async ({ page }) => {
    const isHealthy = await apiUtils.healthCheck();
    expect(isHealthy).toBe(true);
  });

  test('should get API response from health endpoint', async ({ page }) => {
    const response = await apiUtils.get('/api/health/');

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('healthy');
  });

  test('should authenticate via API', async ({ page }) => {
    const response = await apiUtils.post('/api/auth/login/', {
      username: testUsers.user.username,
      password: testUsers.user.password,
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('token');
    expect(typeof data.token).toBe('string');
  });

  test('should get user profile with authentication', async ({ page }) => {
    // Get auth token
    const token = await AuthUtils.getAuthToken(
      page,
      testUsers.user.username,
      testUsers.user.password
    );

    // Make authenticated request
    const response = await apiUtils.get('/api/auth/profile/', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.ok()).toBe(true);
    const profile = await response.json();
    expect(profile).toHaveProperty('username');
    expect(profile.username).toBe(testUsers.user.username);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Try to access protected endpoint without auth
    const response = await apiUtils.get('/api/auth/profile/');

    expect(response.status()).toBe(401);

    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should handle network timeouts', async ({ page }) => {
    // This test simulates slow network
    test.setTimeout(45000);

    try {
      await apiUtils.waitForApi('/health/', 200, 5000);
    } catch (error) {
      // Expected to timeout for demo purposes
      expect(error.message).toContain('did not respond');
    }
  });

  test('should create and retrieve data via API', async ({ page }) => {
    // Get auth token
    const token = await AuthUtils.getAuthToken(
      page,
      testUsers.user.username,
      testUsers.user.password
    );

    // Create test data
    const createResponse = await apiUtils.post(
      '/api/projects/',
      {
        name: 'Test Project from E2E',
        description: 'Created during E2E testing',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    expect(createResponse.ok()).toBe(true);
    const createdProject = await createResponse.json();
    expect(createdProject).toHaveProperty('id');

    // Retrieve the created data
    const getResponse = await apiUtils.get(`/api/projects/${createdProject.id}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(getResponse.ok()).toBe(true);
    const retrievedProject = await getResponse.json();
    expect(retrievedProject.name).toBe('Test Project from E2E');

    // Clean up - delete the test data
    const deleteResponse = await apiUtils.delete(`/api/projects/${createdProject.id}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(deleteResponse.ok()).toBe(true);
  });
});
