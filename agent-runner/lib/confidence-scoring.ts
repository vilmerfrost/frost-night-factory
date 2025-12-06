/**
 * ✅ PHASE 5: Confidence Scoring System
 * Implements Gemini's confidence threshold system
 * Calculates confidence score based on multiple factors
 */

export interface ConfidenceScore {
  score: number;  // 0.0 - 1.0
  factors: {
    syntaxValid: boolean;
    testsPass: boolean;
    noSemanticDrift: boolean;
    modelCertainty: number;
  };
  recommendation: 'proceed' | 'review' | 'halt';
}

/**
 * Calculate confidence score for generated code
 */
export function calculateConfidence(
  code: string,
  testResults: any,
  semanticDistance: number,
  modelLogprobs: number = 0.8
): ConfidenceScore {
  const factors = {
    syntaxValid: validateSyntax(code),
    testsPass: testResults?.exitCode === 0,
    noSemanticDrift: semanticDistance < 0.1,
    modelCertainty: modelLogprobs
  };
  
  // Weighted average
  const score = (
    (factors.syntaxValid ? 0.3 : 0) +
    (factors.testsPass ? 0.4 : 0) +
    (factors.noSemanticDrift ? 0.2 : 0) +
    (factors.modelCertainty * 0.1)
  );
  
  let recommendation: 'proceed' | 'review' | 'halt';
  if (score >= 0.9) {
    recommendation = 'proceed';
  } else if (score >= 0.5) {
    recommendation = 'review';
  } else {
    recommendation = 'halt';
  }
  
  return { score, factors, recommendation };
}

/**
 * Validate TypeScript/JavaScript syntax
 */
function validateSyntax(code: string): boolean {
  try {
    // Basic syntax check - try to parse as JavaScript
    // In production, you might want to use TypeScript compiler API
    if (code.trim().length === 0) {
      return false;
    }
    
    // Check for basic syntax markers
    const hasValidStructure = 
      code.includes('function') || 
      code.includes('const') || 
      code.includes('export') ||
      code.includes('import') ||
      code.includes('class');
    
    // Check for balanced braces
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    const balancedBraces = openBraces === closeBraces;
    
    return hasValidStructure && balancedBraces;
  } catch {
    return false;
  }
}

