// =============================================================================
// Playwright Global Setup
// Runs once before all tests
// =============================================================================

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');

  // Start browser for setup tasks
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for services to be ready
    console.log('⏳ Waiting for frontend to be ready...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    console.log('⏳ Waiting for backend to be ready...');
    const response = await page.request.get('http://localhost:8000/api/health/', {
      timeout: 60000,
    });

    if (!response.ok()) {
      throw new Error(`Backend health check failed: ${response.status()}`);
    }

    // Seed test data if needed
    console.log('🌱 Seeding test data...');
    await seedTestData(page);

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function seedTestData(page: any) {
  try {
    // Create test user via API
    const testUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpass123',
    };

    await page.request.post('http://localhost:8000/api/auth/register/', {
      data: testUser,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Test user created');
  } catch (error) {
    // It's okay if user already exists
    console.log('ℹ️ Test user might already exist, continuing...');
  }
}

export default globalSetup;
