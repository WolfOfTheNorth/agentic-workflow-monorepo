# Testing Guide

## Overview

This monorepo uses a comprehensive testing strategy with multiple types of tests across different packages and applications.

## Testing Stack

- **Jest**: Unit and integration testing
- **Playwright**: End-to-end testing
- **React Testing Library**: Component testing
- **Supertest**: API testing

## Test Types

### 1. Unit Tests

- Test individual functions, components, and modules
- Located in each package's `tests/` directory
- Run with: `pnpm test:unit`

### 2. Integration Tests

- Test cross-package interactions
- Located in `tests/integration/`
- Run with: `pnpm test:integration`

### 3. End-to-End Tests

- Test complete user workflows
- Located in `tests/e2e/`
- Run with: `pnpm test:e2e`

## Running Tests

```bash
# Run all tests
pnpm test:all

# Run specific test types
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific packages
pnpm test:frontend
pnpm test:backend
pnpm test:packages

# Run E2E tests with UI
pnpm test:e2e:ui
```

## Writing Tests

### Unit Tests

```typescript
import { describe, it, expect } from '@jest/globals';
import { validateEmail } from '@shared/utils/validation';

describe('validateEmail', () => {
  it('should validate correct email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from '@ui/components/Button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="username"]', 'testuser');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="submit"]');

  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
});
```

## Configuration

### Jest Configuration

- Base configuration: `configs/testing/jest.base.js`
- Node.js environment: `configs/testing/jest.node.js`
- JSDOM environment: `configs/testing/jest.jsdom.js`

### Playwright Configuration

- Configuration: `playwright.config.ts`
- Global setup: `tests/e2e/global-setup.ts`
- Global teardown: `tests/e2e/global-teardown.ts`

## Test Utilities

### Shared Utilities

- Test helpers: `tests/shared/utils/test-helpers.ts`
- API fixtures: `tests/shared/fixtures/api-fixtures.ts`
- Mock clients: `tests/shared/mocks/api-client.ts`

### E2E Utilities

- Page objects: `tests/e2e/page-objects/`
- Auth utilities: `tests/e2e/utils/auth.ts`
- API utilities: `tests/e2e/utils/api.ts`

## Best Practices

### General

1. Write tests that are independent and can run in any order
2. Use descriptive test names and organize with `describe` blocks
3. Keep tests focused on a single concern
4. Use appropriate test data and fixtures

### Unit Tests

1. Mock external dependencies
2. Test both happy path and error scenarios
3. Aim for high code coverage on critical paths
4. Use shared test utilities for common operations

### Integration Tests

1. Test cross-package interactions
2. Verify data flows between components
3. Test error propagation across boundaries
4. Use realistic test scenarios

### E2E Tests

1. Test complete user workflows
2. Use page object models for maintainability
3. Include both positive and negative test cases
4. Test across different browsers and devices

## CI/CD Integration

Tests are automatically run in the CI/CD pipeline:

```bash
# CI test command
pnpm test:ci
```

This runs:

1. Unit tests with coverage reporting
2. Integration tests
3. E2E tests with JUnit reporting

## Debugging Tests

### Jest Tests

```bash
# Run specific test file
pnpm test path/to/test.spec.ts

# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run with verbose output
pnpm test --verbose
```

### Playwright Tests

```bash
# Run in headed mode
pnpm test:e2e --headed

# Run with debug mode
pnpm test:e2e --debug

# Run specific test
pnpm test:e2e tests/e2e/auth.spec.ts
```

## Performance Testing

E2E tests include basic performance checks:

```typescript
test('page loads within acceptable time', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(3000);
});
```

## Accessibility Testing

E2E tests include accessibility checks:

```typescript
test('page meets accessibility standards', async ({ page }) => {
  await page.goto('/');

  // Check for proper heading structure
  const h1Count = await page.locator('h1').count();
  expect(h1Count).toBeGreaterThan(0);

  // Check for form labels
  const inputs = page.locator('input');
  // ... accessibility assertions
});
```

## Troubleshooting

### Common Issues

1. **Tests timing out**: Increase timeout values or check for race conditions
2. **Flaky tests**: Add proper wait conditions and stabilize test data
3. **Cross-package import errors**: Verify path mappings in Jest config
4. **E2E setup failures**: Check that services are running and accessible

### Getting Help

1. Check test logs for detailed error messages
2. Run tests in debug mode for step-by-step execution
3. Verify environment setup and dependencies
4. Check configuration files for correct paths and settings
