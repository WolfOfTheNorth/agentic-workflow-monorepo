// =============================================================================
// Full Workflow E2E Tests
// Comprehensive tests covering both frontend and backend workflows
// =============================================================================

import { expect, test } from '@playwright/test';
import { testUsers } from './fixtures/test-data';
import { HomePage } from './page-objects/HomePage';
import { LoginPage } from './page-objects/LoginPage';
import { ApiUtils } from './utils/api';
import { AuthUtils } from './utils/auth';

test.describe('Full Application Workflow', () => {
  let apiUtils: ApiUtils;

  test.beforeEach(async ({ page }) => {
    apiUtils = new ApiUtils(page);

    // Ensure clean state
    await page.goto('/');

    // Wait for both frontend and backend to be ready
    await expect(page.locator('body')).toBeVisible();
    const backendHealthy = await apiUtils.healthCheck();
    expect(backendHealthy).toBe(true);
  });

  test('complete user registration and login workflow', async ({ page }) => {
    // Step 1: Navigate to home page
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.waitForLoad();

    // Step 2: Try to access protected content (should redirect to login)
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);

    // Step 3: Register a new user via API
    const newUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpass123',
    };

    const registerResponse = await apiUtils.post('/api/auth/register/', newUser);
    await ApiUtils.expectApiResponse(registerResponse, 201);

    // Step 4: Login with the new user
    const loginPage = new LoginPage(page);
    await loginPage.login(newUser.username, newUser.password);

    // Step 5: Verify successful login and redirection to dashboard
    await page.waitForURL(/\/(dashboard|home|$)/);
    const isLoggedIn = await AuthUtils.isLoggedIn(page);
    expect(isLoggedIn).toBe(true);

    // Step 6: Verify user profile via API
    const token = await AuthUtils.getAuthToken(page, newUser.username, newUser.password);
    const profileResponse = await apiUtils.get('/api/auth/profile/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    await ApiUtils.expectApiResponse(profileResponse, 200);
    const profile = await profileResponse.json();
    expect(profile.username).toBe(newUser.username);
    expect(profile.email).toBe(newUser.email);

    // Step 7: Create data via frontend interaction
    // (This would interact with actual UI elements in a real app)
    await page.goto('/projects');

    if (await page.locator('[data-testid="create-project-button"]').isVisible()) {
      await page.click('[data-testid="create-project-button"]');
      await page.fill('[data-testid="project-name-input"]', 'E2E Test Project');
      await page.fill('[data-testid="project-description-input"]', 'Created during E2E testing');
      await page.click('[data-testid="project-submit-button"]');

      // Wait for success message or redirect
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    }

    // Step 8: Verify data creation via API
    const projectsResponse = await apiUtils.get('/api/projects/', {
      headers: { Authorization: `Bearer ${token}` },
    });

    await ApiUtils.expectApiResponse(projectsResponse, 200);
    const projects = await projectsResponse.json();
    expect(Array.isArray(projects.data)).toBe(true);

    // Step 9: Update profile via frontend
    await page.goto('/profile');

    if (await page.locator('[data-testid="edit-profile-button"]').isVisible()) {
      await page.click('[data-testid="edit-profile-button"]');
      await page.fill('[data-testid="profile-bio-input"]', 'Updated during E2E testing');
      await page.click('[data-testid="profile-save-button"]');

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    }

    // Step 10: Verify profile update via API
    const updatedProfileResponse = await apiUtils.get('/api/auth/profile/', {
      headers: { Authorization: `Bearer ${token}` },
    });

    await ApiUtils.expectApiResponse(updatedProfileResponse, 200);
    // Would check for updated bio if that field exists

    // Step 11: Test data manipulation workflow
    if (projects.data && projects.data.length > 0) {
      const projectId = projects.data[0].id;

      // Update project via API
      const updateResponse = await apiUtils.put(
        `/api/projects/${projectId}/`,
        {
          name: 'Updated E2E Test Project',
          status: 'completed',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await ApiUtils.expectApiResponse(updateResponse, 200);

      // Verify update in frontend
      await page.goto('/projects');
      await page.reload();

      // Check if updated project name is visible
      await expect(page.locator('text=Updated E2E Test Project')).toBeVisible();
    }

    // Step 12: Test logout workflow
    await AuthUtils.logoutUser(page);

    // Verify logout
    const isLoggedOut = !(await AuthUtils.isLoggedIn(page));
    expect(isLoggedOut).toBe(true);

    // Step 13: Verify protected routes are inaccessible after logout
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);

    // Step 14: Clean up - delete test user via API
    try {
      await apiUtils.delete(`/api/users/${newUser.username}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // It's okay if cleanup fails
      console.log('Cleanup failed, but test passed');
    }
  });

  test('error handling workflow', async ({ page }) => {
    // Test frontend and backend error handling integration

    // Step 1: Test API error handling
    const errorResponse = await apiUtils.post('/api/auth/login/', {
      username: 'nonexistent',
      password: 'wrongpass',
    });

    expect(errorResponse.status()).toBe(401);
    const errorData = await errorResponse.json();
    expect(errorData).toHaveProperty('error');

    // Step 2: Test frontend error display
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('nonexistent', 'wrongpass');

    // Should show error message
    await expect(loginPage.errorMessage).toBeVisible();
    const errorText = await loginPage.getErrorMessage();
    expect(errorText).toContain('Invalid');

    // Step 3: Test network error handling
    await page.route('**/api/**', route => {
      route.abort('internetdisconnected');
    });
    await loginPage.login('testuser', 'testpass');

    // Should handle network error gracefully
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();

    // Clean up route interception
    await page.unroute('**/api/**');
  });
});

test('real-time data synchronization', async ({ page, context }) => {
  // Test real-time features if implemented (WebSocket, SSE, etc.)

  // Create second page/tab to simulate concurrent users
  const secondPage = await context.newPage();

  // Login first user
  await AuthUtils.loginUser(page, testUsers.user.username, testUsers.user.password);

  // Login second user (admin)
  await AuthUtils.loginUser(secondPage, testUsers.admin.username, testUsers.admin.password);

  // Navigate both to same data view
  await page.goto('/projects');
  await secondPage.goto('/projects');

  // Create data from second user
  if (await secondPage.locator('[data-testid="create-project-button"]').isVisible()) {
    await secondPage.click('[data-testid="create-project-button"]');
    await secondPage.fill('[data-testid="project-name-input"]', 'Real-time Test Project');
    await secondPage.fill('[data-testid="project-description-input"]', 'Testing real-time sync');
    await secondPage.click('[data-testid="project-submit-button"]');

    await expect(secondPage.locator('[data-testid="success-message"]')).toBeVisible();
  }

  // Check if first user sees the update (refresh if no real-time)
  await page.reload();
  await expect(page.locator('text=Real-time Test Project')).toBeVisible();

  await secondPage.close();
});

test('performance and load testing', async ({ page }) => {
  // Test application performance under various conditions

  // Measure page load times
  const startTime = Date.now();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;

  // Should load within reasonable time (adjust threshold as needed)
  expect(loadTime).toBeLessThan(5000);

  // Test API response times
  const apiUtils = new ApiUtils(page);
  const apiStartTime = Date.now();
  const healthResponse = await apiUtils.get('/api/health/');
  const apiResponseTime = Date.now() - apiStartTime;

  expect(healthResponse.ok()).toBe(true);
  expect(apiResponseTime).toBeLessThan(2000);

  // Test multiple concurrent API calls
  const concurrentCalls = Array.from({ length: 5 }, () => apiUtils.get('/api/health/'));

  const responses = await Promise.all(concurrentCalls);
  responses.forEach(response => {
    expect(response.ok()).toBe(true);
  });
});

test('accessibility and usability', async ({ page }) => {
  // Test accessibility features

  await page.goto('/');

  // Check for proper heading structure
  const h1Elements = await page.locator('h1').count();
  expect(h1Elements).toBeGreaterThan(0);

  // Check for proper form labels
  await page.goto('/login');
  const usernameLabel = page.locator('label[for="username"], label:has-text("Username")');
  const passwordLabel = page.locator('label[for="password"], label:has-text("Password")');

  await expect(usernameLabel).toBeVisible();
  await expect(passwordLabel).toBeVisible();

  // Test keyboard navigation
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focusedElement = await page.locator(':focus');
  await expect(focusedElement).toBeVisible();

  // Test ARIA attributes if implemented
  const buttons = page.locator('button');
  const buttonCount = await buttons.count();

  for (let i = 0; i < buttonCount; i++) {
    const button = buttons.nth(i);
    const isVisible = await button.isVisible();
    if (isVisible) {
      const ariaLabel = await button.getAttribute('aria-label');
      const textContent = await button.textContent();

      // Button should have either aria-label or text content
      expect(ariaLabel || textContent).toBeTruthy();
    }
  }
});
// ...existing code...
