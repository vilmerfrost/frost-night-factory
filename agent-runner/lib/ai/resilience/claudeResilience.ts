import { Semaphore } from "./semaphore";
import { CircuitBreaker, type Clock } from "./circuitBreaker";

export type LlmErrorKind =
  | "OVERLOADED" // 529
  | "RATE_LIMIT" // 429
  | "TIMEOUT"
  | "BAD_REQUEST" // 400
  | "AUTH" // 401/403
  | "UNKNOWN";

export class ClaudeOverloadExhaustedError extends Error {
  public readonly retryAfterMs: number;
  public readonly attempts: number;
  public readonly lastMessage: string;

  constructor(opts: { retryAfterMs: number; attempts: number; lastMessage: string }) {
    super(`Claude overload retry exhausted after ${opts.attempts} attempts. retryAfterMs=${opts.retryAfterMs}. last=${opts.lastMessage}`);
    this.name = "ClaudeOverloadExhaustedError";
    this.retryAfterMs = opts.retryAfterMs;
    this.attempts = opts.attempts;
    this.lastMessage = opts.lastMessage;
  }
}

export function classifyLlmError(err: unknown): { kind: LlmErrorKind; status?: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const m = message.toLowerCase();
  const status = (err as any)?.status ?? (err as any)?.response?.status;

  if (status === 529 || m.includes("overloaded") || m.includes("529")) return { kind: "OVERLOADED", status, message };
  if (status === 429 || m.includes("rate limit") || m.includes("429")) return { kind: "RATE_LIMIT", status, message };
  if (m.includes("timeout") || m.includes("timed out") || m.includes("etimedout")) return { kind: "TIMEOUT", status, message };
  if (status === 400) return { kind: "BAD_REQUEST", status, message };
  if (status === 401 || status === 403) return { kind: "AUTH", status, message };
  return { kind: "UNKNOWN", status, message };
}

export type ClaudeResilienceOptions = {
  label: string;                 // ex "bulk_frontend:src/app/invoices/upload/page.tsx"
  maxAttempts?: number;          // default 6
  maxTotalWaitMs?: number;       // default 300_000 (5 min)
  requestTimeoutMs?: number;     // optional (om din client stödjer)
};

type ResilienceDeps = {
  clock: Clock;
  random(): number;
  claudeSemaphore: Semaphore;
  breaker: CircuitBreaker;
};

function defaultClock(): Clock {
  return {
    now: () => Date.now(),
    sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  };
}

function backoffMs(attempt: number, kind: LlmErrorKind, rand01: number): number {
  // 529: börja hårdare (10s) för att undvika spam
  const base = kind === "OVERLOADED" ? 10_000 : 1_000;
  const cap = 60_000;
  const exp = Math.min(base * Math.pow(2, attempt), cap);

  // jitter ±50%
  const jitter = exp * 0.5 * (rand01 * 2 - 1);
  return Math.max(500, Math.round(exp + jitter));
}

// Singleton in-process caps (viktigt om du kör flera pipelines samtidigt)
const singletonDeps: ResilienceDeps = (() => {
  const clock = defaultClock();
  const claudeSemaphore = new Semaphore(2); // ✅ global concurrency cap (justera 1–3)
  const breaker = new CircuitBreaker(
    {
      openAfterFailures: 5,
      openWindowMs: 60_000,
      halfOpenAfterMs: 30_000,
      closeAfterSuccesses: 3,
    },
    clock
  );

  return {
    clock,
    random: () => Math.random(),
    claudeSemaphore,
    breaker,
  };
})();

/**
 * Wrap Claude calls for FRONTEND code generation (Claude-only).
 * Retries ONLY for overload/rate-limit/timeout with strong backoff + circuit breaker + concurrency cap.
 */
export async function callClaudeWithResilience<T>(
  fn: () => Promise<T>,
  opts: ClaudeResilienceOptions
): Promise<T> {
  return callClaudeWithResilienceWithDeps(fn, opts, singletonDeps);
}

// Exported for tests (dependency injection)
export async function callClaudeWithResilienceWithDeps<T>(
  fn: () => Promise<T>,
  opts: ClaudeResilienceOptions,
  deps: ResilienceDeps
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 6;
  const maxTotalWaitMs = opts.maxTotalWaitMs ?? 300_000;

  let totalWait = 0;
  let lastMsg = "unknown";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // circuit breaker check (may wait if OPEN)
    await deps.breaker.preflightWaitIfNeeded();

    const release = await deps.claudeSemaphore.acquire();
    const started = deps.clock.now();

    try {
      const res = await fn();
      deps.breaker.recordSuccess();
      return res;
    } catch (err) {
      const { kind, message, status } = classifyLlmError(err);
      lastMsg = message;

      // Fail fast on non-retryable
      if (kind !== "OVERLOADED" && kind !== "RATE_LIMIT" && kind !== "TIMEOUT") {
        deps.breaker.recordFailure();
        throw err;
      }

      // retryable => record failure + backoff
      deps.breaker.recordFailure();

      const delay = backoffMs(attempt, kind, deps.random());
      totalWait += delay;

      const elapsed = deps.clock.now() - started;
      console.warn(
        `🧯 [CLAUDE RESILIENCE] ${opts.label} attempt ${attempt + 1}/${maxAttempts} failed (${kind}${status ? `:${status}` : ""}) in ${elapsed}ms. Backing off ${delay}ms (totalWait=${totalWait}ms). msg=${message}`
      );

      // if exceeded budget -> throw special error so outer loops don't keep spamming "10 attempts"
      if (totalWait > maxTotalWaitMs || attempt === maxAttempts - 1) {
        const retryAfterMs = Math.min(300_000, delay);
        throw new ClaudeOverloadExhaustedError({
          retryAfterMs,
          attempts: attempt + 1,
          lastMessage: lastMsg,
        });
      }

      await deps.clock.sleep(delay);
    } finally {
      release();
    }
  }

  // should never hit
  throw new ClaudeOverloadExhaustedError({ retryAfterMs: 60_000, attempts: maxAttempts, lastMessage: lastMsg });
}

