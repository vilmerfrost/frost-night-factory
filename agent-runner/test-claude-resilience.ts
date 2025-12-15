import * as assert from "node:assert/strict";
import { Semaphore } from "./lib/ai/resilience/semaphore";
import { CircuitBreaker } from "./lib/ai/resilience/circuitBreaker";
import { callClaudeWithResilienceWithDeps, ClaudeOverloadExhaustedError } from "./lib/ai/resilience/claudeResilience";

async function run() {
  // Fake clock (no real sleeping)
  let now = 0;
  const slept: number[] = [];

  const clock = {
    now: () => now,
    sleep: async (ms: number) => {
      slept.push(ms);
      now += ms;
    },
  };

  const deps = {
    clock,
    random: () => 0.5, // deterministic jitter
    claudeSemaphore: new Semaphore(1),
    breaker: new CircuitBreaker(
      {
        openAfterFailures: 5,
        openWindowMs: 60_000,
        halfOpenAfterMs: 30_000,
        closeAfterSuccesses: 3,
      },
      clock
    ),
  };

  // Case 1: succeeds after 3 overloads
  {
    let calls = 0;
    const res = await callClaudeWithResilienceWithDeps(
      async () => {
        calls++;
        if (calls <= 3) {
          const e: any = new Error("529 overloaded_error");
          e.status = 529;
          throw e;
        }
        return "OK";
      },
      { label: "test-case-1", maxAttempts: 6, maxTotalWaitMs: 300_000 },
      deps
    );

    assert.equal(res, "OK");
    assert.equal(calls, 4);
    assert.ok(slept.length >= 3, "should have slept between retries");
  }

// Case 2: exhausts total wait budget and throws special error
{
    let calls = 0;
    let threw = false;

    try {
      await callClaudeWithResilienceWithDeps(
        async () => {
          calls++;
          const e: any = new Error("529 overloaded_error");
          e.status = 529;
          throw e;
        },
        { label: "test-case-2", maxAttempts: 3, maxTotalWaitMs: 25_000 },
        deps
      );
    } catch (err) {
      threw = true;
      assert.ok(err instanceof ClaudeOverloadExhaustedError);
    }

    assert.equal(threw, true);
    assert.equal(calls, 2);
  }

  console.log("✅ test-claude-resilience passed");
}

run().catch((e) => {
  console.error("❌ test-claude-resilience failed:", e);
  process.exit(1);
});

