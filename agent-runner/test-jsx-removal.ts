// agent-runner/test-jsx-removal.ts
// 🔥 Test script to verify REMOVE_JSX strategy works correctly

// ✅ Load environment variables (if .env exists)
import "dotenv/config";

import * as fs from 'fs';
import * as path from 'path';
import { validateCode } from './code-validator';
import { classifyError } from './error-classifier';

async function testJsxRemoval() {
  console.log('🧪 Testing JSX Removal Strategy...\n');
  
  const testDir = path.join(process.cwd(), 'test-workspace');
  const testFile = path.join(testDir, 'src', 'lib', 'foo.ts');
  
  // Create test directory structure
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  if (!fs.existsSync(path.join(testDir, 'src', 'lib'))) {
    fs.mkdirSync(path.join(testDir, 'src', 'lib'), { recursive: true });
  }
  
  // ✅ TEST 1: Create "gift file" with JSX
  console.log('1️⃣ Creating gift file: src/lib/foo.ts with JSX...');
  const giftContent = `export const x = () => <div>Hello</div>;`;
  fs.writeFileSync(testFile, giftContent, 'utf-8');
  console.log('   ✅ Gift file created\n');
  
  // ✅ TEST 2: Validate code - should return REMOVE_JSX strategy
  console.log('2️⃣ Validating code...');
  const validation = await validateCode(giftContent, 'src/lib/foo.ts', testDir);
  
  if (validation.fixStrategy === 'REMOVE_JSX') {
    console.log('   ✅ PASS: Validator returned fixStrategy: REMOVE_JSX');
  } else {
    console.error(`   ❌ FAIL: Expected REMOVE_JSX, got: ${validation.fixStrategy || 'undefined'}`);
    process.exit(1);
  }
  
  if (!validation.valid) {
    console.log('   ✅ PASS: Validation correctly marked as invalid');
  } else {
    console.error('   ❌ FAIL: Validation should be invalid');
    process.exit(1);
  }
  
  console.log(`   Errors: ${validation.errors.join(', ')}\n`);
  
  // ✅ TEST 3: Classify error - should return TS_SYNTAX_LIB with REMOVE_JSX
  console.log('3️⃣ Classifying error...');
  const errorLog = validation.errors.join('\n');
  
  // ✅ Test with both old (string) and new (options) signatures
  console.log('   Testing with options object (filePath + message)...');
  const classification = classifyError({
    filePath: 'src/lib/foo.ts',
    message: errorLog
  });
  
  // Also test backward compatibility (string only)
  console.log('   Testing backward compatibility (string only)...');
  const classificationOld = classifyError(errorLog);
  
  if (classification.classification === 'TS_SYNTAX_LIB') {
    console.log('   ✅ PASS: Classifier returned TS_SYNTAX_LIB');
  } else {
    console.error(`   ❌ FAIL: Expected TS_SYNTAX_LIB, got: ${classification.classification}`);
    process.exit(1);
  }
  
  if (classification.fixStrategy === 'REMOVE_JSX') {
    console.log('   ✅ PASS: Classifier returned fixStrategy: REMOVE_JSX');
  } else {
    console.error(`   ❌ FAIL: Expected REMOVE_JSX, got: ${classification.fixStrategy}`);
    process.exit(1);
  }
  
  if (!classification.canCache) {
    console.log('   ✅ PASS: Classifier correctly set canCache: false');
  } else {
    console.error('   ❌ FAIL: canCache should be false for JSX errors');
    process.exit(1);
  }
  
  console.log(`   Max retries: ${classification.maxRetries}\n`);
  
  // ✅ Verify backward compatibility
  if (classificationOld.classification === 'TS_SYNTAX_LIB' && classificationOld.fixStrategy === 'REMOVE_JSX') {
    console.log('   ✅ PASS: Backward compatibility works (string signature)');
  } else {
    console.warn(`   ⚠️ Backward compatibility: ${classificationOld.classification} (may need filePath extraction)`);
  }
  
  // ✅ TEST 4: Test with different lib file names
  console.log('4️⃣ Testing with different lib file names...');
  const testFiles = [
    'src/lib/bar.ts',
    'src/lib/utils.ts',
    'src/lib/api.ts',
    'src/lib/claude-client.ts',
    'src/lib/random-file.ts'
  ];
  
  for (const fileName of testFiles) {
    const testValidation = await validateCode(giftContent, fileName, testDir);
    if (testValidation.fixStrategy === 'REMOVE_JSX') {
      console.log(`   ✅ PASS: ${fileName} → REMOVE_JSX`);
    } else {
      console.error(`   ❌ FAIL: ${fileName} → ${testValidation.fixStrategy || 'undefined'}`);
      process.exit(1);
    }
  }
  
  // ✅ TEST 5: Test with tsc output format
  console.log('\n5️⃣ Testing with tsc output format...');
  const tscErrors = [
    {
      filePath: 'src/lib/bar.ts',
      message: 'error TS17004: Cannot use JSX unless the \'--jsx\' flag is provided.'
    },
    {
      filePath: 'src/lib/baz.ts',
      message: 'src/lib/baz.ts(5,10): error TS17004: JSX element implicitly has type \'any\'.'
    }
  ];
  
  for (const tscError of tscErrors) {
    const tscClassification = classifyError({
      filePath: tscError.filePath,
      message: tscError.message
    });
    
    if (tscClassification.classification === 'TS_SYNTAX_LIB' && tscClassification.fixStrategy === 'REMOVE_JSX') {
      console.log(`   ✅ PASS: ${tscError.filePath} (tsc format) → TS_SYNTAX_LIB + REMOVE_JSX`);
    } else {
      console.error(`   ❌ FAIL: ${tscError.filePath} → ${tscClassification.classification} (expected TS_SYNTAX_LIB)`);
      process.exit(1);
    }
  }
  
  console.log('\n✅ ALL TESTS PASSED!');
  console.log('\n📋 Summary:');
  console.log('   - Validator correctly identifies JSX in lib files');
  console.log('   - Validator returns REMOVE_JSX strategy');
  console.log('   - Classifier correctly classifies as TS_SYNTAX_LIB');
  console.log('   - Classifier returns REMOVE_JSX strategy');
  console.log('   - Strategy works for ALL lib files (not just specific ones)');
  console.log('   - canCache is false (prevents caching bad JSX)');
  
  // Cleanup
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('\n🧹 Cleaned up test workspace');
  }
}

testJsxRemoval().catch(console.error);

