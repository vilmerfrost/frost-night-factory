// =============================================================================
// FROST NIGHT FACTORY v8.5 - TESTER PHASE
// =============================================================================
// Enhanced tester with validation-repair loop integration

import { 
  ProjectBlueprint, 
  TesterPhaseOutput, 
  CostLog,
  DEFAULT_V85_FLAGS,
  V85FeatureFlags 
} from './v85-types';
import { validateAndRepairLoop, quickValidate, getCostSummary } from './v85-validation-loop';
import { runFrameworkGuardrails, Violation } from './v85-ast-validators';

interface CoderOutput {
  generatedFiles: Map<string, string> | Record<string, string>;
  metadata?: {
    totalFiles: number;
    model: string;
    timestamp: string;
  };
}

/**
 * Run the v8.5 enhanced tester phase
 */
export async function runV85TesterPhase(
  blueprint: ProjectBlueprint,
  coderOutput: CoderOutput,
  projectRoot: string,
  flags: V85FeatureFlags = DEFAULT_V85_FLAGS
): Promise<TesterPhaseOutput> {
  console.log('\n🧪 Starting v8.5 Enhanced Tester Phase...');
  console.log(`   Project: ${blueprint.project_name}`);
  console.log(`   Root: ${projectRoot}`);
  
  // Convert Record to Map if needed
  const generatedFiles = coderOutput.generatedFiles instanceof Map
    ? coderOutput.generatedFiles
    : new Map(Object.entries(coderOutput.generatedFiles));
  
  console.log(`   Files: ${generatedFiles.size}`);

  // Step 1: Quick validation (no repair)
  if (flags.FF_V85_VALIDATION) {
    console.log('\n📋 Running quick validation...');
    const quickResult = await quickValidate(projectRoot, generatedFiles);
    
    if (quickResult.valid) {
      console.log('✅ Quick validation passed!');
      return {
        phase: 'tester',
        status: 'PASSED',
        costBreakdown: [],
        finalCode: Object.fromEntries(generatedFiles),
      };
    }
    
    console.log(`⚠️ Quick validation found ${quickResult.violations.length} issues`);
  }

  // Step 2: Run validation-repair loop
  console.log('\n🔄 Starting validation-repair loop...');
  const result = await validateAndRepairLoop(
    projectRoot,
    generatedFiles,
    10, // max retries
    flags
  );

  // Step 3: Generate output
  if (result.success) {
    console.log('\n✅ Tester phase PASSED!');
    
    const costSummary = getCostSummary(result.costLog);
    console.log(`💰 Total repair cost: $${costSummary.totalCost.toFixed(4)}`);
    console.log(`📊 Success rate: ${(costSummary.successRate * 100).toFixed(0)}%`);
    
    return {
      phase: 'tester',
      status: 'PASSED',
      costBreakdown: result.costLog,
      finalCode: Object.fromEntries(result.code),
    };
  } else {
    console.log('\n❌ Tester phase FAILED');
    console.log(`   Reason: ${result.failureReason}`);
    
    return {
      phase: 'tester',
      status: 'FAILED',
      reason: result.failureReason,
      costBreakdown: result.costLog,
      violations: result.violations?.map(v => ({
        file: v.filePath,
        code: v.code,
        message: v.message,
        line: v.line,
      })),
    };
  }
}

/**
 * Run standalone validation (no repair)
 */
export async function runV85Validation(
  projectRoot: string,
  flags: V85FeatureFlags = DEFAULT_V85_FLAGS
): Promise<{
  passed: boolean;
  violations: Violation[];
  summary: string;
}> {
  console.log('\n🔍 Running v8.5 validation...');
  
  const violations = runFrameworkGuardrails(projectRoot);
  
  const summary = generateValidationSummary(violations);
  console.log(summary);
  
  return {
    passed: violations.length === 0,
    violations,
    summary,
  };
}

/**
 * Generate validation summary
 */
function generateValidationSummary(violations: Violation[]): string {
  if (violations.length === 0) {
    return '✅ All validations passed!';
  }
  
  const byCode: Record<string, number> = {};
  for (const v of violations) {
    byCode[v.code] = (byCode[v.code] || 0) + 1;
  }
  
  const lines = [
    `❌ Found ${violations.length} violations:`,
    '',
    'By type:',
    ...Object.entries(byCode).map(([code, count]) => `  - ${code}: ${count}`),
    '',
    'Details:',
    ...violations.slice(0, 10).map(v => 
      `  - ${v.filePath}:${v.line || '?'} - ${v.code}: ${v.message.substring(0, 60)}...`
    ),
  ];
  
  if (violations.length > 10) {
    lines.push(`  ... and ${violations.length - 10} more`);
  }
  
  return lines.join('\n');
}

/**
 * Check if a specific file passes validation
 */
export function validateSingleFile(
  filePath: string,
  content: string
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  
  const isApiRoute = filePath.includes('/api/') && filePath.endsWith('/route.ts');
  const isTsFile = filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
  
  // Check JSX in .ts
  if (isTsFile && /<[A-Z][a-z]+|<\/>|<>/.test(content)) {
    violations.push('JSX syntax in .ts file');
  }
  
  // Check React imports in API routes
  if (isApiRoute) {
    if (/import.*from\s+['"]react['"]/.test(content)) {
      violations.push('React import in API route');
    }
    if (/<[A-Z][a-z]+/.test(content)) {
      violations.push('JSX in API route');
    }
  }
  
  // Check lazy patterns
  if (/return\s+null\s*;/.test(content)) {
    violations.push('Lazy return null');
  }
  if (/:\s*any(?:\s|;|,|\))/.test(content)) {
    violations.push('Using any type');
  }
  
  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Get tester phase statistics
 */
export function getTesterStats(output: TesterPhaseOutput): {
  status: string;
  totalAttempts: number;
  totalCost: number;
  successRate: number;
  modelBreakdown: Record<string, number>;
} {
  const totalAttempts = output.costBreakdown.length;
  const totalCost = output.costBreakdown.reduce((sum, log) => sum + log.cost, 0);
  const successCount = output.costBreakdown.filter(log => log.success).length;
  const successRate = totalAttempts > 0 ? successCount / totalAttempts : 0;
  
  const modelBreakdown: Record<string, number> = {};
  for (const log of output.costBreakdown) {
    modelBreakdown[log.model] = (modelBreakdown[log.model] || 0) + 1;
  }
  
  return {
    status: output.status,
    totalAttempts,
    totalCost,
    successRate,
    modelBreakdown,
  };
}

