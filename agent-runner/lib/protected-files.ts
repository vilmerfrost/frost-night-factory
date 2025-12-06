// =============================================================================
// PROTECTED FILES - Core contract files that AI cannot casually mutate
// =============================================================================

import path from 'path';

export const PROTECTED_FILES = [
  'src/lib/types.ts',
  'src/lib/mock-data.ts',
  'src/lib/api.ts',
  'src/lib/schemas.ts', // Zod schemas
];

/**
 * Check if a file path is protected
 */
export function isProtectedFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return PROTECTED_FILES.some(p => normalized.endsWith(p));
}

/**
 * Get the relative path for protected file checking
 */
export function normalizePath(filePath: string, projectRoot: string): string {
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  const rootNormalized = path.normalize(projectRoot).replace(/\\/g, '/');
  
  if (normalized.startsWith(rootNormalized)) {
    return normalized.substring(rootNormalized.length).replace(/^\//, '');
  }
  
  return normalized;
}

