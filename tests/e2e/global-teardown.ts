// =============================================================================
// Playwright Global Teardown
// Runs once after all tests
// =============================================================================

import { chromium } from '@playwright/test';

async function globalTeardown() {
  console.log('🧹 Starting global teardown...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await cleanupTestData(page);

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  } finally {
    await browser.close();
  }
}

async function cleanupTestData(page: unknown) {
  try {
    // Remove test user if needed
    await page.request.delete('http://localhost:8000/api/auth/users/testuser/', {
      headers: {
        Authorization: 'Bearer test-token', // You'd get this from login
      },
    });

    console.log('✅ Test data cleaned up');
  } catch {
    console.log('ℹ️ Test data cleanup failed, but continuing...');
  }
}

export default globalTeardown;
