// =============================================================================
// ERROR HANDLING TEST SUITE - Validates all error handling systems
// =============================================================================

import { classifyError } from '../lib/error-handling/error-classifier';
import { CircuitBreaker } from '../lib/error-handling/circuit-breaker';
import { LoopPrevention } from '../lib/error-handling/loop-prevention';

async function testErrorHandling() {
  console.log('🧪 Testing Error Handling System...\n');

  // Test 1: Error Classification
  console.log('Test 1: Error Classification');
  const importError = new Error('Cannot convert undefined or null to object at Object.entries');
  const classified = classifyError(importError);
  console.log('  Import error classified as:', classified.category);
  console.log('  Retryable:', classified.retryable); // Should be FALSE
  console.assert(classified.category === 'import', 'Import error not detected!');
  console.assert(classified.retryable === false, 'Import error marked as retryable!');
  console.log('  ✅ Pass\n');

  // Test 2: Network Error Classification
  console.log('Test 2: Network Error Classification');
  const networkError = new Error('ECONNRESET');
  const networkClassified = classifyError(networkError);
  console.log('  Network error classified as:', networkClassified.category);
  console.log('  Retryable:', networkClassified.retryable); // Should be TRUE
  console.assert(networkClassified.category === 'network', 'Network error not detected!');
  console.assert(networkClassified.retryable === true, 'Network error not marked as retryable!');
  console.log('  ✅ Pass\n');

  // Test 3: Circuit Breaker
  console.log('Test 3: Circuit Breaker');
  const breaker = new CircuitBreaker({
    failureThreshold: 3,
    recoveryTimeout: 1000,
    successThreshold: 2,
    name: 'Test'
  });

  let failCount = 0;
  for (let i = 0; i < 5; i++) {
    try {
      await breaker.execute(async () => {
        throw new Error('Simulated failure');
      });
    } catch (error) {
      failCount++;
      const status = breaker.getStatus();
      console.log(`  Attempt ${i + 1}: Failed (State: ${status.state}, Failures: ${status.failures})`);
      if (status.state === 'OPEN') {
        break;
      }
    }
  }
  console.assert(breaker.getStatus().state === 'OPEN', 'Circuit breaker did not open!');
  console.log('  ✅ Circuit breaker opened correctly\n');

  // Test 4: Loop Prevention
  console.log('Test 4: Loop Prevention');
  const loopPrev = new LoopPrevention({
    maxIterations: 5,
    convergenceThreshold: 100,
    errorBudget: new Map([['TEST_ERROR', 2]])
  });

  let stopped = false;
  let stopReason = '';
  for (let i = 0; i < 10; i++) {
    const result = loopPrev.shouldContinue(['TEST_ERROR']);
    if (!result.continue) {
      console.log(`  Stopped at iteration ${i + 1}: ${result.reason}`);
      stopped = true;
      stopReason = result.reason || '';
      break;
    }
  }
  console.assert(stopped, 'Loop prevention did not stop!');
  console.assert(stopReason.includes('STUCK'), 'Loop prevention did not detect stuck error!');
  console.log('  ✅ Loop prevention working\n');

  // Test 5: Max Iterations
  console.log('Test 5: Max Iterations');
  const loopPrev2 = new LoopPrevention({
    maxIterations: 3,
    convergenceThreshold: 100,
    errorBudget: new Map([['DIFFERENT_ERROR', 10]])
  });

  let maxIterStopped = false;
  for (let i = 0; i < 10; i++) {
    const result = loopPrev2.shouldContinue(['DIFFERENT_ERROR']);
    if (!result.continue) {
      maxIterStopped = true;
      console.log(`  Stopped at iteration ${i + 1}: ${result.reason}`);
      break;
    }
  }
  console.assert(maxIterStopped, 'Max iterations did not stop!');
  console.log('  ✅ Max iterations working\n');

  console.log('🎉 All tests passed!');
}

testErrorHandling().catch(console.error);

