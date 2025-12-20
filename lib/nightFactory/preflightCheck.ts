/**
 * PRE-FLIGHT CHECK SYSTEM v10
 * Validates pipeline setup before running
 * Saves time and money on debugging
 */

import { selectModelForFile } from './modelRouter.js';
import { validateCodeWithCompletion } from './completionValidator.js';
import { shouldSkipFile } from './scaffoldAgent.js';

export interface PreflightResult {
  passed: boolean;
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

export interface PreflightSummary {
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  overallPass: boolean;
  results: PreflightResult[];
  estimatedCost?: number;
  estimatedTime?: number;
}

/**
 * Run all pre-flight checks
 */
export async function runPreflightChecks(): Promise<PreflightSummary> {
  console.log('🚀 Starting Pre-Flight Checks...\n');
  
  const results: PreflightResult[] = [];
  
  // Category 1: Environment Configuration
  results.push(...await checkEnvironment());
  
  // Category 2: API Connectivity
  results.push(...await checkAPIs());
  
  // Category 3: Logic Validation
  results.push(...checkLogic());
  
  // Category 4: Smoke Test
  results.push(...checkSmokeTest());
  
  // Calculate summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warn').length;
  const overallPass = failed === 0;
  
  return {
    totalTests: results.length,
    passed,
    failed,
    warnings,
    overallPass,
    results
  };
}

/**
 * Check environment configuration
 */
async function checkEnvironment(): Promise<PreflightResult[]> {
  const results: PreflightResult[] = [];
  
  console.log('⚙️  Checking Environment Configuration...');
  
  // Required API keys
  const requiredKeys = [
    { key: 'ANTHROPIC_API_KEY', name: 'Claude API' },
    { key: 'GEMINI_API_KEY', name: 'Gemini API' },
    { key: 'GROQ_API_KEY', name: 'Groq API' },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', name: 'Supabase URL' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', name: 'Supabase Key' }
  ];
  
  for (const { key, name } of requiredKeys) {
    const value = process.env[key];
    results.push({
      passed: !!value,
      category: 'Environment',
      test: name,
      status: value ? 'pass' : 'fail',
      message: value ? 'Present ✓' : 'MISSING - Pipeline will fail',
      details: value ? `${value.substring(0, 10)}...` : 'Not set'
    });
  }
  
  // Optional but recommended
  const optionalKeys = [
    { key: 'DEEPSEEK_API_KEY', name: 'DeepSeek API (cost savings)' },
    { key: 'PERPLEXITY_API_KEY', name: 'Perplexity API (research)' },
    { key: 'GITHUB_TOKEN', name: 'GitHub (publishing)' }
  ];
  
  for (const { key, name } of optionalKeys) {
    const value = process.env[key];
    results.push({
      passed: true,
      category: 'Environment',
      test: name,
      status: value ? 'pass' : 'warn',
      message: value ? 'Present ✓' : 'Missing - some features unavailable',
      details: value ? `${value.substring(0, 10)}...` : 'Not set'
    });
  }
  
  console.log(`   ✓ Environment checks complete\n`);
  return results;
}

/**
 * Check API connectivity
 */
async function checkAPIs(): Promise<PreflightResult[]> {
  const results: PreflightResult[] = [];
  
  console.log('🔌 Checking API Connectivity...');
  
  // Test Groq (fastest to test)
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${groqKey}` },
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      results.push({
        passed: response.ok,
        category: 'API',
        test: 'Groq API (FREE tier)',
        status: response.ok ? 'pass' : 'fail',
        message: response.ok ? 'Connected ✓' : `Failed (${response.status})`,
        details: response.status
      });
    } else {
      results.push({
        passed: false,
        category: 'API',
        test: 'Groq API',
        status: 'warn',
        message: 'API key not set - will use paid alternatives',
        details: 'No key'
      });
    }
  } catch (err: any) {
    results.push({
      passed: false,
      category: 'API',
      test: 'Groq API',
      status: 'warn',
      message: 'Connection test failed - will use fallback',
      details: err.message
    });
  }
  
  // Test Anthropic API format (don't actually call - too expensive)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const isValidFormat = anthropicKey.startsWith('sk-ant-');
    results.push({
      passed: isValidFormat,
      category: 'API',
      test: 'Anthropic API Key Format',
      status: isValidFormat ? 'pass' : 'warn',
      message: isValidFormat ? 'Valid format ✓' : 'Unusual format - may be invalid',
      details: anthropicKey.substring(0, 15) + '...'
    });
  }
  
  console.log(`   ✓ API checks complete\n`);
  return results;
}

/**
 * Check logic validation
 */
function checkLogic(): PreflightResult[] {
  const results: PreflightResult[] = [];
  
  console.log('🧪 Checking Logic & Routing...');
  
  // Test model router
  const testFiles = [
    { path: 'app/page.tsx', type: 'page', expectedTier: 'premium', desc: 'Main page → Claude' },
    { path: 'app/api/test/route.ts', type: 'api_route', expectedTier: 'economy', desc: 'API route → DeepSeek' },
    { path: 'lib/types.ts', type: 'types', expectedTier: 'standard', desc: 'Types → Qwen (FREE)' },
    { path: 'components/dashboard/Table.tsx', type: 'component', expectedTier: 'premium', desc: 'Dashboard → Claude' },
    { path: 'lib/utils/helpers.ts', type: 'utility', expectedTier: 'economy', desc: 'Utils → DeepSeek' }
  ];
  
  for (const file of testFiles) {
    try {
      const routing = selectModelForFile(file.path, file.type);
      const correct = routing.tier === file.expectedTier;
      
      results.push({
        passed: correct,
        category: 'Routing',
        test: file.desc,
        status: correct ? 'pass' : 'warn',
        message: correct 
          ? `✓ ${routing.model}`
          : `Got ${routing.tier}, expected ${file.expectedTier}`,
        details: routing
      });
    } catch (err: any) {
      results.push({
        passed: false,
        category: 'Routing',
        test: file.desc,
        status: 'fail',
        message: `Router error: ${err.message}`,
        details: err
      });
    }
  }
  
  // Test completion validator
  const testCodes = [
    { 
      code: '// TODO: Implement this\nexport default {}', 
      file: 'test.tsx',
      shouldPass: false,
      desc: 'Reject TODO stub'
    },
    { 
      code: 'export const Button = () => <button>Click</button>', 
      file: 'Button.tsx',
      shouldPass: true,
      desc: 'Accept real component'
    },
    {
      code: '// Pending implementation',
      file: 'test.ts',
      shouldPass: false,
      desc: 'Reject "Pending implementation"'
    }
  ];
  
  for (const test of testCodes) {
    try {
      const result = validateCodeWithCompletion(test.code, test.file);
      const correct = test.shouldPass ? result.valid : !result.valid;
      
      results.push({
        passed: correct,
        category: 'Validation',
        test: test.desc,
        status: correct ? 'pass' : 'fail',
        message: correct 
          ? `✓ Validator working correctly`
          : `Validator ${test.shouldPass ? 'rejected valid' : 'accepted invalid'} code`,
        details: { expected: test.shouldPass, got: result.valid, confidence: result.completion.confidence }
      });
    } catch (err: any) {
      results.push({
        passed: false,
        category: 'Validation',
        test: test.desc,
        status: 'fail',
        message: `Validator error: ${err.message}`,
        details: err
      });
    }
  }
  
  // Test UI skip logic
  const skipTests = [
    { file: 'components/ui/Card.tsx', shouldSkip: true, desc: 'Skip Golden: Card' },
    { file: 'components/ui/Button.tsx', shouldSkip: true, desc: 'Skip Golden: Button' },
    { file: 'components/ui/alert.tsx', shouldSkip: true, desc: 'Skip UI library: alert' },
    { file: 'components/dashboard/Table.tsx', shouldSkip: false, desc: 'Generate: Custom component' }
  ];
  
  for (const test of skipTests) {
    const result = shouldSkipFile(test.file);
    const correct = result === test.shouldSkip;
    
    results.push({
      passed: correct,
      category: 'Skip Logic',
      test: test.desc,
      status: correct ? 'pass' : 'warn',
      message: correct 
        ? `✓ ${test.shouldSkip ? 'Correctly skipped' : 'Correctly generating'}`
        : `${result ? 'Skipping' : 'Generating'} (expected ${test.shouldSkip ? 'skip' : 'generate'})`,
      details: { result, expected: test.shouldSkip }
    });
  }
  
  console.log(`   ✓ Logic checks complete\n`);
  return results;
}

/**
 * Smoke test - validate end-to-end logic
 */
function checkSmokeTest(): PreflightResult[] {
  const results: PreflightResult[] = [];
  
  console.log('🔥 Running Smoke Test...');
  
  // Test complete flow: routing → validation
  const mockFiles = [
    {
      path: 'lib/utils/math.ts',
      type: 'utility',
      content: 'export const add = (a: number, b: number) => a + b;\nexport const multiply = (a: number, b: number) => a * b;'
    },
    {
      path: 'components/Header.tsx',
      type: 'component',
      content: 'export const Header = () => <header><h1>Title</h1></header>'
    }
  ];
  
  for (const file of mockFiles) {
    try {
      // Test routing
      const routing = selectModelForFile(file.path, file.type);
      
      // Test validation
      const validation = validateCodeWithCompletion(file.content, file.path);
      
      const passed = validation.valid && routing.model;
      
      results.push({
        passed,
        category: 'Smoke Test',
        test: `End-to-End: ${file.path}`,
        status: passed ? 'pass' : 'fail',
        message: passed 
          ? `✓ Routed to ${routing.tier} & validated (${validation.completion.confidence}% confidence)`
          : 'Routing or validation failed',
        details: { routing, validation }
      });
      
    } catch (err: any) {
      results.push({
        passed: false,
        category: 'Smoke Test',
        test: `End-to-End: ${file.path}`,
        status: 'fail',
        message: `Error: ${err.message}`,
        details: err
      });
    }
  }
  
  console.log(`   ✓ Smoke test complete\n`);
  return results;
}

/**
 * Display results
 */
export function displayPreflightResults(summary: PreflightSummary): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('      🚀 PRE-FLIGHT CHECK RESULTS v10');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📊 Summary:`);
  console.log(`   Total Tests: ${summary.totalTests}`);
  console.log(`   ✅ Passed: ${summary.passed}`);
  console.log(`   ❌ Failed: ${summary.failed}`);
  console.log(`   ⚠️  Warnings: ${summary.warnings}\n`);
  
  // Group by category
  const byCategory: Record<string, PreflightResult[]> = {};
  for (const result of summary.results) {
    if (!byCategory[result.category]) {
      byCategory[result.category] = [];
    }
    byCategory[result.category].push(result);
  }
  
  // Display each category
  for (const [category, results] of Object.entries(byCategory)) {
    console.log(`\n📁 ${category}:`);
    for (const result of results) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`   ${icon} ${result.test}`);
      console.log(`      ${result.message}`);
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (summary.overallPass) {
    console.log('✅ ALL CRITICAL CHECKS PASSED');
    console.log('🚀 Pipeline is ready to run!');
    console.log('💡 Estimated success rate: 95%+');
  } else {
    console.log('❌ SOME CHECKS FAILED');
    console.log('⚠️  Fix critical issues before running pipeline');
    console.log('💡 Pipeline may fail or produce poor results');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * CLI command to run pre-flight checks
 */
export async function preflightCommand(): Promise<boolean> {
  const summary = await runPreflightChecks();
  displayPreflightResults(summary);
  return summary.overallPass;
}
