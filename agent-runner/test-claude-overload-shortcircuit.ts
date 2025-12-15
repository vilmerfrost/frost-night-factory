import assert from "node:assert/strict";
import { callClaudeFrontendStrict, ClaudeOverloadExhaustedError } from "./lib/claude/claude-gateway";

/**
 * Integration test: Verifies that Claude overload exhaustion
 * stops the pipeline cleanly instead of doing 10×6 retries.
 */
async function run() {
  let calls = 0;

  try {
    await callClaudeFrontendStrict("integration-shortcircuit", async () => {
      calls++;
      const e: any = new Error("529 overloaded_error");
      e.status = 529;
      throw e;
    });
    assert.fail("Expected overload exhausted error");
  } catch (err) {
    assert.ok(err instanceof ClaudeOverloadExhaustedError, "Should throw ClaudeOverloadExhaustedError");
  }

  // Nyckelassert: ska vara EXACT vad din config säger (6), inte 10x outer-loop
  assert.equal(calls, 6, `Expected exactly 6 attempts (maxAttempts), got ${calls}`);
  console.log("✅ test-claude-overload-shortcircuit passed");
}

run().catch((e) => {
  console.error("❌ test-claude-overload-shortcircuit failed:", e);
  process.exit(1);
});

