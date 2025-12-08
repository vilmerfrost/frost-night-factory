import { chromium } from 'playwright';
/**
 * Run real E2E tests using Playwright
 */
export async function runRealE2ETests(baseUrl, timeout = 60000) {
    const results = [];
    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        // Test 1: Homepage loads
        results.push(await testHomepageLoads(page, baseUrl));
        // Test 2: No console errors
        results.push(await testNoConsoleErrors(page, baseUrl));
        // Test 3: Critical buttons exist
        results.push(await testCriticalElements(page, baseUrl));
        await browser.close();
        const passed = results.every(r => r.startsWith('✅'));
        return { passed, results };
    }
    catch (error) {
        results.push(`❌ E2E test crashed: ${error.message}`);
        if (browser)
            await browser.close();
        return { passed: false, results };
    }
}
/**
 * Test that homepage loads successfully
 */
async function testHomepageLoads(page, baseUrl) {
    try {
        const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
        if (!response || response.status() !== 200) {
            return `❌ Homepage returned ${response?.status()}`;
        }
        const bodyText = await page.textContent('body');
        if (bodyText && bodyText.includes('404') && bodyText.length < 200) {
            return `❌ Homepage shows 404 page`;
        }
        return `✅ Homepage loads successfully`;
    }
    catch (error) {
        return `❌ Homepage failed to load: ${error.message}`;
    }
}
/**
 * Test that there are no console errors
 */
async function testNoConsoleErrors(page, baseUrl) {
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await new Promise(resolve => setTimeout(resolve, 2000)); // ✅ Fixed: Use Promise instead of deprecated waitForTimeout
    if (errors.length > 0) {
        return `❌ Console errors detected: ${errors[0]}`;
    }
    return `✅ No console errors`;
}
/**
 * Test that critical page elements exist
 */
async function testCriticalElements(page, baseUrl) {
    await page.goto(baseUrl);
    // Check for common elements
    const hasNav = await page.locator('nav, header').count() > 0;
    const hasMain = await page.locator('main, [role="main"]').count() > 0;
    if (!hasNav && !hasMain) {
        return `❌ Missing critical page structure`;
    }
    return `✅ Page structure valid`;
}
