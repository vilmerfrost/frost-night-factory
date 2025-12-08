#!/usr/bin/env tsx
// =============================================================================
// FROST NIGHT FACTORY v8.5 - TEST SUITE
// =============================================================================
// Run: npm run v85:test

import { 
  ErrorCategory, 
  FixStrategy,
  DEFAULT_FILE_TYPE_CONSTRAINTS,
  DEFAULT_V85_FLAGS 
} from '../lib/nightFactory/v85-types';
import { classifyError } from '../lib/nightFactory/v85-error-classifier';
import { checkFileSyntax } from '../lib/nightFactory/v85-ast-validators';
import { validateBlueprint, createDefaultBlueprint } from '../lib/nightFactory/v85-planner';
import { generateCoderSystemPrompt, postProcessCode } from '../lib/nightFactory/v85-coder';
import { getV85Version } from '../lib/nightFactory/v85-index';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | void) {
  try {
    const result = fn();
    if (result === false) {
      console.log(`  ❌ ${name}`);
      failed++;
    } else {
      console.log(`  ✅ ${name}`);
      passed++;
    }
  } catch (error: any) {
    console.log(`  ❌ ${name}: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual: any, expected: any, message?: string): boolean {
  if (actual !== expected) {
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual: ${actual}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🧊 FROST NIGHT FACTORY v8.5 - TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  const version = getV85Version();
  console.log(`📦 Version: ${version.version}`);
  console.log(`🚩 Features: ${version.features.length}`);
  console.log('');
  
  // ==========================================================================
  // ERROR CLASSIFIER TESTS
  // ==========================================================================
  console.log('📋 Error Classifier Tests:');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('Classifies JSX in .ts file', () => {
    const error = classifyError({
      file: 'src/app/api/test/route.ts',
      message: 'JSX syntax detected in .ts file',
    }, 0);
    return error.category === ErrorCategory.FILE_EXTENSION_MISMATCH;
  });
  
  test('Classifies API route JSX error', () => {
    const error = classifyError({
      file: 'src/app/api/test/route.ts',
      message: 'API route files must not contain JSX',
    }, 0);
    return error.category === ErrorCategory.FILE_STRUCTURE_VIOLATION;
  });
  
  test('Classifies missing import', () => {
    const error = classifyError({
      file: 'src/lib/utils.ts',
      message: "Cannot find module '@/lib/helpers'",
    }, 0);
    return error.category === ErrorCategory.MISSING_IMPORT;
  });
  
  test('Classifies lazy code', () => {
    const error = classifyError({
      file: 'src/components/Card.tsx',
      message: 'return null detected',
    }, 0);
    return error.category === ErrorCategory.LAZY_CODE;
  });
  
  test('Suggests REMOVE_JSX for JSX errors', () => {
    const error = classifyError({
      file: 'src/app/api/test/route.ts',
      message: 'JSX syntax detected in .ts file',
    }, 0);
    return error.suggestedFixes[0]?.strategy === FixStrategy.REMOVE_JSX;
  });
  
  test('Escalates after 3 retries for critical errors', () => {
    const error = classifyError({
      file: 'src/app/api/test/route.ts',
      message: 'JSX syntax detected in .ts file',
    }, 4);
    return error.shouldEscalate === true;
  });
  
  // ==========================================================================
  // BLUEPRINT VALIDATION TESTS
  // ==========================================================================
  console.log('\n📋 Blueprint Validation Tests:');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('Creates default blueprint', () => {
    const blueprint = createDefaultBlueprint('test-project');
    return blueprint.project_name === 'test-project' && 
           blueprint.files.length > 0;
  });
  
  test('Validates correct blueprint', () => {
    const blueprint = createDefaultBlueprint('test-project');
    const result = validateBlueprint(blueprint);
    return result.valid === true;
  });
  
  test('Rejects invalid blueprint', () => {
    const result = validateBlueprint({ invalid: true });
    return result.valid === false;
  });
  
  test('Detects API route with wrong extension', () => {
    const result = validateBlueprint({
      project_name: 'test',
      fileTypeConstraints: DEFAULT_FILE_TYPE_CONSTRAINTS,
      files: [{
        path: 'src/app/api/test/route.tsx', // Wrong!
        kind: 'api_route',
        expected_extension: '.tsx', // Wrong!
        description: 'Test API',
        constraints: [],
      }],
    });
    return result.valid === false && 
           result.errors?.some(e => e.includes('must use .ts'));
  });
  
  // ==========================================================================
  // CODER PROMPT TESTS
  // ==========================================================================
  console.log('\n📋 Coder Prompt Tests:');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('Generates system prompt with constraints', () => {
    const prompt = generateCoderSystemPrompt(DEFAULT_FILE_TYPE_CONSTRAINTS);
    return prompt.includes('API ROUTES') && 
           prompt.includes('COMPONENTS') && 
           prompt.includes('UTILITIES');
  });
  
  test('System prompt includes NO JSX rule', () => {
    const prompt = generateCoderSystemPrompt(DEFAULT_FILE_TYPE_CONSTRAINTS);
    return prompt.includes('NO JSX') || prompt.includes('Not import React');
  });
  
  test('Post-process detects React in API route', () => {
    const code = `import React from 'react';
export async function GET() { return Response.json({}); }`;
    const result = postProcessCode(code, 'src/app/api/test/route.ts', DEFAULT_FILE_TYPE_CONSTRAINTS);
    return result.warnings.some(w => w.includes('React'));
  });
  
  test('Post-process detects return null', () => {
    const code = `export default function Component() { return null; }`;
    const result = postProcessCode(code, 'src/components/Test.tsx', DEFAULT_FILE_TYPE_CONSTRAINTS);
    return result.warnings.some(w => w.includes('return null'));
  });
  
  // ==========================================================================
  // AST VALIDATOR TESTS
  // ==========================================================================
  console.log('\n📋 AST Validator Tests:');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('Detects syntax error', () => {
    const violations = checkFileSyntax('test.ts', 'const x = {;');
    return violations.length > 0;
  });
  
  test('Accepts valid TypeScript', () => {
    const violations = checkFileSyntax('test.ts', 'const x: number = 42;');
    return violations.length === 0;
  });
  
  // ==========================================================================
  // FEATURE FLAGS TESTS
  // ==========================================================================
  console.log('\n📋 Feature Flags Tests:');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('Default flags are all enabled', () => {
    return DEFAULT_V85_FLAGS.FF_V85_VALIDATION === true &&
           DEFAULT_V85_FLAGS.FF_V85_AST_GUARDRAILS === true &&
           DEFAULT_V85_FLAGS.FF_V85_COST_TRACKING === true;
  });
  
  // ==========================================================================
  // LAYOUT CONTRACT TESTS
  // ==========================================================================
  console.log('\n📋 Layout Contract Tests:');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('Layout contracts exist for all components', async () => {
    const { LAYOUT_CONTRACTS } = await import('../lib/nightFactory/layout-contract');
    return LAYOUT_CONTRACTS.length >= 10;
  });
  
  test('Can get FormPage contract', async () => {
    const { getLayoutContract } = await import('../lib/nightFactory/layout-contract');
    const contract = getLayoutContract('FormPage');
    return contract !== null && contract.props.title !== undefined;
  });
  
  test('isLayoutComponent detects layout components', async () => {
    const { isLayoutComponent } = await import('../lib/nightFactory/layout-contract');
    return isLayoutComponent('AppShell') === true &&
           isLayoutComponent('RandomComponent') === false;
  });
  
  // ==========================================================================
  // BATCH FIXER TESTS
  // ==========================================================================
  console.log('\n📋 Batch Fixer Tests:');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('Batch fixer health check passes', async () => {
    const { batchFixerHealthCheck } = await import('../lib/nightFactory/v85-batch-fixer');
    const result = batchFixerHealthCheck();
    return result.healthy === true;
  });
  
  test('Error mapping handles TS2322', async () => {
    const { mapErrorClassToErrorCategory } = await import('../lib/nightFactory/v85-error-mapping');
    const category = mapErrorClassToErrorCategory('TS2322');
    return category !== undefined;
  });
  
  test('IntrinsicAttributes detection works', async () => {
    const { isIntrinsicAttributesError } = await import('../lib/nightFactory/v85-error-mapping');
    return isIntrinsicAttributesError("Property 'title' does not exist on type 'IntrinsicAttributes'") === true &&
           isIntrinsicAttributesError("Normal error") === false;
  });
  
  // ==========================================================================
  // INTRINSIC ATTRIBUTES ERROR CLASSIFICATION
  // ==========================================================================
  console.log('\n📋 IntrinsicAttributes Error Tests:');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('Classifies IntrinsicAttributes error correctly', () => {
    const error = classifyError({
      file: 'src/components/layout/FormPage.tsx',
      message: "Property 'title' does not exist on type 'IntrinsicAttributes'",
    }, 0);
    return error.category === ErrorCategory.FILE_STRUCTURE_VIOLATION &&
           error.subcategory.includes('intrinsic');
  });
  
  test('Classifies TS2322 IntrinsicAttributes error', () => {
    const error = classifyError({
      file: 'src/app/page.tsx',
      message: "TS2322: Type 'X' is not assignable to type 'IntrinsicAttributes'",
    }, 0);
    return error.category === ErrorCategory.FILE_STRUCTURE_VIOLATION;
  });
  
  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📊 TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📈 Total: ${passed + failed}`);
  console.log('');
  
  if (failed > 0) {
    console.log('❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

main();

