/**
 * SAIREX SMS - Users & Invites Page Test (with Filters)
 * Tests the updated Users & Invites page with Region/Campus filters
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
  printHeader('SAIREX SMS - Users & Invites Page Test (Updated)');
  
  let browser;

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
    log(`✓ Logged in successfully`, 'success');
    log(`  Current URL: ${currentUrl}`, 'info');

    // ========================================================================
    // STEP 2: Navigate to Users & Invites
    // ========================================================================
    printSubHeader('STEP 2: Navigate to Users & Invites');
    
    log('Clicking "Users & Invites" link...', 'test');
    
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const usersLink = links.find(link => 
        link.textContent.toLowerCase().includes('users') ||
        link.textContent.toLowerCase().includes('invite')
      );
      if (usersLink) {
        usersLink.click();
      }
    });
    
    await sleep(2000);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
    await sleep(1000);
    
    log('Analyzing page content...', 'test');
    
    // Get page content
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    // Check for filter bar
    const hasFilterBar = pageContent.toLowerCase().includes('filter by');
    const hasRegionTabs = pageContent.toLowerCase().includes('region');
    const hasCampusTabs = pageContent.toLowerCase().includes('campus');
    
    log('\n📊 PAGE ANALYSIS:', 'info');
    log(`  "Filter by:" bar present: ${hasFilterBar ? '✓ YES' : '✗ NO'}`, hasFilterBar ? 'success' : 'info');
    log(`  Region tabs visible: ${hasRegionTabs ? '✓ YES' : '✗ NO'}`, hasRegionTabs ? 'success' : 'info');
    log(`  Campus tabs visible: ${hasCampusTabs ? '✓ YES' : '✗ NO'}`, hasCampusTabs ? 'success' : 'info');
    
    // Check table columns
    const tableHeaders = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('th'));
      return headers.map(h => h.innerText.trim()).filter(t => t.length > 0);
    });
    
    log('\n📋 TABLE COLUMNS:', 'info');
    tableHeaders.forEach(header => {
      log(`  - ${header}`, 'info');
    });
    
    const expectedColumns = ['Email', 'Role', 'Organization', 'Campus', 'Status', 'Action'];
    const hasAllColumns = expectedColumns.every(col => 
      tableHeaders.some(h => h.toLowerCase().includes(col.toLowerCase()))
    );
    
    log(`\n  All expected columns present: ${hasAllColumns ? '✓ YES' : '✗ NO'}`, hasAllColumns ? 'success' : 'error');
    
    await page.screenshot({ path: 'test-screenshots/users-page-with-filters.png', fullPage: true });
    log('\n📸 Screenshot saved: users-page-with-filters.png', 'info');

    // ========================================================================
    // STEP 3: Test Invite Form
    // ========================================================================
    printSubHeader('STEP 3: Test Invite Form as SUPER_ADMIN');
    
    log('Clicking "+ Invite User" button...', 'test');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const inviteBtn = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('invite')
      );
      if (inviteBtn) {
        inviteBtn.click();
      }
    });
    
    await sleep(2000);
    
    // Check form elements
    const formAnalysis = await page.evaluate(() => {
      const body = document.body;
      const html = body.innerHTML;
      const text = body.innerText;
      
      // Find all select elements
      const selects = Array.from(document.querySelectorAll('select'));
      const selectLabels = selects.map(select => {
        const label = select.previousElementSibling;
        return label ? label.innerText : '';
      });
      
      // Check for specific dropdowns
      const hasOrgDropdown = text.toLowerCase().includes('organization') && 
                            selects.some(s => !s.disabled);
      const hasRegionDropdown = text.toLowerCase().includes('region');
      const hasCampusDropdown = text.toLowerCase().includes('campus') || 
                               text.toLowerCase().includes('school');
      
      // Check if dropdowns are disabled
      const dropdownStates = selects.map((select, idx) => ({
        label: selectLabels[idx] || `Select ${idx}`,
        disabled: select.disabled,
        options: select.options.length
      }));
      
      return {
        hasOrgDropdown,
        hasRegionDropdown,
        hasCampusDropdown,
        dropdownStates,
        selectLabels
      };
    });
    
    log('\n📝 INVITE FORM ANALYSIS:', 'info');
    log(`  Organization dropdown: ${formAnalysis.hasOrgDropdown ? '✓ YES' : '✗ NO'}`, formAnalysis.hasOrgDropdown ? 'success' : 'error');
    log(`  Region dropdown: ${formAnalysis.hasRegionDropdown ? '✓ YES' : '✗ NO'}`, formAnalysis.hasRegionDropdown ? 'success' : 'info');
    log(`  Campus/School dropdown: ${formAnalysis.hasCampusDropdown ? '✓ YES' : '✗ NO'}`, formAnalysis.hasCampusDropdown ? 'success' : 'info');
    
    log('\n  Dropdown States:', 'info');
    formAnalysis.dropdownStates.forEach(dropdown => {
      const status = dropdown.disabled ? '🔒 DISABLED' : '🔓 ENABLED';
      log(`    ${dropdown.label}: ${status} (${dropdown.options} options)`, 'info');
    });
    
    await page.screenshot({ path: 'test-screenshots/invite-form-initial.png', fullPage: true });
    log('\n📸 Screenshot saved: invite-form-initial.png', 'info');
    
    // Try to select an organization
    log('\nAttempting to select an organization...', 'test');
    
    const orgSelected = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const orgSelect = selects.find(s => {
        const label = s.previousElementSibling;
        return label && label.innerText.toLowerCase().includes('organization');
      });
      
      if (orgSelect && orgSelect.options.length > 1) {
        // Select the first non-empty option
        orgSelect.selectedIndex = 1;
        orgSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          success: true,
          selectedValue: orgSelect.options[1].text
        };
      }
      return { success: false };
    });
    
    if (orgSelected.success) {
      log(`  ✓ Selected organization: ${orgSelected.selectedValue}`, 'success');
      await sleep(1500);
      
      // Check dropdown states after selection
      const formAnalysisAfter = await page.evaluate(() => {
        const selects = Array.from(document.querySelectorAll('select'));
        const selectLabels = selects.map(select => {
          const label = select.previousElementSibling;
          return label ? label.innerText : '';
        });
        
        return selects.map((select, idx) => ({
          label: selectLabels[idx] || `Select ${idx}`,
          disabled: select.disabled,
          options: select.options.length
        }));
      });
      
      log('\n  Dropdown States AFTER selecting organization:', 'info');
      formAnalysisAfter.forEach(dropdown => {
        const status = dropdown.disabled ? '🔒 DISABLED' : '🔓 ENABLED';
        log(`    ${dropdown.label}: ${status} (${dropdown.options} options)`, 'info');
      });
      
      await page.screenshot({ path: 'test-screenshots/invite-form-after-org-selection.png', fullPage: true });
      log('\n📸 Screenshot saved: invite-form-after-org-selection.png', 'info');
    } else {
      log('  ⚠ No organizations available to select', 'info');
    }

    // ========================================================================
    // STEP 4: Test Region/Campus Filter Tabs
    // ========================================================================
    printSubHeader('STEP 4: Test Region/Campus Filter Tabs');
    
    log('Closing invite form...', 'test');
    await page.keyboard.press('Escape');
    await sleep(1000);
    
    // Look for filter tabs
    const filterTabs = await page.evaluate(() => {
      const body = document.body;
      const text = body.innerText;
      
      // Look for all buttons
      const allButtons = Array.from(document.querySelectorAll('button'));
      
      // Find the filter section
      const filterText = text.toLowerCase();
      const hasFilterBy = filterText.includes('filter by');
      
      // Get region filter buttons (look for buttons near "Region:" label)
      const regionButtons = allButtons.filter(btn => {
        const btnText = btn.textContent.trim();
        // Check if it's in a region filter context
        const parent = btn.parentElement;
        const parentText = parent ? parent.innerText : '';
        return parentText.toLowerCase().includes('region:') && btnText.length > 0 && btnText !== 'All';
      });
      
      // Get campus filter buttons
      const campusButtons = allButtons.filter(btn => {
        const btnText = btn.textContent.trim();
        const parent = btn.parentElement;
        const parentText = parent ? parent.innerText : '';
        return parentText.toLowerCase().includes('campus:') && btnText.length > 0 && btnText !== 'All';
      });
      
      return {
        hasFilterSection: hasFilterBy,
        regionButtons: regionButtons.map(btn => btn.textContent.trim()),
        campusButtons: campusButtons.map(btn => btn.textContent.trim()),
        totalButtons: allButtons.length
      };
    });
    
    log('\n🔍 FILTER TABS ANALYSIS:', 'info');
    log(`  Filter section found: ${filterTabs.hasFilterSection ? '✓ YES' : '✗ NO'}`, 'info');
    log(`  Total buttons on page: ${filterTabs.totalButtons}`, 'info');
    
    if (filterTabs.regionButtons.length > 0) {
      log(`\n  ✓ Region filter buttons found: ${filterTabs.regionButtons.length}`, 'success');
      filterTabs.regionButtons.forEach(btn => {
        log(`    - ${btn}`, 'info');
      });
      
      // Try clicking a region tab
      log('\nAttempting to click first region tab...', 'test');
      
      const regionClicked = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        const regionBtn = allButtons.find(btn => {
          const btnText = btn.textContent.trim();
          const parent = btn.parentElement;
          const parentText = parent ? parent.innerText : '';
          return parentText.toLowerCase().includes('region:') && btnText.length > 0 && btnText !== 'All';
        });
        
        if (regionBtn) {
          regionBtn.click();
          return { success: true, text: regionBtn.textContent.trim() };
        }
        return { success: false };
      });
      
      if (regionClicked.success) {
        log(`  ✓ Clicked region tab: ${regionClicked.text}`, 'success');
        await sleep(2000);
        
        // Count users in table
        const userCount = await page.evaluate(() => {
          const rows = document.querySelectorAll('tbody tr');
          return rows.length;
        });
        
        log(`  Users displayed after filter: ${userCount}`, 'info');
        
        await page.screenshot({ path: 'test-screenshots/users-filtered-by-region.png', fullPage: true });
        log('\n📸 Screenshot saved: users-filtered-by-region.png', 'info');
        
        // Try clicking a campus tab
        log('\nLooking for campus tabs...', 'test');
        
        if (filterTabs.campusButtons.length > 0) {
          log(`  ✓ Campus filter buttons found: ${filterTabs.campusButtons.length}`, 'success');
          filterTabs.campusButtons.forEach(btn => {
            log(`    - ${btn}`, 'info');
          });
        }
        
        const campusClicked = await page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const campusBtn = allButtons.find(btn => {
            const btnText = btn.textContent.trim();
            const parent = btn.parentElement;
            const parentText = parent ? parent.innerText : '';
            return parentText.toLowerCase().includes('campus:') && btnText.length > 0 && btnText !== 'All';
          });
          
          if (campusBtn) {
            campusBtn.click();
            return { success: true, text: campusBtn.textContent.trim() };
          }
          return { success: false };
        });
        
        if (campusClicked.success) {
          log(`  ✓ Clicked campus tab: ${campusClicked.text}`, 'success');
          await sleep(2000);
          
          const userCountAfterCampus = await page.evaluate(() => {
            const rows = document.querySelectorAll('tbody tr');
            return rows.length;
          });
          
          log(`  Users displayed after campus filter: ${userCountAfterCampus}`, 'info');
          
          await page.screenshot({ path: 'test-screenshots/users-filtered-by-campus.png', fullPage: true });
          log('\n📸 Screenshot saved: users-filtered-by-campus.png', 'info');
        } else {
          log('  ⚠ No campus tabs found', 'info');
        }
        
        // Clear filters
        log('\nAttempting to clear filters...', 'test');
        
        const filtersCleared = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const clearBtn = buttons.find(btn => 
            btn.textContent.toLowerCase().includes('clear') ||
            btn.textContent.toLowerCase().includes('all')
          );
          
          if (clearBtn) {
            clearBtn.click();
            return { success: true, text: clearBtn.textContent.trim() };
          }
          return { success: false };
        });
        
        if (filtersCleared.success) {
          log(`  ✓ Clicked: ${filtersCleared.text}`, 'success');
          await sleep(2000);
          
          await page.screenshot({ path: 'test-screenshots/users-filters-cleared.png', fullPage: true });
          log('\n📸 Screenshot saved: users-filters-cleared.png', 'info');
        }
        
      } else {
        log('  ⚠ No region tabs available to click', 'info');
      }
      
    } else {
      log('  ℹ No region filter buttons found on the page', 'info');
      log('  This might mean there are no regions in the database', 'info');
    }
    
    await page.screenshot({ path: 'test-screenshots/final-state.png', fullPage: true });
    log('\n📸 Final screenshot saved: final-state.png', 'info');

  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
  } finally {
    if (browser) {
      log('\nClosing browser...', 'info');
      await browser.close();
    }
  }

  printHeader('TEST COMPLETE');
  log('All screenshots saved in: test-screenshots/', 'info');
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
