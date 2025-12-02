// =============================================================================
// PATH CIRCUIT BREAKER - Prevent infinite path operation failures
// =============================================================================

/**
 * Path Circuit Breaker
 * Tracks failures per path and throws after max failures
 */
export class PathCircuitBreaker {
  private static instance: PathCircuitBreaker;
  private failedPaths = new Map<string, { count: number; lastError: string; firstFailure: Date }>();
  private maxFailures = 3;
  
  private constructor() {}
  
  static getInstance(): PathCircuitBreaker {
    if (!PathCircuitBreaker.instance) {
      PathCircuitBreaker.instance = new PathCircuitBreaker();
    }
    return PathCircuitBreaker.instance;
  }
  
  /**
   * Record a path operation failure
   */
  recordFailure(path: string, error: Error): void {
    const existing = this.failedPaths.get(path) || {
      count: 0,
      lastError: '',
      firstFailure: new Date(),
    };
    
    existing.count++;
    existing.lastError = error.message;
    
    this.failedPaths.set(path, existing);
    
    if (existing.count >= this.maxFailures) {
      const errorMessage = `
🚨 PATH CIRCUIT BREAKER TRIGGERED 🚨

Path: ${path}
Failed ${existing.count} times
First failure: ${existing.firstFailure.toISOString()}
Last error: ${existing.lastError}

Possible causes:
1. Path is hardcoded incorrectly
2. Directory doesn't exist and can't be created
3. Permission issues
4. File system is locked
5. Disk is full

Manual intervention required.
Check path-operations.log for details.
      `.trim();
      
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Reset failure count for a path (after successful operation)
   */
  reset(path: string): void {
    this.failedPaths.delete(path);
  }
  
  /**
   * Get failure count for a path
   */
  getFailureCount(path: string): number {
    return this.failedPaths.get(path)?.count || 0;
  }
  
  /**
   * Check if path is in circuit breaker state
   */
  isOpen(path: string): boolean {
    return this.getFailureCount(path) >= this.maxFailures;
  }
  
  /**
   * Get all failed paths
   */
  getFailedPaths(): Array<{ path: string; count: number; lastError: string }> {
    return Array.from(this.failedPaths.entries()).map(([path, data]) => ({
      path,
      count: data.count,
      lastError: data.lastError,
    }));
  }
  
  /**
   * Reset all failures
   */
  resetAll(): void {
    this.failedPaths.clear();
    console.log('🔄 Path Circuit Breaker reset');
  }
}

