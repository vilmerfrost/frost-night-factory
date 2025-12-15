export class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    if (!Number.isFinite(max) || max <= 0) throw new Error(`Semaphore max must be > 0, got ${max}`);
    this.available = max;
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available--;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.available--;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.available++;
    const next = this.queue.shift();
    if (next) next();
  }
}

