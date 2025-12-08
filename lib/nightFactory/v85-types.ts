// =============================================================================
// FROST NIGHT FACTORY v8.5 - TYPE DEFINITIONS
// =============================================================================
// Contracts with Zod validation for every phase boundary

import { z } from 'zod';

// ============================================================
// CONTRACTS (Gemini's design)
// ============================================================

export const FileTypeConstraintsSchema = z.object({
  api_routes: z.object({
    extension: z.literal('.ts'),
    location: z.string(),
    rules: z.array(z.enum(['NO_REACT_IMPORTS', 'NO_JSX', 'PURE_ASYNC_FUNCTIONS', 'NAMED_EXPORTS_ONLY'])),
    example: z.string(),
  }),
  components: z.object({
    extension: z.literal('.tsx'),
    location: z.string(),
    rules: z.array(z.enum(['CAN_REACT', 'CAN_JSX', 'DEFAULT_OR_NAMED_EXPORT', 'USE_CLIENT_DIRECTIVE'])),
    example: z.string(),
  }),
  utilities: z.object({
    extension: z.literal('.ts'),
    location: z.string(),
    rules: z.array(z.enum(['NO_REACT', 'NO_JSX', 'PURE_FUNCTIONS'])),
    example: z.string(),
  }),
});

export type FileTypeConstraints = z.infer<typeof FileTypeConstraintsSchema>;

export const FileManifestItemSchema = z.object({
  path: z.string(),
  kind: z.enum(['api_route', 'page', 'layout', 'component', 'utility', 'type']),
  expected_extension: z.enum(['.ts', '.tsx']),
  description: z.string(),
  constraints: z.array(z.string()),
});

export type FileManifestItem = z.infer<typeof FileManifestItemSchema>;

export const ProjectBlueprintSchema = z.object({
  project_name: z.string(),
  fileTypeConstraints: FileTypeConstraintsSchema,
  files: z.array(FileManifestItemSchema),
});

export type ProjectBlueprint = z.infer<typeof ProjectBlueprintSchema>;

// ============================================================
// ERROR CLASSIFICATION (Perplexity's hierarchy)
// ============================================================

export enum ErrorCategory {
  FILE_EXTENSION_MISMATCH = 'FILE_EXTENSION_MISMATCH',
  FILE_STRUCTURE_VIOLATION = 'FILE_STRUCTURE_VIOLATION',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  LAZY_CODE = 'LAZY_CODE',
  INCOMPLETE_IMPLEMENTATION = 'INCOMPLETE_IMPLEMENTATION',
  MISSING_IMPORT = 'MISSING_IMPORT',
  MISSING_EXPORT = 'MISSING_EXPORT',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  SQL_INJECTION_RISK = 'SQL_INJECTION_RISK',
  MISSING_ENVIRONMENT_VAR = 'MISSING_ENVIRONMENT_VAR',
  BROKEN_IMPORT_PATH = 'BROKEN_IMPORT_PATH',
  SYNTAXERROR = 'SYNTAXERROR',
  UNKNOWN = 'UNKNOWN',
}

export enum FixStrategy {
  REMOVE_JSX = 'REMOVE_JSX',
  RENAME_FILE = 'RENAME_FILE',
  REMOVE_REACT_IMPORT = 'REMOVE_REACT_IMPORT',
  ADD_IMPORT = 'ADD_IMPORT',
  UPDATE_EXPORT = 'UPDATE_EXPORT',
  ADD_TYPE_ANNOTATION = 'ADD_TYPE_ANNOTATION',
  IMPLEMENT_FUNCTION_BODY = 'IMPLEMENT_FUNCTION_BODY',
  ADD_INPUT_VALIDATION = 'ADD_INPUT_VALIDATION',
  FIX_SYNTAX = 'FIX_SYNTAX',
  FIX_IMPORT_PATH = 'FIX_IMPORT_PATH',
  REQUIRE_HUMAN_REVIEW = 'REQUIRE_HUMAN_REVIEW',
}

export const SuggestedFixSchema = z.object({
  strategy: z.nativeEnum(FixStrategy),
  probability: z.number().min(0).max(1),
  promptOverride: z.string().optional(),
});

export type SuggestedFix = z.infer<typeof SuggestedFixSchema>;

export const ValidationErrorSchema = z.object({
  file: z.string(),
  category: z.nativeEnum(ErrorCategory),
  subcategory: z.string(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  errorMessage: z.string(),
  rootCause: z.string(),
  suggestedFixes: z.array(SuggestedFixSchema),
  recommendedFixer: z.enum(['groq', 'deepseek_v3', 'deepseek_r1', 'claude']),
  retryCount: z.number(),
  maxRetries: z.number(),
  shouldEscalate: z.boolean(),
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;

// ============================================================
// COST TRACKING
// ============================================================

export const CostLogSchema = z.object({
  model: z.string(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  cost: z.number(),
  strategy: z.nativeEnum(FixStrategy),
  success: z.boolean(),
  timestamp: z.string().optional(),
});

export type CostLog = z.infer<typeof CostLogSchema>;

// ============================================================
// PHASE OUTPUT SCHEMAS
// ============================================================

export const CoderPhaseOutputSchema = z.object({
  phase: z.literal('coder'),
  generatedFiles: z.record(z.string(), z.string()), // path -> content
  metadata: z.object({
    totalFiles: z.number(),
    model: z.string(),
    timestamp: z.string(),
  }),
});

export type CoderPhaseOutput = z.infer<typeof CoderPhaseOutputSchema>;

export const TesterPhaseOutputSchema = z.object({
  phase: z.literal('tester'),
  status: z.enum(['PASSED', 'FAILED', 'PARTIAL']),
  reason: z.string().optional(),
  costBreakdown: z.array(CostLogSchema),
  finalCode: z.record(z.string(), z.string()).optional(),
  violations: z.array(z.object({
    file: z.string(),
    code: z.string(),
    message: z.string(),
    line: z.number().optional(),
  })).optional(),
});

export type TesterPhaseOutput = z.infer<typeof TesterPhaseOutputSchema>;

// ============================================================
// FEATURE FLAGS
// ============================================================

export interface V85FeatureFlags {
  FF_V85_VALIDATION: boolean;
  FF_V85_AST_GUARDRAILS: boolean;
  FF_V85_COST_TRACKING: boolean;
  FF_V85_STRATEGY_REPAIR: boolean;
  FF_V85_ESCALATION: boolean;
}

export const DEFAULT_V85_FLAGS: V85FeatureFlags = {
  FF_V85_VALIDATION: true,
  FF_V85_AST_GUARDRAILS: true,
  FF_V85_COST_TRACKING: true,
  FF_V85_STRATEGY_REPAIR: true,
  FF_V85_ESCALATION: true,
};

// ============================================================
// DEFAULT CONSTRAINTS
// ============================================================

export const DEFAULT_FILE_TYPE_CONSTRAINTS: FileTypeConstraints = {
  api_routes: {
    extension: '.ts',
    location: '/src/app/api/**',
    rules: ['NO_REACT_IMPORTS', 'NO_JSX', 'PURE_ASYNC_FUNCTIONS', 'NAMED_EXPORTS_ONLY'],
    example: `import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ data: [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ success: true });
}`,
  },
  components: {
    extension: '.tsx',
    location: '/src/components/** or /src/app/**',
    rules: ['CAN_REACT', 'CAN_JSX', 'DEFAULT_OR_NAMED_EXPORT', 'USE_CLIENT_DIRECTIVE'],
    example: `'use client';

import React from 'react';

export default function MyComponent() {
  return (
    <div className="p-4">
      <h1>Component</h1>
    </div>
  );
}`,
  },
  utilities: {
    extension: '.ts',
    location: '/src/lib/**',
    rules: ['NO_REACT', 'NO_JSX', 'PURE_FUNCTIONS'],
    example: `export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function calculateTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}`,
  },
};

