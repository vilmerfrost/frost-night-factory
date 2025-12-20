/**
 * COMPLETION VALIDATOR v10
 * Detects stub/incomplete code and rejects it
 * Prevents TODO files from passing validation
 */

export interface CompletionResult {
  isComplete: boolean;
  confidence: number;
  issues: string[];
  stubIndicators: string[];
}

/**
 * Check if code is actually implemented (not a stub)
 */
export function validateCompletion(
  code: string,
  filePath: string,
  expectedExports?: string[]
): CompletionResult {
  const issues: string[] = [];
  const stubIndicators: string[] = [];
  
  // 1. Check for TODO markers
  const todoPatterns = [
    /\/\/\s*TODO:/i,
    /\/\*\s*TODO:/i,
    /Pending implementation/i,
    /To be implemented/i,
    /IMPLEMENT THIS/i,
    /STUB/i
  ];
  
  for (const pattern of todoPatterns) {
    if (pattern.test(code)) {
      stubIndicators.push(`Found TODO marker: ${pattern.source}`);
    }
  }
  
  // 2. Check for stub patterns
  const stubPatterns = [
    /^\/\/[^\n]+\n\/\/\s*Type:[^\n]+\n\/\/\s*TODO:[^\n]+$/m, // Common stub format
    /export\s+default\s+\{\s*\}/,                              // Empty default export
    /export\s+const\s+\w+\s*=\s*\{\s*\}/,                     // Empty named export
    /function\s+\w+\([^)]*\)\s*\{\s*\}/,                      // Empty function
  ];
  
  for (const pattern of stubPatterns) {
    if (pattern.test(code)) {
      stubIndicators.push(`Found stub pattern: ${pattern.source}`);
    }
  }
  
  // 3. Check code length (real code is longer)
  const minCodeLength = filePath.includes('components/ui/') ? 300 : 150;
  if (code.length < minCodeLength) {
    issues.push(`Code too short (${code.length} chars, expected ${minCodeLength}+)`);
  }
  
  // 4. Check for actual logic
  const hasLogic = 
    /return\s+[^;]+/.test(code) ||      // Has return statements
    /const\s+\w+\s*=/.test(code) ||      // Has variable assignments
    /if\s*\(/.test(code) ||              // Has conditionals
    /\w+\([^)]*\)\s*{[^}]+}/.test(code); // Has function bodies
  
  if (!hasLogic) {
    issues.push('No actual logic detected (no returns, conditionals, or assignments)');
  }
  
  // 5. Check for required exports (if specified)
  if (expectedExports && expectedExports.length > 0) {
    const missingExports = expectedExports.filter(exp => {
      const exportRegex = new RegExp(`export\\s+(const|function|class)\\s+${exp}\\b`);
      return !exportRegex.test(code);
    });
    
    if (missingExports.length > 0) {
      issues.push(`Missing required exports: ${missingExports.join(', ')}`);
    }
  }
  
  // 6. UI Components must have JSX
  if (filePath.includes('components/') && !filePath.includes('types')) {
    if (!/<[A-Z]/.test(code) && !/jsx/.test(code)) {
      issues.push('Component file has no JSX elements');
    }
  }
  
  // Calculate completion confidence
  const totalIssues = issues.length + stubIndicators.length;
  const confidence = Math.max(0, 100 - (totalIssues * 20));
  
  return {
    isComplete: stubIndicators.length === 0 && issues.length <= 1,
    confidence,
    issues,
    stubIndicators
  };
}

/**
 * Enhanced validator that includes completion check
 */
export function validateCodeWithCompletion(
  code: string,
  filePath: string,
  options?: {
    expectedExports?: string[];
    minConfidence?: number;
  }
): { valid: boolean; errors: string[]; completion: CompletionResult } {
  const completion = validateCompletion(code, filePath, options?.expectedExports);
  const minConfidence = options?.minConfidence || 80;
  
  const errors: string[] = [];
  
  if (!completion.isComplete) {
    errors.push(...completion.stubIndicators);
    errors.push(...completion.issues);
  }
  
  if (completion.confidence < minConfidence) {
    errors.push(`Code completion confidence too low: ${completion.confidence}% (need ${minConfidence}%)`);
  }
  
  return {
    valid: completion.isComplete && completion.confidence >= minConfidence,
    errors,
    completion
  };
}

/**
 * Get expected exports for common file types
 */
export function getExpectedExports(filePath: string): string[] {
  // UI Components
  if (filePath.includes('components/ui/alert')) {
    return ['Alert', 'AlertTitle', 'AlertDescription'];
  }
  if (filePath.includes('components/ui/button')) {
    return ['Button'];
  }
  if (filePath.includes('components/ui/card')) {
    return ['Card', 'CardContent', 'CardHeader', 'CardTitle'];
  }
  if (filePath.includes('components/ui/input')) {
    return ['Input'];
  }
  if (filePath.includes('components/ui/badge')) {
    return ['Badge'];
  }
  
  // Type files
  if (filePath.includes('types.ts')) {
    return ['Invoice', 'InvoiceData'];
  }
  
  // No specific expectations
  return [];
}

