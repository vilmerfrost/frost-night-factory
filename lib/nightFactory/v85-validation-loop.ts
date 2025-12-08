// =============================================================================
// FROST NIGHT FACTORY v8.5 - VALIDATION-REPAIR LOOP
// =============================================================================
// Perplexity + Gemini's intelligent repair loop with cost tracking

import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationError, FixStrategy, CostLog, DEFAULT_V85_FLAGS } from './v85-types';
import { runFrameworkGuardrails, Violation, checkFileSyntax } from './v85-ast-validators';
import { classifyError, classifyViolations } from './v85-error-classifier';

// Dynamic import for AI client (may not exist in all environments)
let callAI: any = null;
async function getAIClient() {
  if (!callAI) {
    try {
      const aiModule = await import('../../agent-runner/ai-client');
      callAI = aiModule.callAI;
    } catch {
      console.warn('⚠️ AI client not available, using mock');
      callAI = async () => ({ success: false, error: 'AI client not available' });
    }
  }
  return callAI;
}

interface ValidationResult {
  success: boolean;
  code: Map<string, string>;
  costLog: CostLog[];
  failureReason?: string;
  violations?: Violation[];
}

interface FixResult {
  success: boolean;
  code: Map<string, string>;
  error?: string;
  tokenUsage?: { input: number; output: number };
  cost?: number;
}

/**
 * Main validation-repair loop
 */
export async function validateAndRepairLoop(
  projectRoot: string,
  generatedCode: Map<string, string>,
  maxRetries: number = 10,
  flags = DEFAULT_V85_FLAGS
): Promise<ValidationResult> {
  let currentCode = new Map(generatedCode);
  let attempt = 0;
  const costLog: CostLog[] = [];

  console.log('\n🔍 Starting v8.5 Validation-Repair Loop...');
  console.log(`   Project: ${projectRoot}`);
  console.log(`   Files: ${currentCode.size}`);
  console.log(`   Max retries: ${maxRetries}`);

  // Write initial files to disk for validation
  await writeFilesToDisk(projectRoot, currentCode);

  while (attempt < maxRetries) {
    console.log(`\n🔄 Validation attempt ${attempt + 1}/${maxRetries}...`);

    // Step 1: Run AST guardrails
    let violations: Violation[] = [];
    
    if (flags.FF_V85_AST_GUARDRAILS) {
      try {
        violations = runFrameworkGuardrails(projectRoot);
      } catch (err: any) {
        console.warn(`⚠️ AST validation failed: ${err.message}`);
        // Fall back to basic syntax checks
        violations = await runBasicSyntaxChecks(currentCode);
      }
    }

    if (violations.length === 0) {
      console.log('✅ All validations passed!');
      return { success: true, code: currentCode, costLog };
    }

    console.log(`❌ Found ${violations.length} violations:`);
    violations.slice(0, 5).forEach(v => {
      console.log(`   - ${v.code}: ${v.message.substring(0, 60)}...`);
    });

    // Step 2: Classify violations
    const errors = classifyViolations(violations, attempt);

    // Step 3: Filter critical errors first
    const criticalErrors = errors
      .filter(e => e.severity === 'CRITICAL')
      .sort((a, b) =>
        (b.suggestedFixes[0]?.probability || 0) - (a.suggestedFixes[0]?.probability || 0)
      );

    if (criticalErrors.length === 0) {
      console.log('⚠️ Only non-critical errors found. Proceeding...');
      return { success: true, code: currentCode, costLog, violations };
    }

    // Step 4: Take first critical error
    const error = criticalErrors[0];
    const fix = error.suggestedFixes[0];

    if (!fix) {
      return {
        success: false,
        code: currentCode,
        costLog,
        failureReason: `Cannot fix ${error.category} after ${attempt} attempts.`,
        violations,
      };
    }

    console.log(`\n🔧 Applying ${fix.strategy} for ${error.subcategory}`);
    console.log(`   Success probability: ${(fix.probability * 100).toFixed(0)}%`);
    console.log(`   Using model: ${error.recommendedFixer}`);

    // Step 5: Apply fix
    if (flags.FF_V85_STRATEGY_REPAIR) {
      const fixResult = await applyFix(error, fix, currentCode, projectRoot);
      
      if (flags.FF_V85_COST_TRACKING) {
        costLog.push({
          model: error.recommendedFixer,
          tokensIn: fixResult.tokenUsage?.input || 0,
          tokensOut: fixResult.tokenUsage?.output || 0,
          cost: fixResult.cost || 0,
          strategy: fix.strategy,
          success: fixResult.success,
          timestamp: new Date().toISOString(),
        });
      }

      if (fixResult.success) {
        currentCode = fixResult.code;
        // Save fixed files to disk
        await writeFilesToDisk(projectRoot, currentCode);
        console.log(`✅ Fix applied successfully`);
      } else {
        console.log(`❌ Fix failed: ${fixResult.error}`);
      }
    }

    // Step 6: Check for escalation
    if (flags.FF_V85_ESCALATION && error.shouldEscalate) {
      console.log(`\n🚨 ESCALATION: Error requires human review`);
      console.log(`   Category: ${error.category}`);
      console.log(`   File: ${error.file}`);
      console.log(`   Attempts: ${attempt + 1}`);
      
      return {
        success: false,
        code: currentCode,
        costLog,
        failureReason: `Escalated after ${attempt + 1} attempts: ${error.category}`,
        violations,
      };
    }

    attempt++;
  }

  return {
    success: false,
    code: currentCode,
    costLog,
    failureReason: `Failed after ${maxRetries} attempts.`,
    violations: runFrameworkGuardrails(projectRoot),
  };
}

/**
 * Apply a fix strategy to the code
 */
async function applyFix(
  error: ValidationError,
  fix: { strategy: FixStrategy; promptOverride?: string },
  currentCode: Map<string, string>,
  projectRoot: string
): Promise<FixResult> {
  const fileContent = currentCode.get(error.file) || '';
  const newCode = new Map(currentCode);

  // Try to get relative path for cleaner logging
  const relativeFile = error.file.replace(projectRoot, '').replace(/^[/\\]/, '');

  switch (fix.strategy) {
    case FixStrategy.REMOVE_JSX:
    case FixStrategy.REMOVE_REACT_IMPORT: {
      const prompt = fix.promptOverride || buildFixPrompt(error, fileContent);
      const ai = await getAIClient();
      const result = await ai(error.recommendedFixer, prompt, {
        systemPrompt: 'You are a code fixer. Output ONLY the fixed code, no explanations, no markdown.',
        maxTokens: 4000,
      });

      if (result?.success && result?.content) {
        const cleanedCode = cleanAIOutput(result.content);
        newCode.set(error.file, cleanedCode);
        console.log(`   📝 Updated ${relativeFile}`);
      }

      return {
        success: result?.success || false,
        code: newCode,
        error: result?.error,
        tokenUsage: result?.usage,
        cost: result?.cost || 0,
      };
    }

    case FixStrategy.RENAME_FILE: {
      const newFile = error.file.replace(/\.ts$/, '.tsx');
      newCode.set(newFile, fileContent);
      newCode.delete(error.file);
      
      // Also rename on disk
      try {
        await fs.rename(error.file, newFile);
      } catch {
        // File might not exist on disk yet
      }
      
      console.log(`   📝 Renamed ${relativeFile} → ${path.basename(newFile)}`);

      return {
        success: true,
        code: newCode,
        tokenUsage: { input: 0, output: 0 },
        cost: 0,
      };
    }

    case FixStrategy.ADD_IMPORT:
    case FixStrategy.FIX_IMPORT_PATH:
    case FixStrategy.UPDATE_EXPORT:
    case FixStrategy.IMPLEMENT_FUNCTION_BODY:
    case FixStrategy.ADD_TYPE_ANNOTATION:
    case FixStrategy.FIX_SYNTAX: {
      const prompt = fix.promptOverride || buildFixPrompt(error, fileContent);
      const ai = await getAIClient();
      const result = await ai(error.recommendedFixer, prompt, {
        systemPrompt: 'You are a code fixer. Output ONLY the fixed code, no explanations, no markdown.',
        maxTokens: 4000,
      });

      if (result?.success && result?.content) {
        const cleanedCode = cleanAIOutput(result.content);
        newCode.set(error.file, cleanedCode);
        console.log(`   📝 Updated ${relativeFile}`);
      }

      return {
        success: result?.success || false,
        code: newCode,
        error: result?.error,
        tokenUsage: result?.usage,
        cost: result?.cost || 0,
      };
    }

    default:
      return {
        success: false,
        code: currentCode,
        error: `Unsupported strategy: ${fix.strategy}`,
      };
  }
}

/**
 * Build a fix prompt for the AI
 */
function buildFixPrompt(error: ValidationError, fileContent: string): string {
  return `
Fix this error in the file:

ERROR: ${error.errorMessage}
ROOT CAUSE: ${error.rootCause}
CATEGORY: ${error.category}

CURRENT FILE CONTENT:
\`\`\`typescript
${fileContent}
\`\`\`

Output ONLY the complete fixed file content. No explanations.
`;
}

/**
 * Clean AI output (remove markdown code blocks, etc.)
 */
function cleanAIOutput(output: string): string {
  let cleaned = output.trim();
  
  // Remove markdown code blocks
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:typescript|tsx|ts|javascript|js)?\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Write files to disk
 */
async function writeFilesToDisk(
  projectRoot: string,
  code: Map<string, string>
): Promise<void> {
  for (const [filePath, content] of code.entries()) {
    const fullPath = filePath.startsWith(projectRoot) 
      ? filePath 
      : path.join(projectRoot, filePath);
    
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    } catch (err: any) {
      console.warn(`⚠️ Failed to write ${filePath}: ${err.message}`);
    }
  }
}

/**
 * Run basic syntax checks when AST validation fails
 */
async function runBasicSyntaxChecks(code: Map<string, string>): Promise<Violation[]> {
  const violations: Violation[] = [];
  
  for (const [filePath, content] of code.entries()) {
    const fileViolations = checkFileSyntax(filePath, content);
    violations.push(...fileViolations);
  }
  
  return violations;
}

/**
 * Quick validation without repair (for pre-checks)
 */
export async function quickValidate(
  projectRoot: string,
  code: Map<string, string>
): Promise<{ valid: boolean; violations: Violation[] }> {
  await writeFilesToDisk(projectRoot, code);
  
  const violations = runFrameworkGuardrails(projectRoot);
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Get cost summary from cost log
 */
export function getCostSummary(costLog: CostLog[]): {
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  successRate: number;
  byModel: Record<string, { cost: number; attempts: number; successes: number }>;
} {
  const summary = {
    totalCost: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    successRate: 0,
    byModel: {} as Record<string, { cost: number; attempts: number; successes: number }>,
  };
  
  let successCount = 0;
  
  for (const log of costLog) {
    summary.totalCost += log.cost;
    summary.totalTokensIn += log.tokensIn;
    summary.totalTokensOut += log.tokensOut;
    
    if (log.success) successCount++;
    
    if (!summary.byModel[log.model]) {
      summary.byModel[log.model] = { cost: 0, attempts: 0, successes: 0 };
    }
    summary.byModel[log.model].cost += log.cost;
    summary.byModel[log.model].attempts++;
    if (log.success) summary.byModel[log.model].successes++;
  }
  
  summary.successRate = costLog.length > 0 ? successCount / costLog.length : 0;
  
  return summary;
}

