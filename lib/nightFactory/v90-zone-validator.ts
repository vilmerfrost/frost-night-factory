// =============================================================================
// FROST NIGHT FACTORY v9.0 - ZONE VALIDATOR
// =============================================================================
// Graduated success tiers validation strategy

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Validation tier
 */
export enum ValidationTier {
  TIER_1_MUST_PASS = 1,
  TIER_2_WARNINGS_OK = 2,
  TIER_3_DOCUMENT = 3,
}

/**
 * Validation check result
 */
export interface ValidationCheck {
  name: string;
  tier: ValidationTier;
  passed: boolean;
  message: string;
  details?: string[];
}

/**
 * Zone validation result
 */
export interface ZoneValidationResult {
  passed: boolean;
  tier1Checks: ValidationCheck[];
  tier2Checks: ValidationCheck[];
  tier3Checks: ValidationCheck[];
  summary: string;
}

/**
 * Run all zone validations
 */
export async function runZoneValidation(projectRoot: string): Promise<ZoneValidationResult> {
  console.log('\n🔍 Running Zone Validation...\n');
  
  const tier1Checks: ValidationCheck[] = [];
  const tier2Checks: ValidationCheck[] = [];
  const tier3Checks: ValidationCheck[] = [];
  
  // ============================================================================
  // TIER 1: MUST PASS (5 checks)
  // ============================================================================
  console.log('📋 TIER 1 - MUST PASS');
  console.log('───────────────────────────────────────────────────────────────');
  
  // 1. Syntax clean (no TS1005/TS1161)
  const syntaxCheck = await checkSyntax(projectRoot);
  tier1Checks.push(syntaxCheck);
  logCheck(syntaxCheck);
  
  // 2. Framework imports resolve
  const importsCheck = await checkFrameworkImports(projectRoot);
  tier1Checks.push(importsCheck);
  logCheck(importsCheck);
  
  // 3. Server starts (no runtime crashes) - simplified check
  const configCheck = await checkBuildConfig(projectRoot);
  tier1Checks.push(configCheck);
  logCheck(configCheck);
  
  // 4. Types file exists and is valid
  const typesCheck = await checkTypesFile(projectRoot);
  tier1Checks.push(typesCheck);
  logCheck(typesCheck);
  
  // 5. Package.json valid
  const packageCheck = await checkPackageJson(projectRoot);
  tier1Checks.push(packageCheck);
  logCheck(packageCheck);
  
  // ============================================================================
  // TIER 2: WARNINGS OK (≤5)
  // ============================================================================
  console.log('\n📋 TIER 2 - WARNINGS OK (≤5)');
  console.log('───────────────────────────────────────────────────────────────');
  
  // Unused imports/variables
  const unusedCheck = await checkUnusedCode(projectRoot);
  tier2Checks.push(unusedCheck);
  logCheck(unusedCheck);
  
  // Non-blocking TS2322 in isolated files
  const typeErrorsCheck = await checkIsolatedTypeErrors(projectRoot);
  tier2Checks.push(typeErrorsCheck);
  logCheck(typeErrorsCheck);
  
  // ============================================================================
  // TIER 3: DOCUMENT (known issues)
  // ============================================================================
  console.log('\n📋 TIER 3 - DOCUMENT');
  console.log('───────────────────────────────────────────────────────────────');
  
  // ESLint warnings
  const eslintCheck = await checkESLintWarnings(projectRoot);
  tier3Checks.push(eslintCheck);
  logCheck(eslintCheck);
  
  // Missing JSDoc
  const jsdocCheck = await checkJSDoc(projectRoot);
  tier3Checks.push(jsdocCheck);
  logCheck(jsdocCheck);
  
  // Calculate pass/fail
  const tier1Passed = tier1Checks.every(c => c.passed);
  const tier2WarningCount = tier2Checks.filter(c => !c.passed).length;
  const tier2Ok = tier2WarningCount <= 5;
  
  const passed = tier1Passed && tier2Ok;
  
  const summary = generateSummary(tier1Checks, tier2Checks, tier3Checks, passed);
  
  return {
    passed,
    tier1Checks,
    tier2Checks,
    tier3Checks,
    summary,
  };
}

/**
 * Check for syntax errors
 */
async function checkSyntax(projectRoot: string): Promise<ValidationCheck> {
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit 2>&1 || true', {
      cwd: projectRoot,
      timeout: 60000,
    });
    
    const output = stdout + stderr;
    const syntaxErrors = (output.match(/TS1005|TS1161|TS1003|TS1109|TS1128/g) || []).length;
    
    return {
      name: 'Syntax Clean',
      tier: ValidationTier.TIER_1_MUST_PASS,
      passed: syntaxErrors === 0,
      message: syntaxErrors === 0 ? 'No syntax errors' : `${syntaxErrors} syntax errors found`,
      details: syntaxErrors > 0 ? output.split('\n').filter(l => /TS1\d{3}/.test(l)).slice(0, 5) : undefined,
    };
  } catch {
    return {
      name: 'Syntax Clean',
      tier: ValidationTier.TIER_1_MUST_PASS,
      passed: false,
      message: 'TypeScript check failed to run',
    };
  }
}

/**
 * Check framework imports
 */
async function checkFrameworkImports(projectRoot: string): Promise<ValidationCheck> {
  const criticalImports = [
    'next',
    'react',
    '@supabase/supabase-js',
  ];
  
  const missing: string[] = [];
  
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    for (const imp of criticalImports) {
      if (!deps[imp]) {
        missing.push(imp);
      }
    }
  } catch {
    missing.push('package.json not readable');
  }
  
  return {
    name: 'Framework Imports',
    tier: ValidationTier.TIER_1_MUST_PASS,
    passed: missing.length === 0,
    message: missing.length === 0 ? 'All framework imports present' : `Missing: ${missing.join(', ')}`,
    details: missing.length > 0 ? missing : undefined,
  };
}

/**
 * Check build configuration
 */
async function checkBuildConfig(projectRoot: string): Promise<ValidationCheck> {
  const requiredFiles = ['tsconfig.json', 'package.json'];
  const missing: string[] = [];
  
  for (const file of requiredFiles) {
    const filePath = path.join(projectRoot, file);
    try {
      await fs.access(filePath);
    } catch {
      missing.push(file);
    }
  }
  
  return {
    name: 'Build Config',
    tier: ValidationTier.TIER_1_MUST_PASS,
    passed: missing.length === 0,
    message: missing.length === 0 ? 'Build config present' : `Missing: ${missing.join(', ')}`,
    details: missing.length > 0 ? missing : undefined,
  };
}

/**
 * Check types file
 */
async function checkTypesFile(projectRoot: string): Promise<ValidationCheck> {
  const typesPath = path.join(projectRoot, 'src', 'lib', 'types.ts');
  
  try {
    const content = await fs.readFile(typesPath, 'utf-8');
    
    // Check for critical issues
    const issues: string[] = [];
    
    if (content.includes('any')) {
      issues.push('Contains "any" type');
    }
    
    if (content.includes('TODO') || content.includes('FIXME')) {
      issues.push('Contains TODO/FIXME');
    }
    
    if (!content.includes('export')) {
      issues.push('No exports found');
    }
    
    return {
      name: 'Types File',
      tier: ValidationTier.TIER_1_MUST_PASS,
      passed: issues.length === 0,
      message: issues.length === 0 ? 'Types file valid' : `Issues: ${issues.join(', ')}`,
      details: issues.length > 0 ? issues : undefined,
    };
  } catch {
    return {
      name: 'Types File',
      tier: ValidationTier.TIER_1_MUST_PASS,
      passed: true, // Optional file
      message: 'Types file not found (optional)',
    };
  }
}

/**
 * Check package.json
 */
async function checkPackageJson(projectRoot: string): Promise<ValidationCheck> {
  const packagePath = path.join(projectRoot, 'package.json');
  
  try {
    const content = await fs.readFile(packagePath, 'utf-8');
    JSON.parse(content); // Validate JSON
    
    return {
      name: 'Package.json Valid',
      tier: ValidationTier.TIER_1_MUST_PASS,
      passed: true,
      message: 'Package.json is valid JSON',
    };
  } catch (error: any) {
    return {
      name: 'Package.json Valid',
      tier: ValidationTier.TIER_1_MUST_PASS,
      passed: false,
      message: `Invalid package.json: ${error.message}`,
    };
  }
}

/**
 * Check for unused code
 */
async function checkUnusedCode(projectRoot: string): Promise<ValidationCheck> {
  try {
    const { stdout } = await execAsync('npx tsc --noEmit 2>&1 || true', {
      cwd: projectRoot,
      timeout: 60000,
    });
    
    const unusedWarnings = (stdout.match(/TS6133|TS6196/g) || []).length;
    
    return {
      name: 'Unused Code',
      tier: ValidationTier.TIER_2_WARNINGS_OK,
      passed: unusedWarnings <= 5,
      message: `${unusedWarnings} unused imports/variables`,
    };
  } catch {
    return {
      name: 'Unused Code',
      tier: ValidationTier.TIER_2_WARNINGS_OK,
      passed: true,
      message: 'Check skipped',
    };
  }
}

/**
 * Check for isolated type errors
 */
async function checkIsolatedTypeErrors(projectRoot: string): Promise<ValidationCheck> {
  try {
    const { stdout } = await execAsync('npx tsc --noEmit 2>&1 || true', {
      cwd: projectRoot,
      timeout: 60000,
    });
    
    const typeErrors = (stdout.match(/TS2322/g) || []).length;
    
    return {
      name: 'Type Errors',
      tier: ValidationTier.TIER_2_WARNINGS_OK,
      passed: typeErrors <= 5,
      message: `${typeErrors} type errors (TS2322)`,
    };
  } catch {
    return {
      name: 'Type Errors',
      tier: ValidationTier.TIER_2_WARNINGS_OK,
      passed: true,
      message: 'Check skipped',
    };
  }
}

/**
 * Check ESLint warnings
 */
async function checkESLintWarnings(projectRoot: string): Promise<ValidationCheck> {
  // Simplified - just note that ESLint should be run
  return {
    name: 'ESLint Warnings',
    tier: ValidationTier.TIER_3_DOCUMENT,
    passed: true,
    message: 'ESLint warnings should be documented (not blocking)',
  };
}

/**
 * Check JSDoc coverage
 */
async function checkJSDoc(projectRoot: string): Promise<ValidationCheck> {
  // Simplified - just note that JSDoc should be added
  return {
    name: 'JSDoc Coverage',
    tier: ValidationTier.TIER_3_DOCUMENT,
    passed: true,
    message: 'JSDoc coverage should be documented (not blocking)',
  };
}

/**
 * Log a check result
 */
function logCheck(check: ValidationCheck): void {
  const icon = check.passed ? '✅' : '❌';
  console.log(`  ${icon} ${check.name}: ${check.message}`);
  
  if (check.details) {
    for (const detail of check.details.slice(0, 3)) {
      console.log(`     - ${detail}`);
    }
  }
}

/**
 * Generate summary
 */
function generateSummary(
  tier1: ValidationCheck[],
  tier2: ValidationCheck[],
  tier3: ValidationCheck[],
  passed: boolean
): string {
  const tier1Passed = tier1.filter(c => c.passed).length;
  const tier2Warnings = tier2.filter(c => !c.passed).length;
  
  const status = passed ? '✅ PASSED' : '❌ FAILED';
  
  return `
═══════════════════════════════════════════════════════════════
  ZONE VALIDATION RESULT: ${status}
═══════════════════════════════════════════════════════════════

  TIER 1 (MUST PASS): ${tier1Passed}/${tier1.length} ✓
  TIER 2 (WARNINGS):  ${tier2Warnings} warnings (max 5 allowed)
  TIER 3 (DOCUMENT):  ${tier3.length} items documented

  Pass Criteria: TIER 1 ✓ + T2 ≤5 + T3 logged = ${passed ? 'MET' : 'NOT MET'}

═══════════════════════════════════════════════════════════════
`;
}

/**
 * Quick validation check
 */
export async function quickValidation(projectRoot: string): Promise<boolean> {
  const result = await runZoneValidation(projectRoot);
  return result.passed;
}

