// =============================================================================
// FROST NIGHT FACTORY v8.5 - ENHANCED ERROR CLASSIFIER
// =============================================================================
// Perplexity's hierarchy with 15+ categories and strategy-aware prompts

import { ErrorCategory, FixStrategy } from './v85-types';
import type { ValidationError } from './v85-types';

interface BuildError {
  file: string;
  message: string;
  line?: number;
}

interface PatternMatcher {
  pattern: RegExp;
  category: ErrorCategory;
  subcategory: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedFixes: FixStrategy[];
  promptOverride?: (match: RegExpMatchArray) => string;
}

// New fix strategy for layout contract regeneration
export enum ExtendedFixStrategy {
  REGENERATE_FROM_CONTRACT = 'REGENERATE_FROM_CONTRACT',
}

const ERROR_MATCHERS: PatternMatcher[] = [
  // === INTRINSIC ATTRIBUTES ERRORS (NEW - Priority) ===
  {
    pattern: /Type .* is not assignable to type 'IntrinsicAttributes[\s\S]*Property '(.+?)' does not exist/,
    category: ErrorCategory.FILE_STRUCTURE_VIOLATION,
    subcategory: 'missing_component_props',
    severity: 'CRITICAL',
    suggestedFixes: [FixStrategy.IMPLEMENT_FUNCTION_BODY],
    promptOverride: (match) => `
CRITICAL: Component props mismatch - IntrinsicAttributes error.

The component is missing the prop: "${match[1]}"

This is a LAYOUT CONTRACT VIOLATION. The component must match its contract exactly.

FIX REQUIRED:
1. Find the component being used (FormPage, AppShell, etc.)
2. Check the Layout Contract for its exact props
3. Implement the component with ALL required props
4. Do NOT add, rename, or remove any props from the contract

If this is a layout component, regenerate it from the layout contract.

Output ONLY the fixed code with no explanations.
    `,
  },
  {
    pattern: /Property '(.+?)' does not exist on type 'IntrinsicAttributes'/,
    category: ErrorCategory.FILE_STRUCTURE_VIOLATION,
    subcategory: 'intrinsic_attributes_error',
    severity: 'CRITICAL',
    suggestedFixes: [FixStrategy.IMPLEMENT_FUNCTION_BODY],
    promptOverride: (match) => `
CRITICAL: IntrinsicAttributes error - prop "${match[1]}" not found.

This means the component doesn't accept this prop. Options:
1. Add the prop to the component's interface
2. Remove the prop from where it's being passed
3. If this is a layout component, regenerate from contract

FIX: Check the component definition and ensure all props are properly typed.

Output ONLY the fixed code with no explanations.
    `,
  },
  {
    pattern: /TS2322[\s\S]*IntrinsicAttributes/,
    category: ErrorCategory.FILE_STRUCTURE_VIOLATION,
    subcategory: 'ts2322_intrinsic_attributes',
    severity: 'CRITICAL',
    suggestedFixes: [FixStrategy.IMPLEMENT_FUNCTION_BODY, FixStrategy.ADD_TYPE_ANNOTATION],
    promptOverride: () => `
CRITICAL: TS2322 with IntrinsicAttributes - component props type mismatch.

This error occurs when:
1. A required prop is missing from the component interface
2. Props are being passed to a component that doesn't accept them
3. The component's props interface doesn't match its usage

FIX STRATEGY:
1. Identify which component has the error
2. Check if it's a layout component (AppShell, FormPage, etc.)
3. If layout component: regenerate from layout contract
4. If custom component: add missing props to the interface

IMPORTANT: Layout components have FROZEN contracts - they must match exactly.

Output ONLY the fixed code with no explanations.
    `,
  },

  // JSX in .ts files
  {
    pattern: /JSX syntax detected in \.ts file|NO_JSX_IN_TS/,
    category: ErrorCategory.FILE_EXTENSION_MISMATCH,
    subcategory: 'jsx_in_ts_file',
    severity: 'CRITICAL',
    suggestedFixes: [FixStrategy.REMOVE_JSX, FixStrategy.RENAME_FILE],
    promptOverride: () => `
CRITICAL: This is a .ts file. It CANNOT contain JSX syntax.

FIX REQUIRED (choose ONE):

OPTION 1 - REMOVE JSX (Preferred for API routes):
1. Remove all "import React" statements
2. Remove all JSX code (<tags>, fragments <>...</>)
3. Replace with plain JavaScript/TypeScript
4. Keep async function exports (GET, POST, etc.)

OPTION 2 - RENAME TO .tsx (For components only):
1. Change file extension from .ts to .tsx
2. Keep all React/JSX code as-is

EXAMPLE FOR API ROUTE (OPTION 1):
// BEFORE (WRONG):
import React from 'react';
export default function PDFRenderer() {
  return <div>PDF</div>;
}

// AFTER (CORRECT):
import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const data = await req.json();
  return NextResponse.json({ success: true });
}

Output ONLY the fixed code with no explanations.
    `,
  },

  // API route JSX
  {
    pattern: /API route files must not contain JSX|API_NO_JSX/,
    category: ErrorCategory.FILE_STRUCTURE_VIOLATION,
    subcategory: 'jsx_in_api_route',
    severity: 'CRITICAL',
    suggestedFixes: [FixStrategy.REMOVE_JSX, FixStrategy.REMOVE_REACT_IMPORT],
    promptOverride: () => `
CRITICAL: This is an API route (.ts file in /app/api/). API routes CANNOT contain React or JSX.

FIX REQUIRED:
1. Remove ALL "import React" statements
2. Remove ALL JSX code (<tags>, fragments)
3. Replace with non-React alternative
4. Export async functions (GET, POST, PUT, DELETE)
5. Return NextResponse.json() or Response

EXAMPLE:
// BEFORE (WRONG):
import React from 'react';
export default function Handler() {
  return <div>Response</div>;
}

// AFTER (CORRECT):
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ data: [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ success: true });
}

Output ONLY the fixed code with no explanations.
    `,
  },

  // React imports in API routes
  {
    pattern: /API route files must not import React|API_NO_REACT_IMPORTS|API_FORBIDDEN_IMPORT/,
    category: ErrorCategory.FILE_STRUCTURE_VIOLATION,
    subcategory: 'react_in_api_route',
    severity: 'CRITICAL',
    suggestedFixes: [FixStrategy.REMOVE_REACT_IMPORT],
    promptOverride: () => `
CRITICAL: API routes cannot import React, react-dom, or next/navigation.

FIX REQUIRED:
1. Remove: import React from 'react'
2. Remove: import { useRouter } from 'next/navigation'
3. Remove: import ReactDOM from 'react-dom'
4. Keep only server-side imports (NextRequest, NextResponse, etc.)

API routes are SERVER-SIDE ONLY. They cannot use React hooks or components.

Output ONLY the fixed code with no explanations.
    `,
  },

  // Missing HTTP handler
  {
    pattern: /API route must export at least one HTTP handler|API_MISSING_HANDLER/,
    category: ErrorCategory.MISSING_EXPORT,
    subcategory: 'missing_http_handler',
    severity: 'HIGH',
    suggestedFixes: [FixStrategy.UPDATE_EXPORT],
    promptOverride: () => `
API route is missing HTTP handlers.

FIX REQUIRED:
Export at least one of: GET, POST, PUT, PATCH, DELETE, OPTIONS

EXAMPLE:
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ data: [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Process body
  return NextResponse.json({ success: true });
}

Output ONLY the fixed code with no explanations.
    `,
  },

  // Missing module/import
  {
    pattern: /Cannot find module ['"](.+?)['"]/,
    category: ErrorCategory.MISSING_IMPORT,
    subcategory: 'missing_module',
    severity: 'HIGH',
    suggestedFixes: [FixStrategy.ADD_IMPORT, FixStrategy.FIX_IMPORT_PATH],
    promptOverride: (match) => `
Missing import detected.

MODULE: ${match[1]}

FIX OPTIONS:

1. If module exists, add import:
   import { /* exports */ } from '${match[1]}';

2. If path is wrong, fix to use @/ alias:
   import { utils } from '@/lib/utils';

3. If module doesn't exist, create it or remove the import.

Output ONLY the fixed code with no explanations.
    `,
  },

  // Lazy code patterns
  {
    pattern: /return null|LAZY_RETURN_NULL|LAZY CODE DETECTED|: any(?:\s|;|,|\))|TODO:|FIXME:/i,
    category: ErrorCategory.LAZY_CODE,
    subcategory: 'incomplete_implementation',
    severity: 'CRITICAL',
    suggestedFixes: [FixStrategy.IMPLEMENT_FUNCTION_BODY],
    promptOverride: () => `
CRITICAL: Lazy code detected (null, any, TODO placeholder).

You MUST implement full logic. No placeholders allowed.

RULES:
- No "return null" in components - render fallback UI like <div>Loading...</div>
- No "any" types - use proper TypeScript types
- No "TODO" comments - implement the feature NOW
- No empty function bodies - write full implementation

EXAMPLE:
// BEFORE (WRONG):
function getData(): any {
  // TODO: implement
  return null;
}

// AFTER (CORRECT):
interface DataResult {
  items: string[];
  total: number;
}

async function getData(): Promise<DataResult> {
  const response = await fetch('/api/data');
  const data = await response.json();
  return {
    items: data.items || [],
    total: data.total || 0,
  };
}

Output ONLY the fixed code with no explanations.
    `,
  },

  // Deep relative imports
  {
    pattern: /Avoid deep relative imports|IMPORT_DEEP_RELATIVE/,
    category: ErrorCategory.BROKEN_IMPORT_PATH,
    subcategory: 'deep_relative',
    severity: 'MEDIUM',
    suggestedFixes: [FixStrategy.FIX_IMPORT_PATH],
    promptOverride: () => `
Fix import path to use "@/" alias instead of deep relative imports.

WRONG: import { utils } from '../../../lib/utils';
CORRECT: import { utils } from '@/lib/utils';

WRONG: import { Button } from '../../components/ui/button';
CORRECT: import { Button } from '@/components/ui/button';

Replace ALL "../../../" imports with "@/" aliases.

Output ONLY the fixed code with no explanations.
    `,
  },

  // Syntax errors
  {
    pattern: /Unexpected token|Parse error|SYNTAX_ERROR|SyntaxError/i,
    category: ErrorCategory.SYNTAXERROR,
    subcategory: 'syntax',
    severity: 'CRITICAL',
    suggestedFixes: [FixStrategy.FIX_SYNTAX],
    promptOverride: () => `
Syntax error detected.

CHECK:
1. Missing or extra brackets: { } [ ] ( )
2. Missing semicolons
3. Unclosed strings or template literals
4. Invalid JSX syntax
5. Missing commas in objects/arrays

Fix the syntax error and output ONLY the corrected code.
    `,
  },

  // Type errors
  {
    pattern: /Property ['"](.+?)['"] does not exist on type|TS2339/,
    category: ErrorCategory.TYPE_MISMATCH,
    subcategory: 'property_not_exist',
    severity: 'HIGH',
    suggestedFixes: [FixStrategy.ADD_TYPE_ANNOTATION],
    promptOverride: (match) => `
TypeScript error: Property "${match[1]}" does not exist.

FIX OPTIONS:
1. Add the property to the type definition
2. Use optional chaining: obj?.${match[1]}
3. Add type assertion if you're sure it exists
4. Check if you're accessing the wrong property

Output ONLY the fixed code with no explanations.
    `,
  },

  // Missing export
  {
    pattern: /Module ['"](.+?)['"] has no exported member ['"](.+?)['"]/,
    category: ErrorCategory.MISSING_EXPORT,
    subcategory: 'missing_exported_member',
    severity: 'HIGH',
    suggestedFixes: [FixStrategy.UPDATE_EXPORT, FixStrategy.FIX_IMPORT_PATH],
    promptOverride: (match) => `
Export "${match[2]}" not found in module "${match[1]}".

FIX OPTIONS:
1. Check if the export name is spelled correctly
2. Add the export to the source module
3. Import from a different module that has this export
4. Use a default import instead: import Module from '${match[1]}'

Output ONLY the fixed code with no explanations.
    `,
  },
];

/**
 * Classify a build error and return fix strategies
 */
export function classifyError(
  buildError: BuildError,
  retryCount: number
): ValidationError {
  for (const matcher of ERROR_MATCHERS) {
    const match = buildError.message.match(matcher.pattern);
    if (match) {
      const strategy = selectBestFix(matcher.suggestedFixes, retryCount);

      return {
        file: buildError.file,
        category: matcher.category,
        subcategory: matcher.subcategory,
        severity: matcher.severity,
        errorMessage: buildError.message,
        rootCause: generateRootCause(matcher.category),
        suggestedFixes: [
          {
            strategy,
            probability: calculateProbability(strategy),
            promptOverride: matcher.promptOverride?.(match),
          },
          ...matcher.suggestedFixes.filter(s => s !== strategy).map(s => ({
            strategy: s,
            probability: calculateProbability(s) * 0.7,
          })),
        ],
        recommendedFixer: selectFixerModel(matcher.severity, retryCount),
        retryCount,
        maxRetries: 10,
        shouldEscalate: retryCount > 3 && matcher.severity === 'CRITICAL',
      };
    }
  }

  // Unknown error
  return {
    file: buildError.file,
    category: ErrorCategory.UNKNOWN,
    subcategory: buildError.message.substring(0, 50),
    severity: 'MEDIUM',
    errorMessage: buildError.message,
    rootCause: 'Unknown error pattern. Manual review required.',
    suggestedFixes: [],
    recommendedFixer: 'deepseek_r1',
    retryCount,
    maxRetries: 10,
    shouldEscalate: true,
  };
}

function selectBestFix(strategies: FixStrategy[], retryCount: number): FixStrategy {
  if (retryCount > 2) {
    // After 2 retries, prefer structural fixes
    return strategies.find(s =>
      s === FixStrategy.REMOVE_JSX ||
      s === FixStrategy.RENAME_FILE ||
      s === FixStrategy.IMPLEMENT_FUNCTION_BODY
    ) || strategies[0];
  }
  return strategies[0];
}

function calculateProbability(strategy: FixStrategy): number {
  const probabilities: Record<FixStrategy, number> = {
    [FixStrategy.REMOVE_JSX]: 0.95,
    [FixStrategy.RENAME_FILE]: 0.85,
    [FixStrategy.IMPLEMENT_FUNCTION_BODY]: 0.80,
    [FixStrategy.ADD_IMPORT]: 0.90,
    [FixStrategy.FIX_IMPORT_PATH]: 0.92,
    [FixStrategy.ADD_TYPE_ANNOTATION]: 0.75,
    [FixStrategy.REMOVE_REACT_IMPORT]: 0.88,
    [FixStrategy.UPDATE_EXPORT]: 0.82,
    [FixStrategy.ADD_INPUT_VALIDATION]: 0.70,
    [FixStrategy.FIX_SYNTAX]: 0.60,
    [FixStrategy.REQUIRE_HUMAN_REVIEW]: 0.00,
  };
  return probabilities[strategy] || 0.50;
}

function selectFixerModel(
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  retryCount: number
): 'groq' | 'deepseek_v3' | 'deepseek_r1' | 'claude' {
  if (retryCount === 0 || retryCount === 1) {
    return severity === 'CRITICAL' ? 'deepseek_v3' : 'groq';
  }
  if (retryCount < 3) return 'deepseek_v3';
  if (retryCount < 6) return 'deepseek_r1';
  return 'claude';
}

function generateRootCause(category: ErrorCategory): string {
  const causes: Record<ErrorCategory, string> = {
    [ErrorCategory.FILE_EXTENSION_MISMATCH]:
      'File extension does not match content. .ts files cannot contain JSX.',
    [ErrorCategory.MISSING_IMPORT]:
      'Module not imported. Add import statement at top of file.',
    [ErrorCategory.LAZY_CODE]:
      'Incomplete implementation. Remove placeholders (null, any, TODO) and implement full logic.',
    [ErrorCategory.BROKEN_IMPORT_PATH]:
      'Deep relative import detected. Use "@/" path alias instead.',
    [ErrorCategory.FILE_STRUCTURE_VIOLATION]:
      'File violates structural rules (e.g., React imports in server file).',
    [ErrorCategory.TYPE_MISMATCH]:
      'Type mismatch. Property doesn\'t exist on this type.',
    [ErrorCategory.INCOMPLETE_IMPLEMENTATION]:
      'Function body is incomplete or missing.',
    [ErrorCategory.MISSING_EXPORT]:
      'Required export is missing from this file.',
    [ErrorCategory.CIRCULAR_DEPENDENCY]:
      'Circular dependency detected between modules.',
    [ErrorCategory.SQL_INJECTION_RISK]:
      'SQL injection vulnerability detected. Use parameterized queries.',
    [ErrorCategory.MISSING_ENVIRONMENT_VAR]:
      'Environment variable is undefined or not set.',
    [ErrorCategory.SYNTAXERROR]:
      'Syntax error. Check brackets, quotes, semicolons.',
    [ErrorCategory.UNKNOWN]:
      'Unknown error. Manual review needed.',
  };

  return causes[category] || 'Unknown error';
}

/**
 * Classify multiple violations at once
 */
export function classifyViolations(
  violations: { filePath: string; code: string; message: string; line?: number }[],
  retryCount: number
): ValidationError[] {
  return violations.map(v =>
    classifyError(
      { file: v.filePath, message: `${v.code}: ${v.message}`, line: v.line },
      retryCount
    )
  );
}

