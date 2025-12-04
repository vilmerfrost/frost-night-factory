// agent-runner/smart-circuit-breaker.ts

interface ErrorClassification {
  type: 'TRANSIENT' | 'FIXABLE_AUTO' | 'FIXABLE_AI' | 'FATAL'
  category: string
  maxRetries: number
  backoffMs: number
  strategy: 'RETRY' | 'SANITIZER' | 'AI_FIX' | 'GOLDEN_TEMPLATE' | 'ABORT'
}

interface CircuitState {
  errorKey: string
  attempts: number
  lastAttempt: number
  strategies: string[]
}

export class SmartCircuitBreaker {
  private state: Map<string, CircuitState> = new Map()
  private globalFailures: number = 0
  private readonly MAX_GLOBAL_FAILURES = 15
  
  classifyError(errorMessage: string): ErrorClassification {
    const msg = errorMessage.toLowerCase()
    
    // ═══════════════════════════════════════════════════════════════
    // TRANSIENT ERRORS (Network, API timeouts)
    // ═══════════════════════════════════════════════════════════════
    if (msg.includes('terminated') || 
        msg.includes('timeout') ||
        msg.includes('econnreset') ||
        msg.includes('rate limit') ||
        msg.includes('429')) {
      return {
        type: 'TRANSIENT',
        category: 'API_TIMEOUT',
        maxRetries: 5,
        backoffMs: 2000,
        strategy: 'RETRY'
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // AUTO-FIXABLE ERRORS (Deterministic fixes, no AI needed)
    // ═══════════════════════════════════════════════════════════════
    if (msg.includes('ts6133') || msg.includes('declared but')) {
      return {
        type: 'FIXABLE_AUTO',
        category: 'UNUSED_IMPORT',
        maxRetries: 3,
        backoffMs: 0,
        strategy: 'SANITIZER'
      }
    }
    
    if (msg.includes('ts1005') || msg.includes('expected')) {
      return {
        type: 'FIXABLE_AUTO',
        category: 'JSX_SYNTAX',
        maxRetries: 2,
        backoffMs: 0,
        strategy: 'GOLDEN_TEMPLATE'  // Replace with known-good file
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // AI-FIXABLE ERRORS (Need AI intervention)
    // ═══════════════════════════════════════════════════════════════
    if (msg.includes('ts2307') || msg.includes('cannot find module')) {
      return {
        type: 'FIXABLE_AI',
        category: 'MISSING_MODULE',
        maxRetries: 3,
        backoffMs: 500,
        strategy: 'AI_FIX'
      }
    }
    
    if (msg.includes('ts2339') || msg.includes('does not exist on type')) {
      return {
        type: 'FIXABLE_AI',
        category: 'TYPE_MISMATCH',
        maxRetries: 3,
        backoffMs: 500,
        strategy: 'AI_FIX'
      }
    }
    
    if (msg.includes('ts2724') || msg.includes('no exported member')) {
      return {
        type: 'FIXABLE_AI',
        category: 'MISSING_EXPORT',
        maxRetries: 3,
        backoffMs: 500,
        strategy: 'AI_FIX'
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // FATAL ERRORS (Cannot recover automatically)
    // ═══════════════════════════════════════════════════════════════
    if (msg.includes('pgrst') || msg.includes('database') || msg.includes('supabase')) {
      return {
        type: 'FATAL',
        category: 'DATABASE_ERROR',
        maxRetries: 1,
        backoffMs: 0,
        strategy: 'ABORT'
      }
    }
    
    if (msg.includes('enoent') || msg.includes('no such file')) {
      return {
        type: 'FATAL',
        category: 'FILESYSTEM_ERROR',
        maxRetries: 1,
        backoffMs: 0,
        strategy: 'ABORT'
      }
    }
    
    // Default: Assume AI can fix it
    return {
      type: 'FIXABLE_AI',
      category: 'UNKNOWN',
      maxRetries: 2,
      backoffMs: 1000,
      strategy: 'AI_FIX'
    }
  }
  
  getErrorKey(errorMessage: string): string {
    // Normalize error to create consistent key
    return errorMessage
      .replace(/\d+/g, 'N')           // Replace numbers
      .replace(/[a-f0-9-]{36}/gi, 'UUID')  // Replace UUIDs
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .slice(0, 100)                  // Limit length
  }
  
  shouldRetry(errorMessage: string): { 
    retry: boolean
    strategy: string
    reason: string
    waitMs: number
  } {
    const errorKey = this.getErrorKey(errorMessage)
    const classification = this.classifyError(errorMessage)
    
    // Get or create state
    let state = this.state.get(errorKey)
    if (!state) {
      state = {
        errorKey,
        attempts: 0,
        lastAttempt: 0,
        strategies: []
      }
      this.state.set(errorKey, state)
    }
    
    state.attempts++
    state.lastAttempt = Date.now()
    state.strategies.push(classification.strategy)
    this.globalFailures++
    
    // Global circuit breaker
    if (this.globalFailures >= this.MAX_GLOBAL_FAILURES) {
      return {
        retry: false,
        strategy: 'ABORT',
        reason: `Global failure limit reached (${this.MAX_GLOBAL_FAILURES})`,
        waitMs: 0
      }
    }
    
    // Per-error circuit breaker
    if (state.attempts >= classification.maxRetries) {
      return {
        retry: false,
        strategy: classification.strategy,
        reason: `Max retries (${classification.maxRetries}) for ${classification.category}`,
        waitMs: 0
      }
    }
    
    // Calculate backoff with jitter
    const baseDelay = classification.backoffMs * Math.pow(2, state.attempts - 1)
    const jitter = Math.random() * 1000
    const waitMs = baseDelay + jitter
    
    return {
      retry: true,
      strategy: classification.strategy,
      reason: `Attempt ${state.attempts}/${classification.maxRetries} for ${classification.category}`,
      waitMs
    }
  }
  
  recordSuccess(errorKey?: string) {
    if (errorKey) {
      this.state.delete(this.getErrorKey(errorKey))
    }
    this.globalFailures = Math.max(0, this.globalFailures - 1)
  }
  
  reset() {
    this.state.clear()
    this.globalFailures = 0
  }
  
  getStats(): { 
    globalFailures: number
    errorTypes: { [key: string]: number }
  } {
    const errorTypes: { [key: string]: number } = {}
    
    for (const [key, state] of this.state) {
      const classification = this.classifyError(key)
      errorTypes[classification.category] = (errorTypes[classification.category] || 0) + state.attempts
    }
    
    return { globalFailures: this.globalFailures, errorTypes }
  }
}

// Export singleton
export const circuitBreaker = new SmartCircuitBreaker()

