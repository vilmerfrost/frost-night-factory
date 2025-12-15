// agent-runner/lib/claude/claude-gateway.ts
import { callClaudeWithResilience, ClaudeOverloadExhaustedError, type ClaudeResilienceOptions } from "../ai/resilience/claudeResilience";

/**
 * Central gateway for all Claude/Anthropic API calls.
 * Wraps calls with resilience (retry on overload/rate-limit/timeout).
 * 
 * This ensures all Claude calls go through a single point that handles:
 * - Circuit breaker (stops calling when overloaded)
 * - Exponential backoff with jitter
 * - Concurrency limiting (semaphore)
 * - Fail-fast on exhaustion
 */
export async function callClaudeFrontendStrict<T>(
  label: string,
  doCall: () => Promise<T>
): Promise<T> {
  // Frontend = CLAUDE ONLY (ingen annan provider)
  const opts: ClaudeResilienceOptions = {
    label,
    maxAttempts: 6,
    maxTotalWaitMs: 300_000, // 5 minutes
  };
  
  return callClaudeWithResilience(doCall, opts);
}

// Re-export for convenience so call sites can catch the error type
export { ClaudeOverloadExhaustedError };

