import puppeteer from 'puppeteer';

async function testFrontend() {
  let browser;
  try {
    console.log('🚀 Starting browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Listen for console messages before navigation
    page.on('console', msg => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });

    page.on('pageerror', error => {
      console.log('Browser page error:', error.message);
    });

    console.log('📄 Navigating to http://localhost:5173/');
    await page.goto('http://localhost:5173/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('🔍 Checking page content...');

    // Check for the main heading
    const heading = await page.$eval('h1', el => el.textContent).catch(() => null);
    console.log('📝 Main heading:', heading);

    // Check for buttons
    const buttons = await page
      .$$eval('button', buttons => buttons.map(btn => btn.textContent.trim()))
      .catch(() => []);
    console.log('🔘 Buttons found:', buttons);

    // Take a screenshot
    await page.screenshot({ path: 'frontend-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved as frontend-screenshot.png');

    // Check for React errors in console
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });

    // Wait a bit to capture any console errors
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (logs.length > 0) {
      console.log('❌ Console errors found:');
      logs.forEach(log => console.log(`   ${log}`));
    } else {
      console.log('✅ No console errors detected');
    }

    // Check if the page has rendered content
    const bodyText = await page.$eval('body', el => el.textContent).catch(() => '');

    if (bodyText.includes('Welcome to Agentic Workflow')) {
      console.log('✅ Homepage loaded successfully!');
      console.log('✅ Welcome message found');
    } else if (bodyText.trim().length > 10) {
      console.log('⚠️  Page loaded but content may be different than expected');
      console.log('📄 Body content preview:', bodyText.substring(0, 200) + '...');
    } else {
      console.log('❌ Page appears to be blank or not loaded properly');
    }
  } catch (error) {
    console.error('❌ Error testing frontend:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testFrontend();
