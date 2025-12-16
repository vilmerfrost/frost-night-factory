// =============================================================================
// BATCH SURGEON - Fix ALL errors at once, not one by one
// =============================================================================
// Groups errors by type and fixes them in batches
// Prevents the "fix one, break another" loop

import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './modelClient';

export interface ParsedError {
  code: string;
  message: string;
  file: string;
  line?: number;
  column?: number;
  category: ErrorCategory;
  severity: 'error' | 'warning';
}

export type ErrorCategory = 
  | 'missing-import'
  | 'wrong-import'
  | 'missing-export'
  | 'use-client'
  | 'type-error'
  | 'syntax-error'
  | 'missing-file'
  | 'config-error'
  | 'other';

export interface ErrorBatch {
  category: ErrorCategory;
  errors: ParsedError[];
  files: string[];
  priority: number;
}

export interface BatchFixResult {
  batch: ErrorBatch;
  fixed: boolean;
  filesModified: string[];
  remainingErrors: number;
}

/**
 * Parse TypeScript/Next.js build errors into structured format
 */
export function parseErrors(errorLog: string): ParsedError[] {
  const errors: ParsedError[] = [];
  const lines = errorLog.split('\n');
  
  // Pattern for TypeScript errors: ./path/to/file.tsx:line:col
  // Error: TS2307: Cannot find module...
  const tsErrorPattern = /\.\/([^:]+):(\d+):(\d+)/;
  const errorCodePattern = /TS(\d+)/;
  
  let currentFile = '';
  let currentLine = 0;
  let currentCol = 0;
  
  for (const line of lines) {
    // Extract file location
    const locMatch = line.match(tsErrorPattern);
    if (locMatch) {
      const file = locMatch[1];
      const lineStr = locMatch[2];
      const colStr = locMatch[3];
      if (file) currentFile = file;
      if (lineStr) currentLine = parseInt(lineStr);
      if (colStr) currentCol = parseInt(colStr);
    }
    
    // Extract error code
    const codeMatch = line.match(errorCodePattern);
    const errorCode = codeMatch && codeMatch[1] ? `TS${codeMatch[1]}` : 'UNKNOWN';
    
    // Categorize the error
    let category: ErrorCategory = 'other';
    let message = line;
    
    if (line.includes('Cannot find module') || errorCode === 'TS2307') {
      category = 'missing-import';
      message = line.match(/Cannot find module '([^']+)'/)?.[0] || line;
    } else if (line.includes('has no exported member') || errorCode === 'TS2305') {
      category = 'wrong-import';
      message = line;
    } else if (line.includes("'use client'") || line.includes('useState') || line.includes('useEffect')) {
      category = 'use-client';
      message = line;
    } else if (line.includes('Type') && (line.includes('is not assignable') || line.includes('does not exist'))) {
      category = 'type-error';
      message = line;
    } else if (line.includes('Unexpected token') || line.includes('Parsing error')) {
      category = 'syntax-error';
      message = line;
    } else if (line.includes('Module not found') || line.includes("Can't resolve")) {
      category = 'missing-file';
      message = line;
    } else if (line.includes('config') || line.includes('tsconfig') || line.includes('next.config')) {
      category = 'config-error';
      message = line;
    }
    
    // Only add if it looks like an actual error
    if ((line.includes('Error') || line.includes('error') || codeMatch) && currentFile) {
      errors.push({
        code: errorCode,
        message: message.trim(),
        file: currentFile,
        line: currentLine,
        column: currentCol,
        category,
        severity: line.toLowerCase().includes('warning') ? 'warning' : 'error',
      });
    }
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return errors.filter(e => {
    const key = `${e.file}:${e.line}:${e.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Group errors into batches by category
 */
export function groupErrorsIntoBatches(errors: ParsedError[]): ErrorBatch[] {
  const batches = new Map<ErrorCategory, ErrorBatch>();
  
  // Priority order (fix these first)
  const priorityOrder: ErrorCategory[] = [
    'config-error',    // Fix config first
    'missing-file',    // Then missing files
    'use-client',      // Then use client directives
    'missing-import',  // Then imports
    'wrong-import',    // Then wrong imports
    'type-error',      // Then types
    'syntax-error',    // Then syntax
    'other',           // Everything else
  ];
  
  for (const error of errors) {
    if (!batches.has(error.category)) {
      batches.set(error.category, {
        category: error.category,
        errors: [],
        files: [],
        priority: priorityOrder.indexOf(error.category),
      });
    }
    
    const batch = batches.get(error.category)!;
    batch.errors.push(error);
    
    if (!batch.files.includes(error.file)) {
      batch.files.push(error.file);
    }
  }
  
  // Sort by priority
  return Array.from(batches.values()).sort((a, b) => a.priority - b.priority);
}

/**
 * Generate a fix prompt for a batch of errors
 */
export function generateBatchFixPrompt(
  batch: ErrorBatch,
  projectPath: string,
  availableComponents: Record<string, string> = {}
): string {
  // Read all affected files
  const fileContents: Record<string, string> = {};
  for (const file of batch.files) {
    const fullPath = path.join(projectPath, file);
    if (fs.existsSync(fullPath)) {
      fileContents[file] = fs.readFileSync(fullPath, 'utf-8');
    }
  }
  
  const componentList = Object.entries(availableComponents)
    .map(([name, path]) => `  - ${name}: import { ${name} } from '${path}'`)
    .join('\n');
  
  let categoryInstructions = '';
  
  switch (batch.category) {
    case 'missing-import':
      categoryInstructions = `
FIX STRATEGY FOR MISSING IMPORTS:
1. Check if the module exists in the project. If yes, fix the import path.
2. If it's a component, use the @/ alias: import { X } from '@/components/X'
3. If it's a lib function, use: import { X } from '@/lib/X'
4. If it's a type, use: import type { X } from '@/types/X'
5. If the module truly doesn't exist, CREATE IT as a placeholder.

AVAILABLE COMPONENTS TO IMPORT:
${componentList || 'None registered'}
`;
      break;
      
    case 'wrong-import':
      categoryInstructions = `
FIX STRATEGY FOR WRONG IMPORTS:
1. Check how the module ACTUALLY exports (default vs named)
2. If module uses 'export default X', import as: import X from '...'
3. If module uses 'export const X', import as: import { X } from '...'
4. If needed, CHANGE THE EXPORT in the source file to match the import.
`;
      break;
      
    case 'use-client':
      categoryInstructions = `
FIX STRATEGY FOR USE CLIENT:
1. Add 'use client'; at the VERY TOP of the file (before any imports)
2. This is required for files using: useState, useEffect, useRouter, onClick, onChange, etc.
3. Do NOT add 'use client' to layout.tsx unless it uses client hooks.
`;
      break;
      
    case 'type-error':
      categoryInstructions = `
FIX STRATEGY FOR TYPE ERRORS:
1. Check the expected type vs the actual type
2. Add proper type annotations
3. Use 'as' for type assertions if safe
4. Create missing type definitions in @/types/
5. Do NOT use 'any' - use proper types or 'unknown' with type guards
`;
      break;
      
    case 'syntax-error':
      categoryInstructions = `
FIX STRATEGY FOR SYNTAX ERRORS:
1. Check for missing brackets, parentheses, or semicolons
2. Check for unclosed JSX tags
3. Check for invalid JSX (e.g., class instead of className)
4. Ensure all arrow functions have proper syntax
`;
      break;
      
    case 'missing-file':
      categoryInstructions = `
FIX STRATEGY FOR MISSING FILES:
1. CREATE the missing file with proper content
2. Use the correct directory structure (src/components, src/lib, etc.)
3. Export the required functions/components
4. Use proper TypeScript types
`;
      break;
      
    default:
      categoryInstructions = `
FIX STRATEGY:
1. Analyze each error carefully
2. Fix the root cause, not just the symptom
3. Ensure fixes don't break other files
`;
  }
  
  return `
=== BATCH ERROR FIX REQUEST ===

CATEGORY: ${batch.category.toUpperCase()}
TOTAL ERRORS: ${batch.errors.length}
AFFECTED FILES: ${batch.files.length}

${categoryInstructions}

ERRORS TO FIX:
${batch.errors.map(e => `
[${e.code}] ${e.file}:${e.line || '?'}
${e.message}
`).join('\n---\n')}

CURRENT FILE CONTENTS:
${Object.entries(fileContents).map(([file, content]) => `
### FILE: ${file}
\`\`\`tsx
${content}
\`\`\`
`).join('\n')}

=== YOUR TASK ===
Fix ALL ${batch.errors.length} errors in this batch.
Return ALL modified files using this format:

### FILE: path/to/file.tsx
\`\`\`tsx
// Full file content here
\`\`\`
### END_FILE

RULES:
1. Fix ALL errors in this batch, not just one
2. Use @/ aliases for all internal imports
3. Do NOT introduce new errors
4. Return COMPLETE file contents, not patches
5. If creating new files, include them too
`;
}

/**
 * Fix a batch of errors using AI
 */
export async function fixErrorBatch(
  batch: ErrorBatch,
  projectPath: string,
  availableComponents: Record<string, string> = {},
  parseAndWriteFiles: (output: string, path: string) => Promise<number>
): Promise<BatchFixResult> {
  console.log(`\n🔧 BATCH SURGEON: Fixing ${batch.errors.length} ${batch.category} errors...`);
  console.log(`   Affected files: ${batch.files.join(', ')}`);
  
  const prompt = generateBatchFixPrompt(batch, projectPath, availableComponents);
  
  // Use FIXER role with appropriate smart level based on error count
  const smartLevel = batch.errors.length > 5 ? 'GENIUS' : batch.errors.length > 2 ? 'SMART' : 'FAST';
  
  try {
    const response = await callAI('FIXER', prompt, undefined, smartLevel);
    
    // Parse and write the fixed files
    const filesWritten = await parseAndWriteFiles(response, projectPath);
    
    console.log(`   ✅ Fixed batch: ${filesWritten} files modified`);
    
    return {
      batch,
      fixed: filesWritten > 0,
      filesModified: batch.files,
      remainingErrors: 0, // Will be determined by next build
    };
  } catch (e) {
    console.error(`   ❌ Batch fix failed: ${(e as Error).message}`);
    return {
      batch,
      fixed: false,
      filesModified: [],
      remainingErrors: batch.errors.length,
    };
  }
}

/**
 * Run the batch surgeon on all errors
 */
export async function runBatchSurgeon(
  errorLog: string,
  projectPath: string,
  availableComponents: Record<string, string>,
  parseAndWriteFiles: (output: string, path: string) => Promise<number>
): Promise<{ totalFixed: number; batches: BatchFixResult[] }> {
  console.log("\n🏥 BATCH SURGEON: Analyzing errors...");
  
  // Parse all errors
  const errors = parseErrors(errorLog);
  console.log(`   Found ${errors.length} errors`);
  
  if (errors.length === 0) {
    console.log("   No errors to fix!");
    return { totalFixed: 0, batches: [] };
  }
  
  // Group into batches
  const batches = groupErrorsIntoBatches(errors);
  console.log(`   Grouped into ${batches.length} batches:`);
  batches.forEach(b => console.log(`      - ${b.category}: ${b.errors.length} errors`));
  
  // Fix each batch in priority order
  const results: BatchFixResult[] = [];
  let totalFixed = 0;
  
  for (const batch of batches) {
    const result = await fixErrorBatch(batch, projectPath, availableComponents, parseAndWriteFiles);
    results.push(result);
    
    if (result.fixed) {
      totalFixed += batch.errors.length;
    }
  }
  
  console.log(`\n📊 BATCH SURGEON RESULTS:`);
  console.log(`   Total errors addressed: ${totalFixed}/${errors.length}`);
  console.log(`   Batches processed: ${results.length}`);
  
  return { totalFixed, batches: results };
}

/**
 * Quick check: should we use batch surgeon?
 */
export function shouldUseBatchSurgeon(errorLog: string): boolean {
  const errors = parseErrors(errorLog);
  // Use batch surgeon if we have 3+ errors
  return errors.length >= 3;
}

