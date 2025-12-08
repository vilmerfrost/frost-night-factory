// =============================================================================
// FROST NIGHT FACTORY v8.5 - INTELLIGENT BATCH FIXER
// =============================================================================
// Self-contained batch fixer with proper error mapping

import * as fs from 'fs/promises';
import * as path from 'path';
import { ErrorCategory, FixStrategy, ValidationError, CostLog } from './v85-types';
import { classifyError } from './v85-error-classifier';
import { 
  mapErrorClassToErrorCategory, 
  getFixStrategyForCategory,
  isIntrinsicAttributesError,
  shouldRegenerateFromContract,
  sortErrorsByPriority,
  isRetryableError,
  getMaxRetriesForCategory
} from './v85-error-mapping';
import { 
  getLayoutContract, 
  isLayoutComponent, 
  generateComponentFromContract 
} from './layout-contract';
import { 
  validateLayoutComponents, 
  getLayoutComponentNameFromPath,
  isLayoutComponentFile 
} from './v85-layout-validator';

/**
 * Batch fixer configuration
 */
export interface BatchFixerConfig {
  maxTotalAttempts: number;
  maxAttemptsPerFile: number;
  stopOnFirstSuccess: boolean;
  prioritizeLayoutErrors: boolean;
  useLayoutContracts: boolean;
}

/**
 * Batch fixer result
 */
export interface BatchFixerResult {
  success: boolean;
  fixedFiles: Map<string, string>;
  failedFiles: string[];
  costLog: CostLog[];
  report: string;
}

/**
 * Error with parsed info
 */
interface ParsedError {
  file: string;
  line?: number;
  code: string;
  message: string;
  category: ErrorCategory;
  strategy: FixStrategy;
  isLayoutError: boolean;
  attemptCount: number;
}

/**
 * Run intelligent batch fixer on a set of errors
 */
export async function runIntelligentBatchFixer(
  errors: Array<{ file: string; message: string; code?: string; line?: number }>,
  projectRoot: string,
  config: BatchFixerConfig = getDefaultBatchFixerConfig()
): Promise<BatchFixerResult> {
  console.log('\n🔧 Running Intelligent Batch Fixer');
  console.log(`   Errors to fix: ${errors.length}`);
  console.log(`   Max attempts per file: ${config.maxAttemptsPerFile}`);
  
  const fixedFiles = new Map<string, string>();
  const failedFiles: string[] = [];
  const costLog: CostLog[] = [];
  const attemptCounts = new Map<string, number>();
  
  // Parse and classify all errors
  const parsedErrors: ParsedError[] = errors.map(err => {
    const code = err.code || extractErrorCode(err.message);
    const category = mapErrorClassToErrorCategory(code);
    const strategy = getFixStrategyForCategory(category);
    const isLayoutError = isLayoutComponentFile(err.file) || 
                          isIntrinsicAttributesError(err.message);
    
    return {
      file: err.file,
      line: err.line,
      code,
      message: err.message,
      category,
      strategy,
      isLayoutError,
      attemptCount: 0,
    };
  });
  
  // Sort by priority (layout errors first if configured)
  let sortedErrors = sortErrorsByPriority(parsedErrors);
  
  if (config.prioritizeLayoutErrors) {
    sortedErrors = sortedErrors.sort((a, b) => {
      if (a.isLayoutError && !b.isLayoutError) return -1;
      if (!a.isLayoutError && b.isLayoutError) return 1;
      return 0;
    });
  }
  
  // Group errors by file
  const errorsByFile = new Map<string, ParsedError[]>();
  for (const error of sortedErrors) {
    if (!errorsByFile.has(error.file)) {
      errorsByFile.set(error.file, []);
    }
    errorsByFile.get(error.file)!.push(error);
  }
  
  console.log(`   Files with errors: ${errorsByFile.size}`);
  
  // Process each file
  for (const [filePath, fileErrors] of errorsByFile.entries()) {
    const attempts = attemptCounts.get(filePath) || 0;
    
    if (attempts >= config.maxAttemptsPerFile) {
      console.log(`   ⏭️ Skipping ${path.basename(filePath)} (max attempts reached)`);
      failedFiles.push(filePath);
      continue;
    }
    
    console.log(`\n   📄 Fixing ${path.basename(filePath)} (${fileErrors.length} errors)`);
    
    // Check if this is a layout component with contract
    const isLayout = isLayoutComponentFile(filePath);
    const componentName = getLayoutComponentNameFromPath(filePath);
    
    if (isLayout && componentName && isLayoutComponent(componentName) && config.useLayoutContracts) {
      // Use contract-based fix
      console.log(`      🧱 Using layout contract for ${componentName}`);
      
      const contract = getLayoutContract(componentName);
      if (contract) {
        const fixedContent = generateComponentFromContract(contract);
        
        try {
          await fs.writeFile(filePath, fixedContent, 'utf-8');
          fixedFiles.set(filePath, fixedContent);
          console.log(`      ✅ Fixed from contract`);
          
          costLog.push({
            model: 'contract',
            tokensIn: 0,
            tokensOut: 0,
            cost: 0,
            strategy: FixStrategy.IMPLEMENT_FUNCTION_BODY,
            success: true,
            timestamp: new Date().toISOString(),
          });
          
          continue;
        } catch (err) {
          console.log(`      ❌ Failed to write contract fix`);
        }
      }
    }
    
    // Regular AI-based fix
    const primaryError = fileErrors[0];
    
    if (!isRetryableError(primaryError.category)) {
      console.log(`      ⏭️ Skipping (non-retryable error: ${primaryError.category})`);
      failedFiles.push(filePath);
      continue;
    }
    
    // Classify using v85 classifier for detailed fix strategy
    const classified = classifyError(
      { file: filePath, message: primaryError.message, line: primaryError.line },
      attempts
    );
    
    console.log(`      Category: ${classified.category}`);
    console.log(`      Strategy: ${classified.suggestedFixes[0]?.strategy || 'NONE'}`);
    console.log(`      Recommended fixer: ${classified.recommendedFixer}`);
    
    // For now, mark as needing AI fix (actual AI call would go here)
    attemptCounts.set(filePath, attempts + 1);
    
    // In a full implementation, this would call the AI fixer
    // For now, we just track it as a failed fix that needs manual intervention
    if (!fixedFiles.has(filePath)) {
      failedFiles.push(filePath);
    }
  }
  
  // Generate report
  const report = generateFixerReport(fixedFiles, failedFiles, costLog);
  
  return {
    success: failedFiles.length === 0,
    fixedFiles,
    failedFiles,
    costLog,
    report,
  };
}

/**
 * Extract error code from message
 */
function extractErrorCode(message: string): string {
  // TypeScript error codes
  const tsMatch = message.match(/TS(\d+)/);
  if (tsMatch) return `TS${tsMatch[1]}`;
  
  // Our custom error codes
  const customMatch = message.match(/^([A-Z_]+):/);
  if (customMatch) return customMatch[1];
  
  // Infer from message content
  if (message.includes('IntrinsicAttributes')) return 'INTRINSIC_ATTRIBUTES';
  if (message.includes('Cannot find module')) return 'MISSING_MODULE';
  if (message.includes('Cannot find name')) return 'MISSING_IMPORT';
  if (message.includes('JSX')) return 'NO_JSX_IN_TS';
  if (message.includes('any')) return 'IMPLICIT_ANY';
  
  return 'UNKNOWN';
}

/**
 * Generate fixer report
 */
function generateFixerReport(
  fixedFiles: Map<string, string>,
  failedFiles: string[],
  costLog: CostLog[]
): string {
  const lines: string[] = [
    '',
    '═══════════════════════════════════════════════════════════════',
    '  BATCH FIXER REPORT',
    '═══════════════════════════════════════════════════════════════',
    '',
    `  ✅ Fixed: ${fixedFiles.size}`,
    `  ❌ Failed: ${failedFiles.length}`,
    `  💰 Total cost: $${costLog.reduce((sum, l) => sum + l.cost, 0).toFixed(4)}`,
    '',
  ];
  
  if (fixedFiles.size > 0) {
    lines.push('  Fixed files:');
    for (const file of fixedFiles.keys()) {
      lines.push(`    ✅ ${path.basename(file)}`);
    }
    lines.push('');
  }
  
  if (failedFiles.length > 0) {
    lines.push('  Failed files (need manual fix):');
    for (const file of failedFiles) {
      lines.push(`    ❌ ${path.basename(file)}`);
    }
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Get default batch fixer config
 */
export function getDefaultBatchFixerConfig(): BatchFixerConfig {
  return {
    maxTotalAttempts: 10,
    maxAttemptsPerFile: 3,
    stopOnFirstSuccess: false,
    prioritizeLayoutErrors: true,
    useLayoutContracts: true,
  };
}

/**
 * Health check for batch fixer
 */
export function batchFixerHealthCheck(): { healthy: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check that all required functions exist
  try {
    if (typeof mapErrorClassToErrorCategory !== 'function') {
      errors.push('mapErrorClassToErrorCategory is not a function');
    }
    if (typeof getFixStrategyForCategory !== 'function') {
      errors.push('getFixStrategyForCategory is not a function');
    }
    if (typeof classifyError !== 'function') {
      errors.push('classifyError is not a function');
    }
    
    // Test the functions
    const testCategory = mapErrorClassToErrorCategory('TS2322');
    if (!testCategory) {
      errors.push('mapErrorClassToErrorCategory returned undefined');
    }
    
    const testStrategy = getFixStrategyForCategory(ErrorCategory.TYPE_MISMATCH);
    if (!testStrategy) {
      errors.push('getFixStrategyForCategory returned undefined');
    }
    
  } catch (err: any) {
    errors.push(`Health check exception: ${err.message}`);
  }
  
  return {
    healthy: errors.length === 0,
    errors,
  };
}

