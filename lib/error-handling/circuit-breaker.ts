// =============================================================================
// CIRCUIT BREAKER - Prevents cascading failures
// =============================================================================

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;      // Trip after N failures
  recoveryTimeout: number;       // Wait this long before retry (ms)
  successThreshold: number;      // Successes needed to close
  name: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    // OPEN → Don't execute, throw immediately
    if (this.state === 'OPEN') {
      const timeSince = Date.now() - (this.lastFailureTime || 0);
      
      if (timeSince < this.config.recoveryTimeout) {
        throw new Error(`Circuit OPEN for ${this.config.name} - wait ${Math.ceil((this.config.recoveryTimeout - timeSince) / 1000)}s`);
      }

      console.log(`🔄 Circuit HALF-OPEN: Testing ${this.config.name}...`);
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }

    try {
      const result = await action();

      // Track successes in HALF-OPEN
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        
        if (this.successCount >= this.config.successThreshold) {
          console.log(`✅ Circuit CLOSED: ${this.config.name} recovered!`);
          this.state = 'CLOSED';
          this.failureCount = 0;
        }
      } else if (this.state === 'CLOSED') {
        // Reset failure count on success
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      console.log(`❌ Circuit failure #${this.failureCount}/${this.config.failureThreshold} (${this.config.name})`);

      if (this.failureCount >= this.config.failureThreshold) {
        console.log(`🔌 Circuit OPEN: ${this.config.name} - Too many failures!`);
        this.state = 'OPEN';
      }

      throw error;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failureCount,
      name: this.config.name
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

