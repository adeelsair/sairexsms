/**
 * SAIREX SMS - Full Authentication Flow Test
 * Tests all authentication scenarios with screenshots
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots');

// Test credentials
const TEST_EMAIL = 'admin@sairex-sms.com';
const TEST_PASSWORD = 'Admin@123';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const symbols = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    test: '→'
  };
  console.log(`${symbols[type]} ${message}`);
}

function printHeader(title) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

function printSubHeader(title) {
  console.log('\n' + '-'.repeat(70));
  console.log(title);
  console.log('-'.repeat(70));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name, description) {
  const filename = `${name}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  log(`Screenshot saved: ${filename} - ${description}`, 'info');
  return filepath;
}

async function runTests() {
  printHeader('SAIREX SMS - Authentication Flow Test Suite');
  
  let browser;
  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    log('Launching browser...', 'info');
    browser = await puppeteer.launch({
      headless: false, // Set to true for headless mode
      args: ['--start-maximized'],
      defaultViewport: null
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // ========================================================================
    // TEST 1: Route Protection - Redirect to Login
    // ========================================================================
    printSubHeader('TEST 1: Route Protection');
    testResults.total++;
    
    try {
      log('Navigating to /admin/dashboard without authentication...', 'test');
      await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle2' });
      
      const currentUrl = page.url();
      await takeScreenshot(page, '01-route-protection', 'Should redirect to login');
      
      if (currentUrl.includes('/login')) {
        log(`✓ PASS: Redirected to login page`, 'success');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.passed++;
        testResults.tests.push({
          name: 'Route Protection',
          status: 'PASS',
          details: `Redirected to ${currentUrl}`
        });
      } else {
        log(`✗ FAIL: Did not redirect to login`, 'error');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.failed++;
        testResults.tests.push({
          name: 'Route Protection',
          status: 'FAIL',
          details: `Expected /login, got ${currentUrl}`
        });
      }
    } catch (error) {
      log(`✗ ERROR: ${error.message}`, 'error');
      testResults.failed++;
      testResults.tests.push({
        name: 'Route Protection',
        status: 'ERROR',
        details: error.message
      });
    }

    // ========================================================================
    // TEST 2: Login Page Elements
    // ========================================================================
    printSubHeader('TEST 2: Login Page Elements');
    testResults.total++;
    
    try {
      log('Checking login page elements...', 'test');
      
      // Check for email input
      const emailInput = await page.$('input[type="email"], input#email');
      const passwordInput = await page.$('input[type="password"], input#password');
      const submitButton = await page.$('button[type="submit"]');
      
      await takeScreenshot(page, '02-login-page', 'Login page with form elements');
      
      const hasEmail = emailInput !== null;
      const hasPassword = passwordInput !== null;
      const hasSubmit = submitButton !== null;
      
      log(`  Email field: ${hasEmail ? '✓' : '✗'}`, hasEmail ? 'success' : 'error');
      log(`  Password field: ${hasPassword ? '✓' : '✗'}`, hasPassword ? 'success' : 'error');
      log(`  Submit button: ${hasSubmit ? '✓' : '✗'}`, hasSubmit ? 'success' : 'error');
      
      if (hasEmail && hasPassword && hasSubmit) {
        log('✓ PASS: All login form elements present', 'success');
        testResults.passed++;
        testResults.tests.push({
          name: 'Login Page Elements',
          status: 'PASS',
          details: 'Email, password, and submit button found'
        });
      } else {
        log('✗ FAIL: Missing login form elements', 'error');
        testResults.failed++;
        testResults.tests.push({
          name: 'Login Page Elements',
          status: 'FAIL',
          details: 'Some form elements missing'
        });
      }
    } catch (error) {
      log(`✗ ERROR: ${error.message}`, 'error');
      testResults.failed++;
      testResults.tests.push({
        name: 'Login Page Elements',
        status: 'ERROR',
        details: error.message
      });
    }

    // ========================================================================
    // TEST 3: Login with Valid Credentials
    // ========================================================================
    printSubHeader('TEST 3: Login with Valid Credentials');
    testResults.total++;
    
    try {
      log('Filling in login credentials...', 'test');
      log(`  Email: ${TEST_EMAIL}`, 'info');
      log(`  Password: ${TEST_PASSWORD}`, 'info');
      
      // Fill in the form
      await page.type('input[type="email"], input#email', TEST_EMAIL);
      await page.type('input[type="password"], input#password', TEST_PASSWORD);
      
      await takeScreenshot(page, '03-login-filled', 'Login form filled');
      
      log('Clicking Sign in button...', 'test');
      
      // Click submit and wait for navigation
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
        page.click('button[type="submit"]')
      ]);
      
      await sleep(2000); // Wait for any client-side rendering
      
      const currentUrl = page.url();
      await takeScreenshot(page, '04-after-login', 'Page after login');
      
      if (currentUrl.includes('/admin')) {
        log(`✓ PASS: Successfully logged in and redirected to admin area`, 'success');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.passed++;
        testResults.tests.push({
          name: 'Login with Valid Credentials',
          status: 'PASS',
          details: `Redirected to ${currentUrl}`
        });
      } else {
        log(`✗ FAIL: Login did not redirect to admin area`, 'error');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.failed++;
        testResults.tests.push({
          name: 'Login with Valid Credentials',
          status: 'FAIL',
          details: `Expected /admin/*, got ${currentUrl}`
        });
      }
    } catch (error) {
      log(`✗ ERROR: ${error.message}`, 'error');
      await takeScreenshot(page, '04-login-error', 'Login error state');
      testResults.failed++;
      testResults.tests.push({
        name: 'Login with Valid Credentials',
        status: 'ERROR',
        details: error.message
      });
    }

    // ========================================================================
    // TEST 4: Session Info in Sidebar
    // ========================================================================
    printSubHeader('TEST 4: Session Info in Sidebar');
    testResults.total++;
    
    try {
      log('Checking sidebar for user information...', 'test');
      
      // Wait for sidebar to load
      await page.waitForSelector('aside', { timeout: 5000 });
      
      // Get all text content from the sidebar
      const sidebarText = await page.evaluate(() => {
        const sidebar = document.querySelector('aside');
        return sidebar ? sidebar.innerText : '';
      });
      
      await takeScreenshot(page, '05-sidebar-session', 'Sidebar with user info');
      
      const hasEmail = sidebarText.includes(TEST_EMAIL);
      const hasRole = sidebarText.includes('SUPER') || sidebarText.includes('ADMIN');
      
      log(`  Email displayed (${TEST_EMAIL}): ${hasEmail ? '✓' : '✗'}`, hasEmail ? 'success' : 'error');
      log(`  Role displayed: ${hasRole ? '✓' : '✗'}`, hasRole ? 'success' : 'error');
      
      if (hasEmail && hasRole) {
        log('✓ PASS: User session info displayed correctly', 'success');
        testResults.passed++;
        testResults.tests.push({
          name: 'Session Info in Sidebar',
          status: 'PASS',
          details: 'Email and role displayed'
        });
      } else {
        log('✗ FAIL: Missing user session information', 'error');
        log(`  Sidebar content: ${sidebarText.substring(0, 200)}...`, 'info');
        testResults.failed++;
        testResults.tests.push({
          name: 'Session Info in Sidebar',
          status: 'FAIL',
          details: `Email: ${hasEmail}, Role: ${hasRole}`
        });
      }
    } catch (error) {
      log(`✗ ERROR: ${error.message}`, 'error');
      testResults.failed++;
      testResults.tests.push({
        name: 'Session Info in Sidebar',
        status: 'ERROR',
        details: error.message
      });
    }

    // ========================================================================
    // TEST 5: Logout Functionality
    // ========================================================================
    printSubHeader('TEST 5: Logout Functionality');
    testResults.total++;
    
    try {
      log('Looking for Logout button...', 'test');
      await takeScreenshot(page, '06-before-logout', 'Before logout');
      
      // Find logout button by text content
      const logoutButtonExists = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const logoutBtn = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('logout') ||
          btn.textContent.includes('🚪')
        );
        return !!logoutBtn;
      });
      
      if (!logoutButtonExists) {
        throw new Error('Logout button not found in page');
      }
      
      log('Clicking Logout button...', 'test');
      
      // Click the logout button using page.evaluate
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const logoutBtn = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('logout') ||
          btn.textContent.includes('🚪')
        );
        if (logoutBtn) {
          logoutBtn.click();
        }
      });
      
      // Wait for navigation with timeout
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 });
      } catch (navError) {
        log('Navigation timeout, checking current URL...', 'info');
      }
      
      await sleep(2000);
      
      const currentUrl = page.url();
      await takeScreenshot(page, '07-after-logout', 'After logout');
      
      if (currentUrl.includes('/login')) {
        log(`✓ PASS: Successfully logged out and redirected to login`, 'success');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.passed++;
        testResults.tests.push({
          name: 'Logout Functionality',
          status: 'PASS',
          details: `Redirected to ${currentUrl}`
        });
      } else {
        log(`✗ FAIL: Logout did not redirect to login page`, 'error');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.failed++;
        testResults.tests.push({
          name: 'Logout Functionality',
          status: 'FAIL',
          details: `Expected /login, got ${currentUrl}`
        });
      }
    } catch (error) {
      log(`✗ ERROR: ${error.message}`, 'error');
      await takeScreenshot(page, '07-logout-error', 'Logout error state');
      testResults.failed++;
      testResults.tests.push({
        name: 'Logout Functionality',
        status: 'ERROR',
        details: error.message
      });
    }

    // ========================================================================
    // TEST 6: Post-Logout Route Protection
    // ========================================================================
    printSubHeader('TEST 6: Post-Logout Route Protection');
    testResults.total++;
    
    try {
      log('Attempting to access /admin/dashboard after logout...', 'test');
      await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle2' });
      
      const currentUrl = page.url();
      await takeScreenshot(page, '08-post-logout-protection', 'Route protection after logout');
      
      if (currentUrl.includes('/login')) {
        log(`✓ PASS: Route protection still active after logout`, 'success');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.passed++;
        testResults.tests.push({
          name: 'Post-Logout Route Protection',
          status: 'PASS',
          details: `Redirected to ${currentUrl}`
        });
      } else {
        log(`✗ FAIL: Could access admin route after logout`, 'error');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.failed++;
        testResults.tests.push({
          name: 'Post-Logout Route Protection',
          status: 'FAIL',
          details: `Should redirect to /login, got ${currentUrl}`
        });
      }
    } catch (error) {
      log(`✗ ERROR: ${error.message}`, 'error');
      testResults.failed++;
      testResults.tests.push({
        name: 'Post-Logout Route Protection',
        status: 'ERROR',
        details: error.message
      });
    }

  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
  } finally {
    if (browser) {
      log('Closing browser...', 'info');
      await browser.close();
    }
  }

  // ========================================================================
  // FINAL REPORT
  // ========================================================================
  printHeader('TEST RESULTS SUMMARY');
  
  console.log(`\nTotal Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✓`);
  console.log(`Failed: ${testResults.failed} ✗`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  console.log('\n' + '-'.repeat(70));
  console.log('Detailed Results:');
  console.log('-'.repeat(70));
  
  testResults.tests.forEach((test, index) => {
    const symbol = test.status === 'PASS' ? '✓' : '✗';
    console.log(`\n${index + 1}. ${test.name}: ${symbol} ${test.status}`);
    console.log(`   ${test.details}`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log(`Screenshots saved in: ${SCREENSHOTS_DIR}`);
  console.log('='.repeat(70));
  
  // Save results to JSON
  const resultsFile = path.join(SCREENSHOTS_DIR, 'test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
  log(`Test results saved to: ${resultsFile}`, 'info');
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
