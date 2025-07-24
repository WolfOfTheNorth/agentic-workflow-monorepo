// =============================================================================
// Authentication Utilities for E2E Tests
// Common authentication functions for Playwright tests
// =============================================================================

import { Page } from '@playwright/test';

export class AuthUtils {
  static async loginUser(page: Page, username: string, password: string) {
    // Go to login page
    await page.goto('/login');

    // Fill login form
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="password-input"]', password);

    // Submit form
    await page.click('[data-testid="login-submit"]');

    // Wait for redirect to dashboard or home
    await page.waitForURL(/\/(dashboard|home|$)/);

    // Verify login success
    await page.waitForSelector('[data-testid="user-menu"]');
  }

  static async logoutUser(page: Page) {
    // Click user menu
    await page.click('[data-testid="user-menu"]');

    // Click logout
    await page.click('[data-testid="logout-button"]');

    // Wait for redirect to home/login
    await page.waitForURL(/\/(login|$)/);
  }

  static async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  static async createTestUser(
    page: Page,
    userData: {
      username: string;
      email: string;
      password: string;
    }
  ) {
    // Register via API
    const response = await page.request.post('/api/auth/register/', {
      data: userData,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create test user: ${response.status()}`);
    }

    return await response.json();
  }

  static async getAuthToken(page: Page, username: string, password: string): Promise<string> {
    const response = await page.request.post('/api/auth/login/', {
      data: { username, password },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to get auth token: ${response.status()}`);
    }

    const data = await response.json();
    return data.token || data.access_token;
  }
}
