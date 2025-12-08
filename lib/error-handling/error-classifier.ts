// =============================================================================
// ERROR CLASSIFIER - Categorizes errors to decide: retry or fail fast?
// =============================================================================

export type ErrorCategory =
  | 'network'        // ECONNRESET, timeouts, 502, 503
  | 'rate_limit'     // 429
  | 'llm_api'        // LLM errors
  | 'validation'     // Schema/type errors
  | 'code'           // TS errors, syntax
  | 'dependency'     // Missing imports
  | 'import'         // Import failures (our current issue!)
  | 'invariant'      // Logic assumptions broken
  | 'unknown';

export interface ErrorDetails {
  category: ErrorCategory;
  code?: string;
  message: string;
  retryable: boolean;
  raw: unknown;
}

/**
 * Classify errors to decide: retry or fail fast?
 */
export function classifyError(err: any): ErrorDetails {
  const message = String(err?.message ?? err ?? 'Unknown error');
  const stack = err?.stack ?? '';

  // 🚨 IMPORT ERRORS (Your current problem!)
  if (
    message.includes('Cannot convert undefined or null to object') ||
    message.includes('GOLDEN_COMPONENTS') ||
    (message.includes('undefined') && stack.includes('Object.entries')) ||
    message.includes('failed to import') ||
    message.includes('Import failure')
  ) {
    return {
      category: 'import',
      code: 'IMPORT_FAILED',
      message: `Import failure: ${message}`,
      retryable: false, // Don't retry - needs code fix
      raw: err
    };
  }

  // NETWORK ERRORS → Retry
  if (
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('timeout')
  ) {
    return {
      category: 'network',
      code: 'NETWORK',
      message,
      retryable: true,
      raw: err
    };
  }

  // RATE LIMIT → Retry with backoff
  if (message.includes('429') || message.includes('rate limit') || message.includes('RateLimitError')) {
    return {
      category: 'rate_limit',
      code: 'RATE_LIMIT',
      message,
      retryable: true,
      raw: err
    };
  }

  // TYPESCRIPT ERRORS → Don't retry (needs code fix)
  if (message.includes('TS') || message.includes('TypeScript') || message.includes('TS1261')) {
    return {
      category: 'code',
      code: 'TS_ERROR',
      message,
      retryable: false,
      raw: err
    };
  }

  // MISSING IMPORTS → Don't retry
  if (message.includes('Cannot find module') || message.includes('TS2307') || message.includes('Module not found')) {
    return {
      category: 'dependency',
      code: 'MISSING_MODULE',
      message,
      retryable: false,
      raw: err
    };
  }

  // LLM API ERRORS → Retry (transient)
  if (
    message.includes('API') ||
    message.includes('OpenAI') ||
    message.includes('Anthropic') ||
    message.includes('Claude') ||
    message.includes('Gemini')
  ) {
    return {
      category: 'llm_api',
      code: 'LLM_API_ERROR',
      message,
      retryable: true,
      raw: err
    };
  }

  // VALIDATION ERRORS → Don't retry
  if (message.includes('validation') || message.includes('schema') || message.includes('invalid')) {
    return {
      category: 'validation',
      code: 'VALIDATION_ERROR',
      message,
      retryable: false,
      raw: err
    };
  }

  return {
    category: 'unknown',
    code: 'UNKNOWN',
    message,
    retryable: false,
    raw: err
  };
}

