// =============================================================================
// FROST NIGHT FACTORY v8.5 - UNIFIED ENTRY POINT
// =============================================================================
// Single import for all v8.5 features

// Types
export {
  // Schemas
  FileTypeConstraintsSchema,
  ProjectBlueprintSchema,
  ValidationErrorSchema,
  CostLogSchema,
  FileManifestItemSchema,
  SuggestedFixSchema,
  CoderPhaseOutputSchema,
  TesterPhaseOutputSchema,
  
  // Types
  type FileTypeConstraints,
  type ProjectBlueprint,
  type ValidationError,
  type CostLog,
  type FileManifestItem,
  type SuggestedFix,
  type CoderPhaseOutput,
  type TesterPhaseOutput,
  type V85FeatureFlags,
  
  // Enums
  ErrorCategory,
  FixStrategy,
  
  // Constants
  DEFAULT_FILE_TYPE_CONSTRAINTS,
  DEFAULT_V85_FLAGS,
} from './v85-types';

// AST Validators
export {
  runFrameworkGuardrails,
  checkFileSyntax,
  type Violation,
} from './v85-ast-validators';

// Error Classifier
export {
  classifyError,
  classifyViolations,
} from './v85-error-classifier';

// Validation Loop
export {
  validateAndRepairLoop,
  quickValidate,
  getCostSummary,
} from './v85-validation-loop';

// Planner
export {
  getPlannerSystemPrompt,
  validateBlueprint,
  createDefaultBlueprint,
  mergeConstraints,
  getFileConstraints,
} from './v85-planner';

// Coder
export {
  generateCoderSystemPrompt,
  generateFilePrompt,
  generateApiRoutePrompt,
  generateComponentPrompt,
  generateUtilityPrompt,
  postProcessCode,
  getDefaultConstraints,
} from './v85-coder';

// Tester
export {
  runV85TesterPhase,
  runV85Validation,
  validateSingleFile,
  getTesterStats,
} from './v85-tester';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { DEFAULT_V85_FLAGS } from './v85-types';
import type { ProjectBlueprint, V85FeatureFlags } from './v85-types';
import { runFrameworkGuardrails } from './v85-ast-validators';
import { validateAndRepairLoop } from './v85-validation-loop';
import { validateBlueprint, createDefaultBlueprint } from './v85-planner';
import { generateCoderSystemPrompt, getDefaultConstraints } from './v85-coder';

/**
 * Quick start: Create a new v8.5 project
 */
export function createV85Project(projectName: string): {
  blueprint: ProjectBlueprint;
  systemPrompt: string;
} {
  const blueprint = createDefaultBlueprint(projectName);
  const systemPrompt = generateCoderSystemPrompt(blueprint.fileTypeConstraints);
  
  return { blueprint, systemPrompt };
}

/**
 * Quick validation: Check if a project passes all v8.5 rules
 */
export async function validateV85Project(
  projectRoot: string
): Promise<{ passed: boolean; errors: string[] }> {
  const violations = runFrameworkGuardrails(projectRoot);
  
  return {
    passed: violations.length === 0,
    errors: violations.map(v => `${v.filePath}: ${v.message}`),
  };
}

/**
 * Full pipeline: Validate and repair a project
 */
export async function runV85Pipeline(
  projectRoot: string,
  generatedCode: Map<string, string>,
  flags: V85FeatureFlags = DEFAULT_V85_FLAGS
): Promise<{
  success: boolean;
  finalCode: Map<string, string>;
  costTotal: number;
  errors?: string[];
}> {
  const result = await validateAndRepairLoop(projectRoot, generatedCode, 10, flags);
  
  return {
    success: result.success,
    finalCode: result.code,
    costTotal: result.costLog.reduce((sum, log) => sum + log.cost, 0),
    errors: result.failureReason ? [result.failureReason] : undefined,
  };
}

/**
 * Get v8.5 version info
 */
export function getV85Version(): {
  version: string;
  features: string[];
  flags: V85FeatureFlags;
} {
  return {
    version: '8.5.0',
    features: [
      'Zod schema validation at phase boundaries',
      'AST-level guardrails (JSX detection, import validation)',
      'Strategy-aware repair loop with prompt overrides',
      'Cost tracking per attempt',
      'Feature-flagged rollout',
      'Enhanced error classification (15+ categories)',
      'Model escalation (Groq → DeepSeek → Claude)',
    ],
    flags: DEFAULT_V85_FLAGS,
  };
}

console.log('✅ Frost Night Factory v8.5 loaded');

