// agent-runner/model-router.ts
// ✅ Phase 3: Smart Model Routing - Route simple tasks to cheaper models

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'groq'
  model: string
  inputCost: number   // per 1M tokens
  outputCost: number
  maxTokens: number
  speed: 'fast' | 'medium' | 'slow'
}

const MODELS: Record<string, ModelConfig> = {
  'groq-fast': {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    inputCost: 0.05,
    outputCost: 0.08,
    maxTokens: 8000,
    speed: 'fast'
  },
  'deepseek-cheap': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    inputCost: 0.14,
    outputCost: 0.28,
    maxTokens: 64000,
    speed: 'fast'
  },
  'deepseek-smart': {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    inputCost: 0.55,
    outputCost: 2.19,
    maxTokens: 64000,
    speed: 'slow'
  },
  'claude-premium': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    inputCost: 3.00,
    outputCost: 15.00,
    maxTokens: 200000,
    speed: 'medium'
  },
  'claude-haiku': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    inputCost: 0.80,
    outputCost: 4.00,
    maxTokens: 200000,
    speed: 'fast'
  }
}

/**
 * Select optimal model based on error type, complexity, and attempt number
 */
export function selectOptimalModel(
  errorType: string,
  complexity: 'easy' | 'medium' | 'hard',
  attemptNumber: number
): ModelConfig {
  
  // Easy tasks → Cheapest model
  if (complexity === 'easy') {
    // Syntax errors, unused imports
    if (errorType.includes('TS6133') ||
        errorType.includes('TS1005') ||
        errorType.includes('unused') ||
        errorType.includes('syntax') ||
        errorType.includes('TS2304')) {
      return MODELS['groq-fast']  // 95% cheaper than Claude
    }
    
    // Simple fixes → DeepSeek cheap
    return MODELS['deepseek-cheap']  // 95% cheaper than Claude
  }
  
  // Medium tasks → DeepSeek V3
  if (complexity === 'medium') {
    return MODELS['deepseek-cheap']  // 95% cheaper than Claude
  }
  
  // Hard tasks or retries → Escalate
  if (complexity === 'hard' || attemptNumber > 3) {
    // Architecture, refactoring, or failed multiple times
    if (errorType.includes('architecture') ||
        errorType.includes('refactor') ||
        attemptNumber > 5) {
      return MODELS['claude-premium']  // Best quality
    }
    
    return MODELS['deepseek-smart']  // Good reasoning
  }
  
  // Default: DeepSeek cheap (safe choice)
  return MODELS['deepseek-cheap']
}

/**
 * Estimate complexity based on error log and file count
 */
export function estimateComplexity(
  errorLog: string,
  fileCount: number
): 'easy' | 'medium' | 'hard' {
  
  const log = errorLog.toLowerCase()
  
  // Easy: Single-file, known patterns
  if (fileCount === 1 &&
      (log.includes('ts6133') ||  // Unused
       log.includes('ts1005') ||  // Syntax
       log.includes('ts2304') ||  // Not found
       log.includes('unused') ||
       log.includes('declared but never'))) {
    return 'easy'
  }
  
  // Hard: Multi-file, architecture
  if (fileCount > 3 ||
      log.includes('refactor') ||
      log.includes('redesign') ||
      log.includes('architecture') ||
      log.includes('type error') ||
      log.includes('cannot find module')) {
    return 'hard'
  }
  
  return 'medium'
}

/**
 * Get model name string for use in callAI
 */
export function getModelName(config: ModelConfig): string {
  return config.model
}

