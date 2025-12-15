export type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type Clock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

export type BreakerConfig = {
  openAfterFailures: number;     // ex 5
  openWindowMs: number;          // ex 60_000
  halfOpenAfterMs: number;       // ex 30_000
  closeAfterSuccesses: number;   // ex 3
};

type FailureEvent = { at: number };

export class CircuitBreaker {
  private state: BreakerState = "CLOSED";
  private failures: FailureEvent[] = [];
  private openUntil = 0;
  private halfOpenSuccesses = 0;

  constructor(private cfg: BreakerConfig, private clock: Clock) {}

  getState(): BreakerState {
    // auto-transition OPEN -> HALF_OPEN när tiden gått
    if (this.state === "OPEN" && this.clock.now() >= this.openUntil) {
      this.state = "HALF_OPEN";
      this.halfOpenSuccesses = 0;
    }
    return this.state;
  }

  async preflightWaitIfNeeded(): Promise<void> {
    if (this.getState() !== "OPEN") return;
    const waitMs = Math.max(0, this.openUntil - this.clock.now());
    if (waitMs > 0) await this.clock.sleep(waitMs);
  }

  recordFailure(): void {
    const now = this.clock.now();
    this.failures.push({ at: now });

    // drop old failures outside window
    const windowStart = now - this.cfg.openWindowMs;
    this.failures = this.failures.filter((f) => f.at >= windowStart);

    if (this.state === "HALF_OPEN") {
      // any failure in HALF_OPEN => back to OPEN
      this.tripOpen(now);
      return;
    }

    if (this.failures.length >= this.cfg.openAfterFailures && this.state === "CLOSED") {
      this.tripOpen(now);
    }
  }

  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.cfg.closeAfterSuccesses) {
        this.state = "CLOSED";
        this.failures = [];
        this.openUntil = 0;
        this.halfOpenSuccesses = 0;
      }
    } else {
      // normal success resets failure window gradually
      this.failures = [];
    }
  }

  private tripOpen(now: number) {
    this.state = "OPEN";
    this.openUntil = now + this.cfg.halfOpenAfterMs;
    this.halfOpenSuccesses = 0;
  }
}

