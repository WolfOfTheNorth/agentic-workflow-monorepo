// =============================================================================
// Authentication E2E Tests
// Tests for user authentication flows
// =============================================================================

import { test, expect } from '@playwright/test';
import { HomePage } from './page-objects/HomePage';
import { LoginPage } from './page-objects/LoginPage';
import { AuthUtils } from './utils/auth';
import { testUsers, testData } from './fixtures/test-data';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start from a clean state
    await page.goto('/');
  });

  test('should display home page correctly', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();
    await homePage.waitForLoad();

    // Check page title
    const title = await homePage.getTitle();
    expect(title).toContain('Agentic Workflow');

    // Check main heading is visible
    await expect(homePage.heading).toBeVisible();

    // Check navigation elements
    await expect(homePage.loginButton).toBeVisible();
    await expect(homePage.signupButton).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    const homePage = new HomePage(page);
    const loginPage = new LoginPage(page);

    await homePage.goto();
    await homePage.clickLogin();

    // Verify we're on the login page
    await loginPage.waitForLoad();
    expect(page.url()).toContain('/login');
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(testUsers.user.username, testUsers.user.password);

    // Should redirect to dashboard/home after login
    await page.waitForURL(/\/(dashboard|home|$)/, {
      timeout: testData.timeouts.navigation,
    });

    // Verify user is logged in
    const isLoggedIn = await AuthUtils.isLoggedIn(page);
    expect(isLoggedIn).toBe(true);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('invaliduser', 'invalidpass');

    // Should stay on login page and show error
    await expect(loginPage.errorMessage).toBeVisible();
    const errorText = await loginPage.getErrorMessage();
    expect(errorText).toContain('Invalid credentials');
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await AuthUtils.loginUser(page, testUsers.user.username, testUsers.user.password);

    // Verify logged in
    let isLoggedIn = await AuthUtils.isLoggedIn(page);
    expect(isLoggedIn).toBe(true);

    // Logout
    await AuthUtils.logoutUser(page);

    // Verify logged out
    isLoggedIn = await AuthUtils.isLoggedIn(page);
    expect(isLoggedIn).toBe(false);
  });

  test('should preserve login state on page refresh', async ({ page }) => {
    // Login
    await AuthUtils.loginUser(page, testUsers.user.username, testUsers.user.password);

    // Verify logged in
    let isLoggedIn = await AuthUtils.isLoggedIn(page);
    expect(isLoggedIn).toBe(true);

    // Refresh page
    await page.reload();

    // Should still be logged in
    isLoggedIn = await AuthUtils.isLoggedIn(page);
    expect(isLoggedIn).toBe(true);
  });

  test('should redirect to login when accessing protected routes', async ({ page }) => {
    // Try to access a protected route without being logged in
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL(/\/login/, {
      timeout: testData.timeouts.navigation,
    });

    const loginPage = new LoginPage(page);
    await expect(loginPage.usernameInput).toBeVisible();
  });
});
