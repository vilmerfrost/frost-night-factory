/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// =============================================================================
// PLAYWRIGHT E2E TESTING - Catches broken buttons, 404s, and layout issues
// =============================================================================

import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface PlaywrightTestResult {
  success: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  errors: Array<{
    test: string;
    error: string;
    screenshot?: string;
  }>;
  duration: number;
}

export async function runPlaywrightTests(
  workspacePath: string,
  port: number = 3002
): Promise<PlaywrightTestResult> {
  
  const startTime = Date.now();
  const result: PlaywrightTestResult = {
    success: true,
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
    errors: [],
    duration: 0,
  };
  
  console.log('🎭 [Playwright] Starting E2E test suite...');
  
  // Start dev server
  console.log(`   🚀 Starting dev server on port ${port}...`);
  const serverProcess = spawn('npm', ['run', 'dev', '--', '-p', port.toString()], {
    cwd: workspacePath,
    env: { ...process.env, PORT: port.toString() },
    shell: true,
    detached: true,
  });
  
  // Wait for server
  await waitForServer(`http://localhost:${port}`, 30000);
  console.log('   ✅ Server ready');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  
  try {
    // Generate tests based on discovered routes
    const tests = await generateTestsFromRoutes(workspacePath, page, port);
    
    result.testsRun = tests.length;
    
    // Run each test
    for (const test of tests) {
      try {
        await test.run(page);
        result.testsPassed++;
        console.log(`   ✅ ${test.name}`);
      } catch (error: any) {
        result.testsFailed++;
        result.success = false;
        
        // Take screenshot of failure
        const screenshotDir = path.join(workspacePath, '.playwright-screenshots');
        fs.mkdirSync(screenshotDir, { recursive: true });
        const screenshotPath = path.join(
          screenshotDir,
          `${test.name.replace(/\s+/g, '-')}.png`
        );
        
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        result.errors.push({
          test: test.name,
          error: error.message,
          screenshot: screenshotPath,
        });
        
        console.error(`   ❌ ${test.name}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
    try {
      process.kill(-serverProcess.pid!); // Kill server process group
    } catch {
      // Process might already be dead
    }
  }
  
  result.duration = Date.now() - startTime;
  
  console.log(`\n📊 [Playwright] RESULTS:`);
  console.log(`   Tests run: ${result.testsRun}`);
  console.log(`   Passed: ${result.testsPassed}`);
  console.log(`   Failed: ${result.testsFailed}`);
  console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
  
  return result;
}

// Auto-generate tests from app structure
async function generateTestsFromRoutes(
  workspacePath: string,
  page: Page,
  port: number
): Promise<Array<{ name: string; run: (page: Page) => Promise<void> }>> {
  
  const tests: Array<{ name: string; run: (page: Page) => Promise<void> }> = [];
  
  // 1. Homepage test (always required)
  tests.push({
    name: 'Homepage loads without errors',
    run: async (page) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      
      await page.goto(`http://localhost:${port}`);
      await page.waitForLoadState('networkidle');
      
      // Check for React errors
      const hasError = await page.locator('text=Application error').count();
      if (hasError > 0) {
        throw new Error('React application error detected');
      }
      
      // Check for 404
      const is404 = await page.locator('text=/404|not found/i').count();
      if (is404 > 0) {
        throw new Error('Homepage shows 404 error');
      }
      
      // Check for console errors
      if (errors.length > 0) {
        throw new Error(`Console errors: ${errors.join(', ')}`);
      }
      
      // Verify page has content
      const bodyText = await page.locator('body').textContent();
      if (!bodyText || bodyText.length < 50) {
        throw new Error('Page has minimal content');
      }
    },
  });
  
  // 2. Discover all navigation links
  const appDir = path.join(workspacePath, 'src', 'app');
  const routes = discoverRoutes(appDir);
  
  for (const route of routes) {
    tests.push({
      name: `Route ${route} is accessible`,
      run: async (page) => {
        const response = await page.goto(`http://localhost:${port}${route}`);
        
        if (!response || response.status() === 404) {
          throw new Error(`Route returns 404`);
        }
        
        if (response.status() >= 500) {
          throw new Error(`Server error: ${response.status()}`);
        }
        
        await page.waitForLoadState('networkidle');
        
        // Verify not a blank page
        const bodyText = await page.locator('body').textContent();
        if (!bodyText || bodyText.length < 30) {
          throw new Error('Route returns empty page');
        }
      },
    });
  }
  
  // 3. Test all navigation links work
  tests.push({
    name: 'All navigation links are valid',
    run: async (page) => {
      await page.goto(`http://localhost:${port}`);
      
      const links = await page.locator('a[href^="/"]').all();
      const brokenLinks: string[] = [];
      
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (!href || href === '#') continue;
        
        const response = await page.goto(`http://localhost:${port}${href}`);
        if (!response || response.status() === 404) {
          brokenLinks.push(href);
        }
      }
      
      if (brokenLinks.length > 0) {
        throw new Error(`Broken links: ${brokenLinks.join(', ')}`);
      }
    },
  });
  
  // 4. Responsive design test
  tests.push({
    name: 'Page is responsive (mobile/tablet/desktop)',
    run: async (page) => {
      const viewports = [
        { name: 'Mobile', width: 375, height: 667 },
        { name: 'Tablet', width: 768, height: 1024 },
        { name: 'Desktop', width: 1920, height: 1080 },
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`http://localhost:${port}`);
        await page.waitForLoadState('networkidle');
        
        // Check for horizontal scrollbar (bad on mobile)
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);
        
        if (scrollWidth > clientWidth + 5) {
          throw new Error(`${viewport.name}: Horizontal scroll detected (${scrollWidth}px > ${clientWidth}px)`);
        }
      }
    },
  });
  
  // 5. Accessibility test (basic)
  tests.push({
    name: 'Basic accessibility checks pass',
    run: async (page) => {
      await page.goto(`http://localhost:${port}`);
      
      // Check for missing alt text on images
      const images = await page.locator('img').all();
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        if (!alt) {
          throw new Error('Image missing alt text');
        }
      }
      
      // Check for proper heading hierarchy
      const h1Count = await page.locator('h1').count();
      if (h1Count === 0) {
        throw new Error('Page missing <h1> tag');
      }
      if (h1Count > 1) {
        throw new Error('Page has multiple <h1> tags');
      }
      
      // Check color contrast (basic check)
      const hasLowContrast = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundColor;
          const fg = style.color;
          
          // Very basic check: ensure not white-on-white or black-on-black
          if (
            (bg.includes('255, 255, 255') && fg.includes('255, 255, 255')) ||
            (bg.includes('0, 0, 0') && fg.includes('0, 0, 0'))
          ) {
            return true;
          }
        }
        return false;
      });
      
      if (hasLowContrast) {
        throw new Error('Low color contrast detected');
      }
    },
  });
  
  return tests;
}

// Helper: Discover all Next.js routes
function discoverRoutes(appDir: string, baseRoute: string = ''): string[] {
  const routes: string[] = [];
  
  if (!fs.existsSync(appDir)) return routes;
  
  const items = fs.readdirSync(appDir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isDirectory() && !item.name.startsWith('_') && !item.name.startsWith('(')) {
      const routePath = `${baseRoute}/${item.name}`;
      const pagePath = path.join(appDir, item.name, 'page.tsx');
      
      if (fs.existsSync(pagePath)) {
        routes.push(routePath);
      }
      
      // Recurse into subdirectories
      routes.push(...discoverRoutes(path.join(appDir, item.name), routePath));
    }
  }
  
  return routes;
}

function waitForServer(url: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    const check = async () => {
      try {
        const response = await fetch(url);
        if (response.ok || response.status === 404) {
          resolve();
        } else {
          throw new Error('Server not ready');
        }
      } catch {
        if (Date.now() - start > timeout) {
          reject(new Error('Server timeout'));
        } else {
          setTimeout(check, 500);
        }
      }
    };
    
    check();
  });
}

