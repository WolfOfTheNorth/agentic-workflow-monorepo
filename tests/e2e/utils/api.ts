// =============================================================================
// API Utilities for E2E Tests
// Common API interaction functions for Playwright tests
// =============================================================================

import { APIResponse, Page } from '@playwright/test';

export class ApiUtils {
  private page: Page;
  private baseURL: string;

  constructor(page: Page, baseURL = 'http://localhost:8000') {
    this.page = page;
    this.baseURL = baseURL;
  }

  async get(endpoint: string, options: Record<string, unknown> = {}) {
    return await this.page.request.get(`${this.baseURL}${endpoint}`, options);
  }

  async post(endpoint: string, data: unknown, options: Record<string, unknown> = {}) {
    return await this.page.request.post(`${this.baseURL}${endpoint}`, {
      data,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  }

  async put(endpoint: string, data: unknown, options: Record<string, unknown> = {}) {
    return await this.page.request.put(`${this.baseURL}${endpoint}`, {
      data,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  }

  async delete(endpoint: string, options: Record<string, unknown> = {}) {
    return await this.page.request.delete(`${this.baseURL}${endpoint}`, options);
  }

  async waitForApi(endpoint: string, expectedStatus = 200, timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.get(`/api${endpoint}`);
        if (response.status() === expectedStatus) {
          return response;
        }
      } catch {
        // Continue waiting
      }

      await this.page.waitForTimeout(1000);
    }

    throw new Error(
      `API endpoint ${endpoint} did not respond with status ${expectedStatus} within ${timeout}ms`
    );
  }

  async healthCheck() {
    try {
      const response = await this.get('/api/health/');
      return response.ok();
    } catch {
      return false;
    }
  }

  static async expectApiResponse(response: APIResponse, expectedStatus = 200) {
    if (response.status() !== expectedStatus) {
      const body = await response.text();
      throw new Error(
        `Expected status ${expectedStatus}, got ${response.status()}. Response: ${body}`
      );
    }
    return response;
  }
}
