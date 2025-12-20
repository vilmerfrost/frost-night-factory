// =============================================================================
// AI PROMPT ENGINEERING - Enhanced prompts with type registry
// =============================================================================

import { getTypeRegistryPrompt, TYPE_REGISTRY } from './type-registry';
import { getExpectedExports } from './completionValidator';

/**
 * Build enhanced coder prompt with type registry
 */
export function buildCoderPrompt(
  fileToGenerate: string,
  context: {
    requirements?: string;
    existingFiles?: string[];
    techStack?: string[];
  }
): string {
  const typeRegistry = getTypeRegistryPrompt();
  
  return `
You are an expert TypeScript developer generating production-quality code.

TARGET FILE: ${fileToGenerate}

${context.requirements ? `REQUIREMENTS:\n${context.requirements}\n` : ''}

CRITICAL RULES (NEVER BREAK THESE):

1. ✅ ALWAYS import types at the top of the file
2. ✅ Use "import type { X } from './types'" for type-only imports
3. ✅ Never use 'any' type - use proper types or 'unknown' with type guards
4. ✅ Every function must have return types
5. ✅ All imports must resolve to existing files
6. ✅ Ensure template literals are complete (no missing closing backticks)
7. ✅ Ensure all brackets, parentheses, and braces are properly closed
8. ✅ Use @/ aliases for internal imports (not relative paths like ../)

AVAILABLE TYPES (you MUST import these when used):

${typeRegistry}

EXAMPLE (CORRECT):

\`\`\`typescript
import type { Invoice } from './types';  // ← ALWAYS IMPORT FIRST
import type { ApiResponse } from './types';

export async function uploadInvoice(file: File): Promise<ApiResponse<Invoice>> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(\`\${process.env.NEXT_PUBLIC_API_URL}/invoice/extract\`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(\`Upload failed: \${response.statusText}\`);
  }
  
  return await response.json();
}
\`\`\`

EXAMPLE (WRONG - will fail validation):

\`\`\`typescript
// ❌ Missing import!
export async function uploadInvoice(file: File): Promise<Invoice> {
  // This will fail because Invoice is not imported
}
\`\`\`

${context.existingFiles ? `EXISTING FILES IN PROJECT:\n${context.existingFiles.map(f => `- ${f}`).join('\n')}\n` : ''}

${context.techStack ? `TECH STACK:\n${context.techStack.map(t => `- ${t}`).join('\n')}\n` : ''}

Now generate ${fileToGenerate} following ALL the rules above.
`;

}

/**
 * Build fix prompt with type registry
 */
export function buildFixPrompt(
  errorMessage: string,
  targetFile: string,
  codeContext: string,
  fullFileContent: string
): string {
  const typeRegistry = getTypeRegistryPrompt();
  
  return `
You are fixing a TypeScript syntax/code error.

FILE: ${targetFile}
ERROR: ${errorMessage}

CODE CONTEXT (around error line):
\`\`\`typescript
${codeContext}
\`\`\`

FULL FILE CONTENT:
\`\`\`typescript
${fullFileContent}
\`\`\`

AVAILABLE TYPES (import these when used):

${typeRegistry}

CRITICAL RULES:
1. Look at the CODE CONTEXT section - the line marked with ">>>" is where the error occurs
2. Fix ONLY the error, don't change unrelated code
3. Ensure template literals are complete (no missing closing backticks)
4. Ensure all brackets, parentheses, and braces are properly closed
5. Import missing types from the registry above
6. Use @/ aliases for internal imports
7. Never use 'any' type

Return the COMPLETE fixed file content.
`;

}

/**
 * Build scaffold prompt with type registry
 */
export function buildScaffoldPrompt(
  projectStructure: string,
  techStack: string[]
): string {
  const typeRegistry = getTypeRegistryPrompt();
  
  return `
You are generating the initial project scaffold.

PROJECT STRUCTURE:
${projectStructure}

TECH STACK:
${techStack.map(t => `- ${t}`).join('\n')}

AVAILABLE TYPES (reference these in generated code):

${typeRegistry}

RULES:
1. Create all files in the structure above
2. Import types from './types' when using domain types
3. Use proper TypeScript types (no 'any')
4. Include 'use client' directive in React components that use hooks
5. Use @/ aliases for internal imports

Generate the complete scaffold.
`;

}

/**
 * Completeness rules for code generation
 * Prevents stub/TODO code from being generated
 */
export const CODER_COMPLETENESS_RULES = `
CRITICAL: GENERATE COMPLETE, PRODUCTION-READY CODE

❌ DO NOT generate:
- TODO comments
- Stub implementations
- Empty functions
- Placeholder comments like "Pending implementation"
- Export statements without actual code

✅ DO generate:
- Complete, working implementations
- All required exports fully implemented
- Actual business logic
- Full TypeScript types
- For UI components: complete JSX markup
- Error handling where appropriate
- Comments explaining complex logic (not TODOs)

VALIDATION: Your code will be checked for:
1. No TODO/stub markers
2. Sufficient code length (300+ chars for UI, 150+ for others)
3. Actual logic (returns, conditionals, assignments)
4. All required exports present
5. JSX elements for components

If code is incomplete, you will be asked to regenerate.
Generate COMPLETE, PRODUCTION-READY code on first attempt.
`;

/**
 * Get enhanced coder prompt with completeness rules
 */
export function getCoderPrompt(
  file: { path: string; type?: string; description?: string },
  context?: {
    requirements?: string;
    existingFiles?: string[];
    techStack?: string[];
  }
): string {
  const basePrompt = buildCoderPrompt(file.path, context || {});
  const expectedExports = getExpectedExports(file.path);
  
  return `
${basePrompt}

${CODER_COMPLETENESS_RULES}

Required exports for ${file.path}:
${expectedExports.length > 0 ? expectedExports.map(e => `- ${e}`).join('\n') : '- (generate appropriate exports)'}

Generate COMPLETE implementation now:
  `.trim();
}


