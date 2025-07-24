// =============================================================================
// Home Page Object Model
// Encapsulates interactions with the home page
// =============================================================================

import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly loginButton: Locator;
  readonly signupButton: Locator;
  readonly navigationMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.signupButton = page.locator('[data-testid="signup-button"]');
    this.navigationMenu = page.locator('[data-testid="navigation-menu"]');
  }

  async goto() {
    await this.page.goto('/');
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async clickSignup() {
    await this.signupButton.click();
  }

  async waitForLoad() {
    await this.heading.waitFor();
  }

  async getTitle() {
    return await this.page.title();
  }

  async isLoggedIn() {
    return await this.page.locator('[data-testid="user-menu"]').isVisible();
  }
}
