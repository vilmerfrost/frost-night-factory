// =============================================================================
// PERFORMANCE AUDITOR - Lighthouse performance benchmarks
// =============================================================================

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';

export interface PerformanceResult {
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    totalBlockingTime: number;
    cumulativeLayoutShift: number;
    speedIndex: number;
  };
  passed: boolean;
  report: string;
}

export async function runPerformanceAudit(
  url: string,
  workspacePath: string
): Promise<PerformanceResult> {
  
  console.log('🔍 [Lighthouse] Running performance audit...');
  
  // ✅ Add Chrome path configuration
  const chromePath = process.env.CHROME_PATH || 
    (process.platform === 'win32' 
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined);
  
  if (chromePath) {
    console.log(`   Using Chrome at: ${chromePath}`);
  }
  
  const chrome = await chromeLauncher.launch({ 
    chromeFlags: ['--headless'],
    chromePath: chromePath, // ✅ Add Chrome path
  });
  
  const options = {
    logLevel: 'error' as const,
    output: 'html' as const,
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
  };
  
  const runnerResult = await lighthouse(url, options);
  
  if (!runnerResult) {
    throw new Error('Lighthouse audit failed');
  }
  
  await chrome.kill();
  
  // Extract scores
  const categories = runnerResult.lhr.categories;
  
  const scores = {
    performance: (categories.performance?.score || 0) * 100,
    accessibility: (categories.accessibility?.score || 0) * 100,
    bestPractices: (categories['best-practices']?.score || 0) * 100,
    seo: (categories.seo?.score || 0) * 100,
  };
  
  // Extract metrics
  const audits = runnerResult.lhr.audits;
  
  const metrics = {
    firstContentfulPaint: audits['first-contentful-paint']?.numericValue || 0,
    largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || 0,
    totalBlockingTime: audits['total-blocking-time']?.numericValue || 0,
    cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || 0,
    speedIndex: audits['speed-index']?.numericValue || 0,
  };
  
  // Save report
  const reportPath = path.join(workspacePath, 'lighthouse-report.html');
  fs.writeFileSync(reportPath, runnerResult.report as string);
  
  // Determine if passed (all scores >= 70)
  const passed = Object.values(scores).every(score => score >= 70);
  
  console.log('\n📊 [Lighthouse] SCORES:');
  console.log(`   Performance: ${scores.performance.toFixed(0)}/100`);
  console.log(`   Accessibility: ${scores.accessibility.toFixed(0)}/100`);
  console.log(`   Best Practices: ${scores.bestPractices.toFixed(0)}/100`);
  console.log(`   SEO: ${scores.seo.toFixed(0)}/100`);
  
  console.log('\n⚡ METRICS:');
  console.log(`   FCP: ${(metrics.firstContentfulPaint / 1000).toFixed(2)}s`);
  console.log(`   LCP: ${(metrics.largestContentfulPaint / 1000).toFixed(2)}s`);
  console.log(`   TBT: ${metrics.totalBlockingTime.toFixed(0)}ms`);
  console.log(`   CLS: ${metrics.cumulativeLayoutShift.toFixed(3)}`);
  
  return {
    scores,
    metrics,
    passed,
    report: reportPath,
  };
}

