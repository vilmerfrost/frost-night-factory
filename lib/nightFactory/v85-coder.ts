// =============================================================================
// FROST NIGHT FACTORY v8.5 - CODER PHASE
// =============================================================================
// Enhanced coder with constraint-aware system prompts

import { FileTypeConstraints, ProjectBlueprint, DEFAULT_FILE_TYPE_CONSTRAINTS } from './v85-types';
import { getFileConstraints } from './v85-planner';

/**
 * Generate constraint-aware system prompt for coder
 */
export function generateCoderSystemPrompt(constraints: FileTypeConstraints): string {
  return `
You are an expert TypeScript + Next.js 15 code generator.

ABSOLUTE RULES - VIOLATION = CODE REJECTION:

═══════════════════════════════════════════════════════════════════════════════
1. API ROUTES (${constraints.api_routes.extension} files in ${constraints.api_routes.location})
═══════════════════════════════════════════════════════════════════════════════

MUST:
- Be pure async functions
- Export only GET, POST, PUT, DELETE, PATCH, OPTIONS
- Have NextRequest parameter
- Return NextResponse

MUST NOT:
- Import React
- Use JSX syntax (<tags>)
- Have default exports
- Have client-side code

EXAMPLE:
${constraints.api_routes.example}

═══════════════════════════════════════════════════════════════════════════════
2. COMPONENTS (${constraints.components.extension} files)
═══════════════════════════════════════════════════════════════════════════════

MUST:
- Use .tsx extension
- Import React if using hooks
- Return JSX
- Use 'use client' directive for client components

MUST NOT:
- Have server-side database calls (use Server Components or API routes)
- Mix server and client code

EXAMPLE:
${constraints.components.example}

═══════════════════════════════════════════════════════════════════════════════
3. UTILITIES (${constraints.utilities.extension} files)
═══════════════════════════════════════════════════════════════════════════════

MUST:
- Be pure functions
- Have proper TypeScript types
- Not import React
- Not use JSX

EXAMPLE:
${constraints.utilities.example}

═══════════════════════════════════════════════════════════════════════════════
VERIFICATION BEFORE RETURNING CODE:
═══════════════════════════════════════════════════════════════════════════════

For EACH file:
  1. Check path → determine type (API, Component, Utility)
  2. Check extension matches required type
  3. Verify ALL rules are followed
  4. If ANY check fails, REGENERATE or ALERT

LAZY CODE IS FORBIDDEN:
- No "return null" - render proper fallback UI
- No ": any" types - use proper TypeScript types
- No "// TODO" comments - implement fully
- No empty function bodies - write complete implementations

If you cannot generate code following these rules, respond with:
ERROR_CONSTRAINT_VIOLATION: [reason]
  `;
}

/**
 * Generate file-specific prompt with constraints
 */
export function generateFilePrompt(
  blueprint: ProjectBlueprint,
  filePath: string,
  description: string
): string {
  const fileConstraints = getFileConstraints(blueprint, filePath);
  
  if (!fileConstraints) {
    return `Generate the file: ${filePath}\n\nDescription: ${description}`;
  }
  
  const rulesText = fileConstraints.rules.join('\n  - ');
  const constraintsText = fileConstraints.constraints.join('\n  - ');
  
  return `
Generate the file: ${filePath}

FILE TYPE: ${fileConstraints.kind}
EXTENSION: ${fileConstraints.extension}

RULES (MUST FOLLOW):
  - ${rulesText}

SPECIFIC CONSTRAINTS:
  - ${constraintsText}

DESCRIPTION:
${description}

Output ONLY the complete file content. No explanations, no markdown code blocks.
  `;
}

/**
 * Generate prompt for API route
 */
export function generateApiRoutePrompt(
  filePath: string,
  description: string,
  methods: string[] = ['GET', 'POST']
): string {
  const methodsText = methods.join(', ');
  
  return `
Generate an API route at: ${filePath}

CRITICAL RULES FOR API ROUTES:
1. Use .ts extension ONLY (no .tsx)
2. NO React imports
3. NO JSX syntax
4. Export async functions: ${methodsText}
5. Use NextRequest and NextResponse from 'next/server'

DESCRIPTION:
${description}

REQUIRED EXPORTS: ${methodsText}

TEMPLATE:
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Implementation here
    return NextResponse.json({ data: [] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

${methods.includes('POST') ? `
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Implementation here
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}` : ''}

Output ONLY the complete file content.
  `;
}

/**
 * Generate prompt for React component
 */
export function generateComponentPrompt(
  filePath: string,
  description: string,
  isClientComponent: boolean = true
): string {
  return `
Generate a React component at: ${filePath}

FILE TYPE: Component (.tsx)

${isClientComponent ? `'use client' REQUIRED at top of file` : 'This is a Server Component'}

DESCRIPTION:
${description}

RULES:
1. Use .tsx extension
2. ${isClientComponent ? "Add 'use client' directive" : 'No use client directive'}
3. Use TypeScript interfaces for props
4. Use Tailwind CSS for styling
5. No "return null" - render proper UI
6. No "any" types

TEMPLATE:
${isClientComponent ? "'use client';\n\n" : ''}import React from 'react';

interface Props {
  // Define props here
}

export default function ComponentName({ }: Props) {
  return (
    <div className="p-4">
      {/* Implement UI here */}
    </div>
  );
}

Output ONLY the complete file content.
  `;
}

/**
 * Generate prompt for utility file
 */
export function generateUtilityPrompt(
  filePath: string,
  description: string,
  functionNames: string[] = []
): string {
  const functionsText = functionNames.length > 0 
    ? `REQUIRED FUNCTIONS: ${functionNames.join(', ')}`
    : '';
  
  return `
Generate a utility file at: ${filePath}

FILE TYPE: Utility (.ts)

CRITICAL RULES:
1. Use .ts extension ONLY (no .tsx)
2. NO React imports
3. NO JSX syntax
4. Pure functions only
5. Full TypeScript types

${functionsText}

DESCRIPTION:
${description}

TEMPLATE:
/**
 * Utility description
 */
export function functionName(param: ParamType): ReturnType {
  // Implementation
}

Output ONLY the complete file content.
  `;
}

/**
 * Post-process generated code to ensure compliance
 */
export function postProcessCode(
  code: string,
  filePath: string,
  constraints: FileTypeConstraints
): { code: string; warnings: string[] } {
  const warnings: string[] = [];
  let processedCode = code;
  
  const isApiRoute = filePath.includes('/api/') && filePath.endsWith('.ts');
  const isTsFile = filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
  const isTsxFile = filePath.endsWith('.tsx');
  
  // Check for React imports in API routes
  if (isApiRoute && /import.*from\s+['"]react['"]/.test(processedCode)) {
    warnings.push('API route contains React import - should be removed');
  }
  
  // Check for JSX in .ts files
  if (isTsFile && /<[A-Z][a-z]+|<\/>/.test(processedCode)) {
    warnings.push('.ts file appears to contain JSX - should be .tsx or JSX removed');
  }
  
  // Check for lazy patterns
  if (/return\s+null\s*;/.test(processedCode)) {
    warnings.push('Found "return null" - should render fallback UI');
  }
  
  if (/:\s*any(?:\s|;|,|\))/.test(processedCode)) {
    warnings.push('Found "any" type - should use proper TypeScript type');
  }
  
  if (/\/\/\s*TODO/i.test(processedCode)) {
    warnings.push('Found TODO comment - should be implemented');
  }
  
  return { code: processedCode, warnings };
}

/**
 * Get default constraints
 */
export function getDefaultConstraints(): FileTypeConstraints {
  return DEFAULT_FILE_TYPE_CONSTRAINTS;
}

