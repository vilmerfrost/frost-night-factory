// =============================================================================
// FROST NIGHT FACTORY v8.5 - ERROR MAPPING MODULE
// =============================================================================
// Self-contained error mapping helpers for the batch fixer

import { ErrorCategory, FixStrategy } from './v85-types';

/**
 * Error class to category mapping
 */
export const ERROR_CLASS_TO_CATEGORY: Record<string, ErrorCategory> = {
  // Syntax errors
  'SYNTAX_ERROR': ErrorCategory.SYNTAXERROR,
  'PARSE_ERROR': ErrorCategory.SYNTAXERROR,
  
  // Import errors
  'MISSING_MODULE': ErrorCategory.MISSING_IMPORT,
  'MISSING_IMPORT': ErrorCategory.MISSING_IMPORT,
  'IMPORT_NOT_FOUND': ErrorCategory.MISSING_IMPORT,
  
  // Type errors
  'TYPE_ERROR': ErrorCategory.TYPE_MISMATCH,
  'TS2322': ErrorCategory.TYPE_MISMATCH,
  'TS2339': ErrorCategory.TYPE_MISMATCH,
  'TS2345': ErrorCategory.TYPE_MISMATCH,
  
  // File structure
  'NO_JSX_IN_TS': ErrorCategory.FILE_EXTENSION_MISMATCH,
  'API_NO_JSX': ErrorCategory.FILE_STRUCTURE_VIOLATION,
  'API_NO_REACT_IMPORTS': ErrorCategory.FILE_STRUCTURE_VIOLATION,
  'API_MISSING_HANDLER': ErrorCategory.MISSING_EXPORT,
  'API_FORBIDDEN_IMPORT': ErrorCategory.FILE_STRUCTURE_VIOLATION,
  
  // Lazy code
  'LAZY_RETURN_NULL': ErrorCategory.LAZY_CODE,
  'IMPLICIT_ANY': ErrorCategory.LAZY_CODE,
  
  // Import paths
  'IMPORT_DEEP_RELATIVE': ErrorCategory.BROKEN_IMPORT_PATH,
  
  // Component props
  'INTRINSIC_ATTRIBUTES': ErrorCategory.FILE_STRUCTURE_VIOLATION,
  'MISSING_COMPONENT_PROPS': ErrorCategory.FILE_STRUCTURE_VIOLATION,
  
  // Default
  'UNKNOWN': ErrorCategory.UNKNOWN,
};

/**
 * Map an error class string to ErrorCategory
 */
export function mapErrorClassToErrorCategory(errorClass: string): ErrorCategory {
  // Check exact match
  if (ERROR_CLASS_TO_CATEGORY[errorClass]) {
    return ERROR_CLASS_TO_CATEGORY[errorClass];
  }
  
  // Check for TypeScript error codes (TS followed by numbers)
  if (/^TS\d+$/.test(errorClass)) {
    // Specific TS error mappings
    const tsCode = errorClass;
    
    switch (tsCode) {
      case 'TS2304': return ErrorCategory.MISSING_IMPORT;  // Cannot find name
      case 'TS2305': return ErrorCategory.MISSING_EXPORT;  // Module has no exported member
      case 'TS2307': return ErrorCategory.MISSING_IMPORT;  // Cannot find module
      case 'TS2322': return ErrorCategory.TYPE_MISMATCH;   // Type not assignable
      case 'TS2339': return ErrorCategory.TYPE_MISMATCH;   // Property does not exist
      case 'TS2345': return ErrorCategory.TYPE_MISMATCH;   // Argument type not assignable
      case 'TS2531': return ErrorCategory.TYPE_MISMATCH;   // Object possibly null
      case 'TS2551': return ErrorCategory.TYPE_MISMATCH;   // Property does not exist, did you mean?
      case 'TS2554': return ErrorCategory.TYPE_MISMATCH;   // Expected X arguments
      case 'TS2741': return ErrorCategory.TYPE_MISMATCH;   // Missing property
      case 'TS2769': return ErrorCategory.TYPE_MISMATCH;   // No overload matches
      case 'TS1005': return ErrorCategory.SYNTAXERROR;     // Expected token
      case 'TS1109': return ErrorCategory.SYNTAXERROR;     // Expression expected
      case 'TS1127': return ErrorCategory.SYNTAXERROR;     // Invalid character
      case 'TS1128': return ErrorCategory.SYNTAXERROR;     // Declaration expected
      case 'TS1136': return ErrorCategory.SYNTAXERROR;     // Property assignment expected
      case 'TS1003': return ErrorCategory.SYNTAXERROR;     // Identifier expected
      default: return ErrorCategory.UNKNOWN;
    }
  }
  
  // Check for patterns in the error class
  const lowerClass = errorClass.toLowerCase();
  
  if (lowerClass.includes('import')) return ErrorCategory.MISSING_IMPORT;
  if (lowerClass.includes('export')) return ErrorCategory.MISSING_EXPORT;
  if (lowerClass.includes('type')) return ErrorCategory.TYPE_MISMATCH;
  if (lowerClass.includes('syntax')) return ErrorCategory.SYNTAXERROR;
  if (lowerClass.includes('jsx')) return ErrorCategory.FILE_EXTENSION_MISMATCH;
  if (lowerClass.includes('react')) return ErrorCategory.FILE_STRUCTURE_VIOLATION;
  
  return ErrorCategory.UNKNOWN;
}

/**
 * Get recommended fix strategy for an error category
 */
export function getFixStrategyForCategory(category: ErrorCategory): FixStrategy {
  const strategies: Record<ErrorCategory, FixStrategy> = {
    [ErrorCategory.FILE_EXTENSION_MISMATCH]: FixStrategy.REMOVE_JSX,
    [ErrorCategory.FILE_STRUCTURE_VIOLATION]: FixStrategy.REMOVE_REACT_IMPORT,
    [ErrorCategory.TYPE_MISMATCH]: FixStrategy.ADD_TYPE_ANNOTATION,
    [ErrorCategory.LAZY_CODE]: FixStrategy.IMPLEMENT_FUNCTION_BODY,
    [ErrorCategory.INCOMPLETE_IMPLEMENTATION]: FixStrategy.IMPLEMENT_FUNCTION_BODY,
    [ErrorCategory.MISSING_IMPORT]: FixStrategy.ADD_IMPORT,
    [ErrorCategory.MISSING_EXPORT]: FixStrategy.UPDATE_EXPORT,
    [ErrorCategory.CIRCULAR_DEPENDENCY]: FixStrategy.REQUIRE_HUMAN_REVIEW,
    [ErrorCategory.SQL_INJECTION_RISK]: FixStrategy.ADD_INPUT_VALIDATION,
    [ErrorCategory.MISSING_ENVIRONMENT_VAR]: FixStrategy.REQUIRE_HUMAN_REVIEW,
    [ErrorCategory.BROKEN_IMPORT_PATH]: FixStrategy.FIX_IMPORT_PATH,
    [ErrorCategory.SYNTAXERROR]: FixStrategy.FIX_SYNTAX,
    [ErrorCategory.UNKNOWN]: FixStrategy.REQUIRE_HUMAN_REVIEW,
  };
  
  return strategies[category] || FixStrategy.REQUIRE_HUMAN_REVIEW;
}

/**
 * Check if an error is related to IntrinsicAttributes (component props)
 */
export function isIntrinsicAttributesError(errorMessage: string): boolean {
  return /IntrinsicAttributes/.test(errorMessage) || 
         /Property .+ does not exist on type 'IntrinsicAttributes'/.test(errorMessage);
}

/**
 * Extract component name from IntrinsicAttributes error
 */
export function extractComponentFromIntrinsicError(errorMessage: string): string | null {
  // Pattern: Type '{ ... }' is not assignable to type 'IntrinsicAttributes & ComponentProps'.
  const match = errorMessage.match(/IntrinsicAttributes & (\w+)Props/);
  if (match) return match[1];
  
  // Pattern: Property 'X' does not exist on type 'IntrinsicAttributes'.
  // In this case, we need to look at the file path for context
  return null;
}

/**
 * Determine if an error should trigger layout contract regeneration
 */
export function shouldRegenerateFromContract(errorMessage: string, filePath: string): boolean {
  // Check if it's a layout component file
  const isLayoutFile = /\/layout\/|layout\.tsx$|shell\.tsx$/i.test(filePath);
  
  // Check if it's an IntrinsicAttributes error
  const isPropsError = isIntrinsicAttributesError(errorMessage);
  
  // Check for common prop-related errors
  const isPropsMismatch = /Property .+ is missing|does not exist on type/.test(errorMessage);
  
  return isLayoutFile && (isPropsError || isPropsMismatch);
}

/**
 * Get priority for an error category (lower = higher priority)
 */
export function getErrorPriority(category: ErrorCategory): number {
  const priorities: Record<ErrorCategory, number> = {
    [ErrorCategory.SYNTAXERROR]: 1,
    [ErrorCategory.FILE_EXTENSION_MISMATCH]: 2,
    [ErrorCategory.FILE_STRUCTURE_VIOLATION]: 3,
    [ErrorCategory.MISSING_IMPORT]: 4,
    [ErrorCategory.MISSING_EXPORT]: 5,
    [ErrorCategory.TYPE_MISMATCH]: 6,
    [ErrorCategory.LAZY_CODE]: 7,
    [ErrorCategory.INCOMPLETE_IMPLEMENTATION]: 8,
    [ErrorCategory.BROKEN_IMPORT_PATH]: 9,
    [ErrorCategory.CIRCULAR_DEPENDENCY]: 10,
    [ErrorCategory.SQL_INJECTION_RISK]: 11,
    [ErrorCategory.MISSING_ENVIRONMENT_VAR]: 12,
    [ErrorCategory.UNKNOWN]: 99,
  };
  
  return priorities[category] || 99;
}

/**
 * Sort errors by priority
 */
export function sortErrorsByPriority<T extends { category: ErrorCategory }>(errors: T[]): T[] {
  return [...errors].sort((a, b) => 
    getErrorPriority(a.category) - getErrorPriority(b.category)
  );
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(category: ErrorCategory): boolean {
  const nonRetryable = new Set([
    ErrorCategory.CIRCULAR_DEPENDENCY,
    ErrorCategory.MISSING_ENVIRONMENT_VAR,
    ErrorCategory.UNKNOWN,
  ]);
  
  return !nonRetryable.has(category);
}

/**
 * Get max retries for an error category
 */
export function getMaxRetriesForCategory(category: ErrorCategory): number {
  const retries: Partial<Record<ErrorCategory, number>> = {
    [ErrorCategory.SYNTAXERROR]: 3,
    [ErrorCategory.FILE_EXTENSION_MISMATCH]: 2,
    [ErrorCategory.FILE_STRUCTURE_VIOLATION]: 3,
    [ErrorCategory.MISSING_IMPORT]: 2,
    [ErrorCategory.TYPE_MISMATCH]: 3,
    [ErrorCategory.LAZY_CODE]: 2,
  };
  
  return retries[category] || 1;
}

