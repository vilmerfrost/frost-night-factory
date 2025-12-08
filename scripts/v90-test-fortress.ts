#!/usr/bin/env tsx
// =============================================================================
// FROST NIGHT FACTORY v9.0 - Test Fortress Implementation
// =============================================================================
// Run: npm run v90:test-fortress

import {
  FortressTier,
  FORTRESS_FILES,
  getFortressFile,
  getFileTier,
  isInFortress,
  canRepair,
  matchesFortressPattern,
} from '../lib/nightFactory/fortress-files';

import {
  checkRepairAllowed,
  filterRepairableErrors,
} from '../lib/nightFactory/v90-fortress-guard';

import {
  RepairAuthority,
  authorizeRepair,
  createRepairSession,
  recordAttempt,
  getRecommendedModel,
} from '../lib/nightFactory/v90-repair-authority';

import { getV90Version } from '../lib/nightFactory/v90-index';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
  try {
    if (fn()) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  } catch (error: any) {
    console.log(`  ❌ ${name}: ${error.message}`);
    failed++;
  }
}

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🏰 FROST NIGHT FACTORY v9.0 - FORTRESS TESTS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const version = getV90Version();
  console.log(`\n📦 Version: ${version.version}`);
  console.log(`🏛️ Pillars: ${version.pillars.length}`);
  console.log('');
  
  // ============================================================================
  // PILLAR 1: FORTRESS PATTERN TESTS
  // ============================================================================
  console.log('📋 Pillar 1: Fortress Pattern');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('FORTRESS_FILES is defined', () => {
    return FORTRESS_FILES.length > 0;
  });
  
  test('tsconfig.json is GOLDEN tier', () => {
    const tier = getFileTier('tsconfig.json');
    return tier === FortressTier.GOLDEN;
  });
  
  test('package.json is GOLDEN tier', () => {
    const tier = getFileTier('package.json');
    return tier === FortressTier.GOLDEN;
  });
  
  test('src/lib/types.ts is REGENERATE_ONLY', () => {
    const tier = getFileTier('src/lib/types.ts');
    return tier === FortressTier.REGENERATE_ONLY;
  });
  
  test('src/lib/api.ts is RESTRICTED_FIX', () => {
    const tier = getFileTier('src/lib/api.ts');
    return tier === FortressTier.RESTRICTED_FIX;
  });
  
  test('src/app/dashboard/page.tsx is NORMAL', () => {
    const tier = getFileTier('src/app/dashboard/page.tsx');
    return tier === FortressTier.NORMAL;
  });
  
  test('src/lib/mock-data.ts is DISPOSABLE', () => {
    const tier = getFileTier('src/lib/mock-data.ts');
    return tier === FortressTier.DISPOSABLE;
  });
  
  test('isInFortress detects GOLDEN files', () => {
    return isInFortress('tsconfig.json') === true;
  });
  
  test('isInFortress detects non-fortress files', () => {
    return isInFortress('src/lib/mock-data.ts') === false;
  });
  
  test('canRepair blocks GOLDEN files', () => {
    return canRepair('tsconfig.json', 0) === false;
  });
  
  test('canRepair allows DISPOSABLE files', () => {
    return canRepair('src/lib/mock-data.ts', 10) === true;
  });
  
  // ============================================================================
  // REPAIR GUARD TESTS
  // ============================================================================
  console.log('\n📋 Repair Guard Tests');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('checkRepairAllowed blocks GOLDEN', () => {
    const result = checkRepairAllowed({
      filePath: 'tsconfig.json',
      content: '',
      attemptCount: 0,
      errorType: 'TEST',
    });
    return result.allowed === false && result.action === 'BLOCK';
  });
  
  test('checkRepairAllowed allows REGENERATE for TIER 1', () => {
    const result = checkRepairAllowed({
      filePath: 'src/lib/types.ts',
      content: '',
      attemptCount: 0,
      errorType: 'TEST',
    });
    return result.allowed === true && result.action === 'REGENERATE';
  });
  
  test('checkRepairAllowed allows TIER 2 with attempts', () => {
    const result = checkRepairAllowed({
      filePath: 'src/lib/api.ts',
      content: '',
      attemptCount: 1,
      errorType: 'TEST',
    });
    return result.allowed === true;
  });
  
  test('checkRepairAllowed blocks TIER 2 after max attempts', () => {
    const result = checkRepairAllowed({
      filePath: 'src/lib/api.ts',
      content: '',
      attemptCount: 5,
      errorType: 'TEST',
    });
    return result.allowed === false;
  });
  
  test('filterRepairableErrors filters correctly', () => {
    const errors = [
      { file: 'tsconfig.json', message: 'error' },
      { file: 'src/lib/mock-data.ts', message: 'error' },
    ];
    const attemptCounts = new Map<string, number>();
    
    const { repairable, blocked } = filterRepairableErrors(errors, attemptCounts);
    
    return repairable.length === 1 && blocked.length === 1;
  });
  
  // ============================================================================
  // REPAIR AUTHORITY TESTS
  // ============================================================================
  console.log('\n📋 Pillar 3: Repair Authority');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('createRepairSession creates session', () => {
    const session = createRepairSession('test-pipeline');
    return session.pipelineId === 'test-pipeline' && session.attempts.length === 0;
  });
  
  test('authorizeRepair blocks GOLDEN', () => {
    const session = createRepairSession('test-pipeline');
    const auth = authorizeRepair('tsconfig.json', session, 'groq');
    return auth.allowed === false && auth.authority === RepairAuthority.NONE;
  });
  
  test('authorizeRepair allows DISPOSABLE', () => {
    const session = createRepairSession('test-pipeline');
    const auth = authorizeRepair('src/lib/mock-data.ts', session, 'claude');
    return auth.allowed === true && auth.authority === RepairAuthority.UNLIMITED;
  });
  
  test('authorizeRepair respects model restrictions', () => {
    const session = createRepairSession('test-pipeline');
    // RESTRICTED_FIX only allows groq and deepseek_v3, not claude
    const auth = authorizeRepair('src/lib/api.ts', session, 'claude');
    return auth.allowed === false;
  });
  
  test('authorizeRepair allows correct models', () => {
    const session = createRepairSession('test-pipeline');
    const auth = authorizeRepair('src/lib/api.ts', session, 'groq');
    return auth.allowed === true;
  });
  
  test('getRecommendedModel escalates with attempts', () => {
    const model0 = getRecommendedModel('src/app/page.tsx', 0);
    const model2 = getRecommendedModel('src/app/page.tsx', 2);
    return model0 === 'groq' && model2 === 'deepseek_r1';
  });
  
  test('recordAttempt tracks cost', () => {
    let session = createRepairSession('test-pipeline');
    session = recordAttempt(session, {
      filePath: 'test.ts',
      attemptNumber: 1,
      model: 'groq',
      cost: 0.05,
      success: true,
    });
    return session.totalCost === 0.05 && session.attempts.length === 1;
  });
  
  // ============================================================================
  // PATTERN MATCHING TESTS
  // ============================================================================
  console.log('\n📋 Pattern Matching');
  console.log('───────────────────────────────────────────────────────────────');
  
  test('matches exact pattern', () => {
    return matchesFortressPattern('tsconfig.json', 'tsconfig.json');
  });
  
  test('matches glob ** pattern', () => {
    return matchesFortressPattern('src/components/ui/button.tsx', 'src/components/ui/**');
  });
  
  test('matches nested path', () => {
    return matchesFortressPattern('src/app/dashboard/page.tsx', 'src/app/**/page.tsx');
  });
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
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
    console.log('✅ All fortress tests passed!');
    process.exit(0);
  }
}

main();

