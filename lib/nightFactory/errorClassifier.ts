// =============================================================================
// ERROR CLASSIFIER - Smart error categorization and routing
// =============================================================================

import * as crypto from 'crypto';
import * as path from 'path';
import { autoFixPythonSyntax } from './pythonSyntaxFixer';

/**
 * ✅ Compact helper: Remove null/undefined from arrays
 */
const compact = <T>(arr: Array<T | null | undefined>): T[] =>
  arr.filter((x): x is T => x != null);

/**
 * Error Categories for precise fixing
 */
export enum ErrorCategory {
  DEPENDENCY_VERSION = 'dep_version',    // npm ETARGET, ERESOLVE, version not found
  TYPE_ERROR = 'type',                   // TS2305, TS7006, type mismatches
  LAZY_CODE = 'lazy',                    // pass, any, null, TODO
  IMPORT_ERROR = 'import',               // TS2613, missing exports, module not found
  EXPORT_ERROR = 'export',               // TS2613 default export issues
  RUNTIME_ERROR = 'runtime',             // Crashes, missing env, undefined
  CONFIG_ERROR = 'config',               // next.config, tsconfig, tailwind errors
  SYNTAX_ERROR = 'syntax',               // JSX errors, parsing errors
  PYTHON_SYNTAX = 'python_syntax',      // Python syntax errors (unclosed brackets, indentation, etc.)
  PYTHON_TYPE = 'python_type',           // MyPy type errors
  UNKNOWN = 'unknown'
}

/**
 * Detailed error information
 */
export interface ClassifiedError {
  category: ErrorCategory;
  originalError: string;
  errorHash: string;
  targetFiles: string[];
  errorCode?: string;
  suggestedFix?: string;
  confidence: number; // 0-1, how confident we are in classification
  metadata?: {
    file?: string;
    line?: number;
    column?: number;
    type?: string; // e.g., 'unclosed_bracket', 'indentation', 'missing_colon'
  };
}

/**
 * Error pattern with extraction and metadata
 */
interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  severity?: 'low' | 'medium' | 'high';
  confidence?: number; // 0-100
  extractFiles?: (match: RegExpMatchArray, fullError: string) => string[];
  extractMetadata?: (match: RegExpMatchArray, fullError: string) => {
    file?: string;
    line?: number;
    column?: number;
    type?: string;
  };
  suggestedFix?: string;
}

/**
 * Error patterns for classification
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // DEPENDENCY VERSION ERRORS
  {
    pattern: /ETARGET|No matching version found|Could not resolve dependency|ERESOLVE/i,
    category: ErrorCategory.DEPENDENCY_VERSION,
    extractFiles: () => ['package.json'],
    suggestedFix: 'Update package.json with correct versions from GOLDEN_VERSIONS'
  },
  {
    pattern: /npm ERR! notarget No matching version found for ([a-z@/.-]+)@([0-9^~.]+)/i,
    category: ErrorCategory.DEPENDENCY_VERSION,
    extractFiles: () => ['package.json'],
  },
  {
    pattern: /Cannot find module '([^']+)'/,
    category: ErrorCategory.IMPORT_ERROR,
    extractFiles: (match, fullError) => {
      const fileMatch = fullError.match(/([a-zA-Z0-9_\-\/\.]+\.(tsx?|jsx?|mjs))/);
      return compact([fileMatch?.[1]]);
    },
  },
  
  // TYPE ERRORS
  {
    pattern: /TS2305.*has no exported member/,
    category: ErrorCategory.IMPORT_ERROR,
  },
  {
    pattern: /TS2613.*Module.*has no default export/,
    category: ErrorCategory.EXPORT_ERROR,
    suggestedFix: 'Change import to named import: import { X } from instead of import X from'
  },
  {
    pattern: /TS7006.*implicitly has an 'any' type/,
    category: ErrorCategory.TYPE_ERROR,
    suggestedFix: 'Add explicit type annotation'
  },
  {
    pattern: /TS2307.*Cannot find module/,
    category: ErrorCategory.IMPORT_ERROR,
  },
  // MISSING "use client" DIRECTIVE
  {
    pattern: /You're importing a component that needs (useState|useEffect|useRouter|onClick)/i,
    category: ErrorCategory.SYNTAX_ERROR,
    severity: 'high',
    confidence: 1.0,
    extractFiles: (match, fullError) => {
      // Try to extract file path from error message
      const fileMatch = fullError.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|jsx|js))(?:\s*\((\d+),(\d+)\))?/);
      return compact([fileMatch?.[1]]);
    },
    extractMetadata: (match, fullError) => {
      const fileMatch = fullError.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|jsx|js))(?:\s*\((\d+),(\d+)\))?/);
      const filePath = fileMatch?.[1];
      return {
        file: filePath,
        line: fileMatch?.[3] ? parseInt(fileMatch[3]) : undefined,
        column: fileMatch?.[4] ? parseInt(fileMatch[4]) : undefined,
        type: 'missing_use_client',
      };
    },
    suggestedFix: "Add 'use client'; directive at the top of the file",
  },
  {
    pattern: /TS2305.*useState.*is not defined|TS2305.*useEffect.*is not defined|TS2305.*useRouter.*is not defined/i,
    category: ErrorCategory.SYNTAX_ERROR,
    severity: 'high',
    confidence: 0.9,
    extractFiles: (match, fullError) => {
      const fileMatch = fullError.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|jsx|js))(?:\s*\((\d+),(\d+)\))?/);
      return compact([fileMatch?.[1]]);
    },
    extractMetadata: (match, fullError) => {
      const fileMatch = fullError.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|jsx|js))(?:\s*\((\d+),(\d+)\))?/);
      const filePath = fileMatch?.[1];
      return {
        file: filePath,
        line: fileMatch?.[3] ? parseInt(fileMatch[3]) : undefined,
        type: 'missing_use_client',
      };
    },
    suggestedFix: "Add 'use client'; directive at the top of the file",
  },
  {
    pattern: /TS2339.*Property.*does not exist on type/,
    category: ErrorCategory.TYPE_ERROR,
  },
  {
    pattern: /TS2345.*Argument of type.*is not assignable/,
    category: ErrorCategory.TYPE_ERROR,
  },
  {
    pattern: /TS2322.*Type.*is not assignable to type/,
    category: ErrorCategory.TYPE_ERROR,
  },
  {
    pattern: /TS18046.*is of type 'unknown'/,
    category: ErrorCategory.TYPE_ERROR,
  },
  
  // LAZY CODE ERRORS
  {
    pattern: /LAZY CODE DETECTED/i,
    category: ErrorCategory.LAZY_CODE,
    severity: 'high',
    confidence: 100,
    extractFiles: (match, fullError) => {
      // Try to extract file paths from the lazy code issues
      const filePattern = /([a-zA-Z0-9_\-\/\.]+\.(tsx?|jsx?|py))/gi;
      const files: string[] = [];
      let fileMatch;
      while ((fileMatch = filePattern.exec(fullError)) !== null) {
        const filePath = fileMatch[1];
        if (filePath) {
          files.push(filePath);
        }
      }
      return files;
    },
    suggestedFix: 'Rewrite file completely - NO placeholders, NO any types, NO return null'
  },
  {
    pattern: /Found 'TODO'|Found 'FIXME'|Found 'pass'/,
    category: ErrorCategory.LAZY_CODE,
    suggestedFix: 'Replace placeholder with actual implementation'
  },
  {
    pattern: /Unexpected 'any'|No explicit 'any'/,
    category: ErrorCategory.LAZY_CODE,
  },
  
  // CONFIG ERRORS
  {
    pattern: /Invalid next\.config/i,
    category: ErrorCategory.CONFIG_ERROR,
    extractFiles: () => ['next.config.mjs', 'next.config.js'],
  },
  {
    pattern: /Unrecognized key.*in.*next\.config/i,
    category: ErrorCategory.CONFIG_ERROR,
    extractFiles: () => ['next.config.mjs', 'next.config.js'],
  },
  {
    pattern: /tailwind\.config.*error/i,
    category: ErrorCategory.CONFIG_ERROR,
    extractFiles: () => ['tailwind.config.ts', 'tailwind.config.js'],
  },
  {
    pattern: /tsconfig.*error|No inputs were found in config/i,
    category: ErrorCategory.CONFIG_ERROR,
    extractFiles: () => ['tsconfig.json'],
  },
  
  // SYNTAX ERRORS (TypeScript/JavaScript)
  {
    pattern: /SyntaxError|Unexpected token|JSX element/,
    category: ErrorCategory.SYNTAX_ERROR,
  },
  {
    pattern: /Parsing error|Unterminated/,
    category: ErrorCategory.SYNTAX_ERROR,
  },
  
  // PYTHON SYNTAX ERRORS
  {
    pattern: /(\w+\.py):(\d+):\s*(.+?)\s+was never closed\s*\[syntax\]/i,
    category: ErrorCategory.PYTHON_SYNTAX,
    severity: 'high',
    confidence: 95,
    extractFiles: (match) => compact([match[1]]),
    extractMetadata: (match) => {
      const filePath = match[1];
      if (!filePath) return { type: 'unclosed_bracket' };
      const lineStr = match[2];
      return {
        file: filePath,
        line: lineStr ? parseInt(lineStr) : undefined,
        type: 'unclosed_bracket',
      };
    },
    suggestedFix: 'Add missing closing bracket/parenthesis/brace',
  },
  {
    pattern: /(\w+\.py):(\d+):\s*unexpected EOF while parsing/i,
    category: ErrorCategory.PYTHON_SYNTAX,
    severity: 'high',
    confidence: 90,
    extractFiles: (match) => compact([match[1]]),
    extractMetadata: (match) => {
      const filePath = match[1];
      if (!filePath) return { type: 'unexpected_eof' };
      const lineStr = match[2];
      return {
        file: filePath,
        line: lineStr ? parseInt(lineStr) : undefined,
        type: 'unexpected_eof',
      };
    },
    suggestedFix: 'Add missing closing bracket, parenthesis, or colon',
  },
  {
    pattern: /(\w+\.py):(\d+):\s*expected an indented block/i,
    category: ErrorCategory.PYTHON_SYNTAX,
    severity: 'high',
    confidence: 95,
    extractFiles: (match) => compact([match[1]]),
    extractMetadata: (match) => {
      const filePath = match[1];
      if (!filePath) return { type: 'missing_indentation' };
      const lineStr = match[2];
      if (!lineStr) return { file: filePath, type: 'missing_indentation' };
      return {
        file: filePath,
        line: parseInt(lineStr),
        type: 'missing_indentation',
      };
    },
    suggestedFix: 'Add indented block after colon (if, for, def, etc.)',
  },
  {
    pattern: /(\w+\.py):(\d+):\s*invalid syntax/i,
    category: ErrorCategory.PYTHON_SYNTAX,
    severity: 'medium',
    confidence: 70,
    extractFiles: (match) => compact([match[1]]),
    extractMetadata: (match) => {
      const filePath = match[1];
      if (!filePath) return { type: 'invalid_syntax' };
      const lineStr = match[2];
      return {
        file: filePath,
        line: lineStr ? parseInt(lineStr) : undefined,
        type: 'invalid_syntax',
      };
    },
    suggestedFix: 'Check syntax on the specified line',
  },
  {
    pattern: /(\w+\.py):(\d+):(\d+):\s*SyntaxError:/i,
    category: ErrorCategory.PYTHON_SYNTAX,
    severity: 'high',
    confidence: 90,
    extractFiles: (match) => compact([match[1]]),
    extractMetadata: (match) => {
      const filePath = match[1];
      if (!filePath) return { type: 'syntax_error' };
      const lineStr = match[2];
      const colStr = match[3];
      return {
        file: filePath,
        line: lineStr ? parseInt(lineStr) : undefined,
        column: colStr ? parseInt(colStr) : undefined,
        type: 'syntax_error',
      };
    },
  },
  
  // PYTHON TYPE ERRORS (MyPy)
  {
    pattern: /(\w+\.py):(\d+):\s*error:.*Incompatible types/i,
    category: ErrorCategory.PYTHON_TYPE,
    severity: 'medium',
    confidence: 85,
    extractFiles: (match) => compact([match[1]]),
    extractMetadata: (match) => {
      const filePath = match[1];
      if (!filePath) return { type: 'type_incompatible' };
      const lineStr = match[2];
      if (!lineStr) return { file: filePath, type: 'type_incompatible' };
      return {
        file: filePath,
        line: parseInt(lineStr),
        type: 'type_incompatible',
      };
    },
    suggestedFix: 'Fix type annotation or value assignment',
  },
  {
    pattern: /(\w+\.py):(\d+):\s*error:.*has no attribute/i,
    category: ErrorCategory.PYTHON_TYPE,
    severity: 'medium',
    confidence: 85,
    extractFiles: (match) => compact([match[1]]),
    extractMetadata: (match) => {
      const filePath = match[1];
      if (!filePath) return { type: 'missing_attribute' };
      const lineStr = match[2];
      if (!lineStr) return { file: filePath, type: 'missing_attribute' };
      return {
        file: filePath,
        line: parseInt(lineStr),
        type: 'missing_attribute',
      };
    },
    suggestedFix: 'Add missing attribute or fix attribute name',
  },
  
  // RUNTIME ERRORS
  {
    pattern: /ReferenceError|TypeError.*undefined/,
    category: ErrorCategory.RUNTIME_ERROR,
  },
  {
    pattern: /ENOENT.*no such file/,
    category: ErrorCategory.RUNTIME_ERROR,
  },
];

/**
 * Extract target files from error message
 */
export function extractTargetFiles(error: string): string[] {
  const files: Set<string> = new Set();
  
  // Pattern 1: TypeScript style - file.tsx(line,col): error
  const tsPattern = /([a-zA-Z0-9_\-\/\.]+\.(tsx?|jsx?|json|css|mjs))(?:\((\d+),(\d+)\))?:\s*(?:error|warning)/gi;
  let match;
  while ((match = tsPattern.exec(error)) !== null) {
    const filePath = match[1];
    if (filePath) files.add(filePath);
  }
  
  // Pattern 2: Node.js style - at /path/to/file.ts:line:col
  const nodePattern = /at\s+(?:.*?\s+\()?([a-zA-Z0-9_\-\/\.]+\.(tsx?|jsx?|json|mjs))(?::(\d+))?/gi;
  while ((match = nodePattern.exec(error)) !== null) {
    const filePath = match[1];
    if (filePath) files.add(filePath);
  }
  
  // Pattern 3: Webpack/Next.js style - ./path/to/file.tsx
  const webpackPattern = /\.\/([a-zA-Z0-9_\-\/\.]+\.(tsx?|jsx?|css|mjs))/gi;
  while ((match = webpackPattern.exec(error)) !== null) {
    const filePath = match[1];
    if (filePath) files.add(filePath);
  }
  
  // Pattern 4: Python style - file.py:line:col: error
  const pythonPattern = /([a-zA-Z0-9_\-\/\.]+\.py)(?::(\d+))(?::(\d+))?:\s*(?:error|SyntaxError|Syntax Warning)/gi;
  while ((match = pythonPattern.exec(error)) !== null) {
    const filePath = match[1];
    if (filePath) files.add(filePath);
  }
  
  // Pattern 5: Python style - file.py:line: message
  const pythonSimplePattern = /([a-zA-Z0-9_\-\/\.]+\.py):(\d+):/gi;
  while ((match = pythonSimplePattern.exec(error)) !== null) {
    const filePath = match[1];
    if (filePath) files.add(filePath);
  }
  
  // Pattern 6: Import errors - from './path' or from '@/path'
  const importPattern = /from\s+['"](@\/|\.\.?\/)?([a-zA-Z0-9_\-\/\.]+)['"]/gi;
  while ((match = importPattern.exec(error)) !== null) {
    const filePath = match[2];
    if (!filePath) continue;
    // Add common extensions if missing
    if (!filePath.includes('.')) {
      files.add(`${filePath}.tsx`);
      files.add(`${filePath}.ts`);
      files.add(`${filePath}.py`);
    } else {
      files.add(filePath);
    }
  }
  
  return Array.from(files);
}

/**
 * Hash an error message for deduplication
 */
export function hashError(error: string): string {
  // Normalize the error (remove line numbers, timestamps, etc.)
  const normalized = error
    .replace(/\(\d+,\d+\)/g, '') // Remove line:col
    .replace(/:\d+:\d+/g, '')    // Remove :line:col
    .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove dates
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim()
    .substring(0, 500);          // Limit length
  
  return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 12);
}

/**
 * Classify an error message
 */
export function classifyError(error: string): ClassifiedError {
  const errorHash = hashError(error);
  let targetFiles = extractTargetFiles(error);
  
  for (const patternDef of ERROR_PATTERNS) {
    const { pattern, category, extractFiles, extractMetadata, suggestedFix, confidence = 90, severity } = patternDef;
    const match = error.match(pattern);
    if (match) {
      // Extract files using pattern-specific extractor if available
      if (extractFiles) {
        const patternFiles = extractFiles(match, error);
        if (patternFiles.length > 0) {
          targetFiles = patternFiles;
        }
      }
      
      // Extract metadata if available
      let metadata;
      if (extractMetadata) {
        metadata = extractMetadata(match, error);
      }
      
      // Extract error code if present
      const codeMatch = error.match(/TS\d+|E[A-Z]+|SyntaxError|Syntax Warning/);
      
      return {
        category,
        originalError: error,
        errorHash,
        targetFiles,
        errorCode: codeMatch?.[0],
        suggestedFix,
        confidence: confidence / 100, // Convert 0-100 to 0-1
        metadata,
      };
    }
  }
  
  // Unknown error
  return {
    category: ErrorCategory.UNKNOWN,
    originalError: error,
    errorHash,
    targetFiles,
    confidence: 0.3,
  };
}

/**
 * Auto-fix Python syntax errors if possible
 */
export async function autoFixPythonError(
  classified: ClassifiedError,
  repoPath: string
): Promise<boolean> {
  if (classified.category !== ErrorCategory.PYTHON_SYNTAX) {
    return false;
  }
  
  if (!classified.metadata?.file || !classified.metadata?.type) {
    return false;
  }
  
  const filePath = path.join(repoPath, classified.metadata.file);
  const errorLine = classified.metadata.line;
  const errorType = classified.metadata.type;
  
  return await autoFixPythonSyntax(filePath, errorType, errorLine);
}

/**
 * Get fixing strategy for an error category
 */
export function getFixingStrategy(category: ErrorCategory): {
  fixFiles: string[];
  approach: string;
  maxAttempts: number;
} {
  switch (category) {
    case ErrorCategory.DEPENDENCY_VERSION:
      return {
        fixFiles: ['package.json'],
        approach: 'Replace versions with GOLDEN_VERSIONS, run npm install',
        maxAttempts: 2,
      };
    
    case ErrorCategory.EXPORT_ERROR:
      return {
        fixFiles: [], // Determined by error
        approach: 'Convert default exports to named exports, update imports',
        maxAttempts: 3,
      };
    
    case ErrorCategory.IMPORT_ERROR:
      return {
        fixFiles: [], // Determined by error
        approach: 'Fix import paths, ensure modules exist',
        maxAttempts: 3,
      };
    
    case ErrorCategory.TYPE_ERROR:
      return {
        fixFiles: ['lib/types.ts'], // Start with types file
        approach: 'Add missing types, fix type annotations',
        maxAttempts: 4,
      };
    
    case ErrorCategory.CONFIG_ERROR:
      return {
        fixFiles: ['next.config.mjs', 'tsconfig.json', 'tailwind.config.ts'],
        approach: 'Replace with golden config templates',
        maxAttempts: 2,
      };
    
    case ErrorCategory.SYNTAX_ERROR:
      return {
        fixFiles: [], // Determined by error
        approach: 'Fix JSX syntax, ensure valid TypeScript',
        maxAttempts: 3,
      };
    
    case ErrorCategory.PYTHON_SYNTAX:
      return {
        fixFiles: [], // Determined by error
        approach: 'Fix Python syntax (brackets, indentation, colons)',
        maxAttempts: 2, // Python syntax errors are usually straightforward
      };
    
    case ErrorCategory.PYTHON_TYPE:
      return {
        fixFiles: [], // Determined by error
        approach: 'Fix Python type annotations (MyPy errors)',
        maxAttempts: 3,
      };
    
    case ErrorCategory.LAZY_CODE:
      return {
        fixFiles: [], // Determined by error
        approach: 'Rewrite file completely - NO placeholders, NO any types, NO return null',
        maxAttempts: 3, // Allow more attempts for lazy code (it's critical)
      };
    
    case ErrorCategory.RUNTIME_ERROR:
      return {
        fixFiles: [],
        approach: 'Add null checks, ensure files exist, check env vars',
        maxAttempts: 3,
      };
    
    default:
      return {
        fixFiles: [],
        approach: 'General fix attempt',
        maxAttempts: 2,
      };
  }
}

