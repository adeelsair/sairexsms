/**
 * SAIREX SMS - Users & Invites Page Test
 * Tests the Users & Invites functionality
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'admin@sairex-sms.com';
const TEST_PASSWORD = 'Admin@123';

function log(message, type = 'info') {
  const symbols = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    test: '→',
    header: '═'
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

async function runTests() {
  printHeader('SAIREX SMS - Users & Invites Page Test');
  
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
      headless: false,
      args: ['--start-maximized'],
      defaultViewport: null
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // ========================================================================
    // STEP 1: Login as Super Admin
    // ========================================================================
    printSubHeader('STEP 1: Login as Super Admin');
    testResults.total++;
    
    try {
      log('Navigating to login page...', 'test');
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
      
      log(`Filling credentials: ${TEST_EMAIL}`, 'test');
      await page.type('input[type="email"], input#email', TEST_EMAIL);
      await page.type('input[type="password"], input#password', TEST_PASSWORD);
      
      log('Clicking Sign in button...', 'test');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
        page.click('button[type="submit"]')
      ]);
      
      await sleep(2000);
      
      const currentUrl = page.url();
      if (currentUrl.includes('/admin')) {
        log('✓ PASS: Successfully logged in as Super Admin', 'success');
        log(`  Current URL: ${currentUrl}`, 'info');
        testResults.passed++;
        testResults.tests.push({
          name: 'Login as Super Admin',
          status: 'PASS',
          details: 'Successfully authenticated'
        });
      } else {
        throw new Error(`Login failed, current URL: ${currentUrl}`);
      }
    } catch (error) {
      log(`✗ FAIL: ${error.message}`, 'error');
      testResults.failed++;
      testResults.tests.push({
        name: 'Login as Super Admin',
        status: 'FAIL',
        details: error.message
      });
      throw error; // Stop if login fails
    }

    // ========================================================================
    // STEP 2: Navigate to Users & Invites
    // ========================================================================
    printSubHeader('STEP 2: Navigate to Users & Invites');
    testResults.total++;
    
    try {
      log('Looking for "Users & Invites" link in sidebar...', 'test');
      
      // Get all sidebar links
      const sidebarText = await page.evaluate(() => {
        const sidebar = document.querySelector('aside');
        return sidebar ? sidebar.innerText : '';
      });
      
      log(`Sidebar content preview: ${sidebarText.substring(0, 200)}...`, 'info');
      
      // Try to find and click Users & Invites link
      const usersLinkClicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const usersLink = links.find(link => 
          link.textContent.toLowerCase().includes('users') ||
          link.textContent.toLowerCase().includes('invite')
        );
        if (usersLink) {
          usersLink.click();
          return true;
        }
        return false;
      });
      
      if (!usersLinkClicked) {
        // Try navigating directly
        log('Link not found in sidebar, navigating directly...', 'info');
        await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle2' });
      } else {
        await sleep(2000);
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
      }
      
      await sleep(1000);
      const currentUrl = page.url();
      
      log(`Current URL: ${currentUrl}`, 'info');
      
      // Check page content
      const pageContent = await page.evaluate(() => document.body.innerText);
      
      // Check for table columns
      const hasEmailColumn = pageContent.includes('Email') || pageContent.includes('email');
      const hasRoleColumn = pageContent.includes('Role') || pageContent.includes('role');
      const hasOrganizationColumn = pageContent.includes('Organization') || pageContent.includes('organization');
      const hasCampusColumn = pageContent.includes('Campus') || pageContent.includes('campus');
      const hasStatusColumn = pageContent.includes('Status') || pageContent.includes('status');
      const hasActionColumn = pageContent.includes('Action') || pageContent.includes('action');
      
      // Check for Lock/Unlock buttons
      const hasLockButton = pageContent.includes('Lock') || pageContent.includes('lock');
      const hasUnlockButton = pageContent.includes('Unlock') || pageContent.includes('unlock');
      
      log('Checking Users & Invites page elements:', 'test');
      log(`  Email column: ${hasEmailColumn ? '✓' : '✗'}`, hasEmailColumn ? 'success' : 'error');
      log(`  Role column: ${hasRoleColumn ? '✓' : '✗'}`, hasRoleColumn ? 'success' : 'error');
      log(`  Organization column: ${hasOrganizationColumn ? '✓' : '✗'}`, hasOrganizationColumn ? 'success' : 'error');
      log(`  Campus column: ${hasCampusColumn ? '✓' : '✗'}`, hasCampusColumn ? 'success' : 'error');
      log(`  Status column: ${hasStatusColumn ? '✓' : '✗'}`, hasStatusColumn ? 'success' : 'error');
      log(`  Action column: ${hasActionColumn ? '✓' : '✗'}`, hasActionColumn ? 'success' : 'error');
      log(`  Lock/Unlock buttons: ${hasLockButton || hasUnlockButton ? '✓' : '✗'}`, (hasLockButton || hasUnlockButton) ? 'success' : 'error');
      
      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/users-page.png', fullPage: true });
      log('Screenshot saved: users-page.png', 'info');
      
      const allColumnsPresent = hasEmailColumn && hasRoleColumn && hasOrganizationColumn && 
                                hasCampusColumn && hasStatusColumn && hasActionColumn;
      
      if (currentUrl.includes('/users') || allColumnsPresent) {
        log('✓ PASS: Users & Invites page loaded with expected elements', 'success');
        testResults.passed++;
        testResults.tests.push({
          name: 'Navigate to Users & Invites',
          status: 'PASS',
          details: `Found columns: Email(${hasEmailColumn}), Role(${hasRoleColumn}), Organization(${hasOrganizationColumn}), Campus(${hasCampusColumn}), Status(${hasStatusColumn}), Action(${hasActionColumn}), Lock/Unlock(${hasLockButton || hasUnlockButton})`
        });
      } else {
        throw new Error('Users & Invites page not found or missing expected elements');
      }
    } catch (error) {
      log(`✗ FAIL: ${error.message}`, 'error');
      await page.screenshot({ path: 'test-screenshots/users-page-error.png', fullPage: true });
      testResults.failed++;
      testResults.tests.push({
        name: 'Navigate to Users & Invites',
        status: 'FAIL',
        details: error.message
      });
    }

    // ========================================================================
    // STEP 3: Test the Invite Form
    // ========================================================================
    printSubHeader('STEP 3: Test Invite Form');
    testResults.total++;
    
    try {
      log('Looking for "+ Invite User" button...', 'test');
      
      // Find and click invite button
      const inviteButtonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const inviteBtn = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('invite') ||
          btn.textContent.includes('+')
        );
        if (inviteBtn) {
          inviteBtn.click();
          return true;
        }
        return false;
      });
      
      if (!inviteButtonClicked) {
        throw new Error('Invite User button not found');
      }
      
      await sleep(2000);
      
      // Check for form elements
      const formElements = await page.evaluate(() => {
        const body = document.body.innerText;
        return {
          hasOrganization: body.toLowerCase().includes('organization'),
          hasCampus: body.toLowerCase().includes('campus') || body.toLowerCase().includes('school'),
          hasEmail: body.toLowerCase().includes('email'),
          hasRole: body.toLowerCase().includes('role'),
          hasSendButton: body.toLowerCase().includes('send') || body.toLowerCase().includes('invite')
        };
      });
      
      log('Checking invite form elements:', 'test');
      log(`  Organization dropdown: ${formElements.hasOrganization ? '✓' : '✗'}`, formElements.hasOrganization ? 'success' : 'error');
      log(`  Campus/School dropdown: ${formElements.hasCampus ? '✓' : '✗'}`, formElements.hasCampus ? 'success' : 'error');
      log(`  Email field: ${formElements.hasEmail ? '✓' : '✗'}`, formElements.hasEmail ? 'success' : 'error');
      log(`  Role field: ${formElements.hasRole ? '✓' : '✗'}`, formElements.hasRole ? 'success' : 'error');
      log(`  Send Invite button: ${formElements.hasSendButton ? '✓' : '✗'}`, formElements.hasSendButton ? 'success' : 'error');
      
      await page.screenshot({ path: 'test-screenshots/invite-form.png', fullPage: true });
      log('Screenshot saved: invite-form.png', 'info');
      
      const allFormElementsPresent = formElements.hasOrganization && formElements.hasCampus && 
                                     formElements.hasEmail && formElements.hasRole && 
                                     formElements.hasSendButton;
      
      if (allFormElementsPresent) {
        log('✓ PASS: Invite form has all expected elements', 'success');
        testResults.passed++;
        testResults.tests.push({
          name: 'Test Invite Form',
          status: 'PASS',
          details: 'All form elements present: Organization, Campus, Email, Role, Send button'
        });
      } else {
        throw new Error('Invite form missing some expected elements');
      }
      
      // Close the form/modal
      await page.keyboard.press('Escape');
      await sleep(1000);
      
    } catch (error) {
      log(`✗ FAIL: ${error.message}`, 'error');
      await page.screenshot({ path: 'test-screenshots/invite-form-error.png', fullPage: true });
      testResults.failed++;
      testResults.tests.push({
        name: 'Test Invite Form',
        status: 'FAIL',
        details: error.message
      });
    }

    // ========================================================================
    // STEP 4: Test Lock/Unlock Functionality
    // ========================================================================
    printSubHeader('STEP 4: Test Lock/Unlock Functionality');
    testResults.total++;
    
    try {
      log('Looking for users in the table (excluding admin@sairex-sms.com)...', 'test');
      
      // Get all users from the table
      const users = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));
        const userList = [];
        
        rows.forEach(row => {
          const text = row.innerText || row.textContent;
          if (text.includes('@') && !text.includes('admin@sairex-sms.com')) {
            userList.push(text);
          }
        });
        
        return userList;
      });
      
      log(`Found ${users.length} non-admin users`, 'info');
      
      if (users.length === 0) {
        log('⚠ SKIP: No other users found to test Lock/Unlock functionality', 'info');
        testResults.tests.push({
          name: 'Test Lock/Unlock Functionality',
          status: 'SKIP',
          details: 'No non-admin users available for testing'
        });
      } else {
        log(`Testing with user: ${users[0].substring(0, 50)}...`, 'info');
        
        // Try to find and click Lock button
        const lockResult = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const lockBtn = buttons.find(btn => 
            btn.textContent.toLowerCase().includes('lock') &&
            !btn.textContent.toLowerCase().includes('unlock')
          );
          if (lockBtn) {
            lockBtn.click();
            return { found: true, clicked: true };
          }
          return { found: false, clicked: false };
        });
        
        if (!lockResult.found) {
          throw new Error('Lock button not found');
        }
        
        log('Clicked Lock button, waiting for status update...', 'test');
        await sleep(2000);
        
        // Check if status changed to Locked
        const pageContent = await page.evaluate(() => document.body.innerText);
        const hasLockedStatus = pageContent.toLowerCase().includes('locked');
        const hasUnlockButton = pageContent.toLowerCase().includes('unlock');
        
        await page.screenshot({ path: 'test-screenshots/user-locked.png', fullPage: true });
        log('Screenshot saved: user-locked.png', 'info');
        
        log(`  Status changed to Locked: ${hasLockedStatus ? '✓' : '✗'}`, hasLockedStatus ? 'success' : 'error');
        log(`  Unlock button visible: ${hasUnlockButton ? '✓' : '✗'}`, hasUnlockButton ? 'success' : 'error');
        
        if (hasLockedStatus && hasUnlockButton) {
          log('✓ Lock functionality working', 'success');
          
          // Now unlock the user
          log('Clicking Unlock button to restore user...', 'test');
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const unlockBtn = buttons.find(btn => 
              btn.textContent.toLowerCase().includes('unlock')
            );
            if (unlockBtn) {
              unlockBtn.click();
            }
          });
          
          await sleep(2000);
          
          const pageContentAfterUnlock = await page.evaluate(() => document.body.innerText);
          const isActive = pageContentAfterUnlock.toLowerCase().includes('active');
          
          await page.screenshot({ path: 'test-screenshots/user-unlocked.png', fullPage: true });
          log('Screenshot saved: user-unlocked.png', 'info');
          
          log(`  Status restored to Active: ${isActive ? '✓' : '✗'}`, isActive ? 'success' : 'error');
          
          if (isActive) {
            log('✓ PASS: Lock/Unlock functionality working correctly', 'success');
            testResults.passed++;
            testResults.tests.push({
              name: 'Test Lock/Unlock Functionality',
              status: 'PASS',
              details: 'Successfully locked and unlocked user'
            });
          } else {
            throw new Error('User not restored to Active status after unlock');
          }
        } else {
          throw new Error('Lock functionality did not work as expected');
        }
      }
    } catch (error) {
      log(`✗ FAIL: ${error.message}`, 'error');
      await page.screenshot({ path: 'test-screenshots/lock-unlock-error.png', fullPage: true });
      testResults.failed++;
      testResults.tests.push({
        name: 'Test Lock/Unlock Functionality',
        status: 'FAIL',
        details: error.message
      });
    }

    // ========================================================================
    // STEP 5: Logout
    // ========================================================================
    printSubHeader('STEP 5: Logout');
    
    try {
      log('Clicking Logout button...', 'test');
      
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
      
      await sleep(2000);
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
      
      const currentUrl = page.url();
      log(`Current URL after logout: ${currentUrl}`, 'info');
      
      await page.screenshot({ path: 'test-screenshots/after-logout.png', fullPage: true });
      log('Screenshot saved: after-logout.png', 'info');
      
    } catch (error) {
      log(`Logout error: ${error.message}`, 'error');
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
  if (testResults.passed + testResults.failed < testResults.total) {
    console.log(`Skipped: ${testResults.total - testResults.passed - testResults.failed} ⚠`);
  }
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  console.log('\n' + '-'.repeat(70));
  console.log('Detailed Results:');
  console.log('-'.repeat(70));
  
  testResults.tests.forEach((test, index) => {
    const symbol = test.status === 'PASS' ? '✓' : test.status === 'SKIP' ? '⚠' : '✗';
    console.log(`\n${index + 1}. ${test.name}: ${symbol} ${test.status}`);
    console.log(`   ${test.details}`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('Screenshots saved in: test-screenshots/');
  console.log('='.repeat(70));
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
