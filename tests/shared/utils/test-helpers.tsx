// =============================================================================
// Shared Test Helpers
// Common utilities for testing across all packages
// =============================================================================

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// Extended render function with providers
export interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add provider options here as needed
  initialState?: any;
  route?: string;
}

export function renderWithProviders(ui: ReactElement, options: ExtendedRenderOptions = {}) {
  const { initialState, route = '/', ...renderOptions } = options;

  // Create wrapper with providers
  function Wrapper({ children }: { children: React.ReactNode }) {
    // Add providers here (Router, Redux, Theme, etc.)
    return <div data-testid='test-wrapper'>{children}</div>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Common test utilities
export class TestHelpers {
  // Wait utilities
  static async waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  // Mock data generators
  static generateUser(overrides: Partial<any> = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      username: `user${Math.floor(Math.random() * 1000)}`,
      email: `test${Math.floor(Math.random() * 1000)}@example.com`,
      isActive: true,
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  static generateApiResponse<T>(data: T, overrides: Partial<any> = {}) {
    return {
      data,
      message: 'Success',
      success: true,
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  static generateApiError(message: string = 'Error', code: number = 400) {
    return {
      error: message,
      code,
      success: false,
      timestamp: new Date().toISOString(),
    };
  }

  // Form testing utilities
  static async fillForm(
    getByTestId: (id: string) => HTMLElement,
    formData: Record<string, string>
  ) {
    for (const [field, value] of Object.entries(formData)) {
      const input = getByTestId(`${field}-input`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Local storage utilities
  static mockLocalStorage() {
    const store: Record<string, string> = {};

    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      }),
    };
  }

  // API mocking utilities
  static createMockApiClient() {
    return {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    };
  }

  // Component testing utilities
  static async waitForComponent(
    getByTestId: (id: string) => HTMLElement,
    testId: string,
    timeout = 5000
  ) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        return getByTestId(testId);
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    throw new Error(`Component with testId "${testId}" not found within ${timeout}ms`);
  }

  // Date utilities for testing
  static mockDate(date: string | Date) {
    const mockDate = new Date(date);
    const originalDate = Date;

    // @ts-ignore
    global.Date = class extends Date {
      constructor(dateString?: string | number | Date) {
        if (dateString) {
          super(dateString);
        } else {
          super(mockDate);
        }
      }

      static now() {
        return mockDate.getTime();
      }
    } as DateConstructor;

    return () => {
      global.Date = originalDate;
    };
  }

  // Performance testing utilities
  static measurePerformance<T>(fn: () => T): { result: T; duration: number } {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    return {
      result,
      duration: endTime - startTime,
    };
  }

  // Async testing utilities
  static async expectAsync<T>(promise: Promise<T>, matcher: (value: T) => void) {
    try {
      const result = await promise;
      matcher(result);
    } catch (error) {
      throw new Error(`Async expectation failed: ${error}`);
    }
  }
}

// Custom matchers
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveApiStructure(received: any, expected: string[]) {
    const pass = expected.every(prop => received.hasOwnProperty(prop));
    if (pass) {
      return {
        message: () =>
          `expected object not to have API structure with properties: ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      const missing = expected.filter(prop => !received.hasOwnProperty(prop));
      return {
        message: () =>
          `expected object to have API structure with properties: ${expected.join(', ')}, missing: ${missing.join(', ')}`,
        pass: false,
      };
    }
  },
};

// Re-export testing library utilities
export * from '@testing-library/react';
export { renderWithProviders as render };
