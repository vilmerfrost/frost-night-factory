// =============================================================================
// ERROR TELEMETRY - Learn from errors to improve future generations
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { ErrorCategory } from './errorClassifier';

/**
 * Error pattern entry
 */
export interface ErrorPattern {
  id: string;
  pattern: string;           // The error pattern/signature
  category: ErrorCategory;
  occurrences: number;       // How many times this has occurred
  lastSeen: Date;
  fix: string;               // How to fix it
  rootCause: string;         // Why it happens
  preventionPrompt: string;  // What to add to prompts to prevent it
  autoFixable: boolean;      // Can this be auto-fixed?
}

/**
 * Telemetry database path
 */
const TELEMETRY_PATH = './knowledge/error-patterns.json';

/**
 * Known error patterns (pre-populated)
 */
const KNOWN_PATTERNS: ErrorPattern[] = [
  {
    id: 'tailwind-version-hallucination',
    pattern: 'tailwindcss@^3.5',
    category: ErrorCategory.DEPENDENCY_VERSION,
    occurrences: 0,
    lastSeen: new Date(),
    fix: 'Replace with tailwindcss@^3.4.15',
    rootCause: 'AI hallucinated non-existent version',
    preventionPrompt: 'NEVER use tailwindcss version higher than 3.4.x',
    autoFixable: true,
  },
  {
    id: 'next-version-hallucination',
    pattern: 'next@15|next@16',
    category: ErrorCategory.DEPENDENCY_VERSION,
    occurrences: 0,
    lastSeen: new Date(),
    fix: 'Replace with next@14.2.18',
    rootCause: 'AI hallucinated unstable Next.js version',
    preventionPrompt: 'Use Next.js 14.2.18 (stable Golden Stack)',
    autoFixable: true,
  },
  {
    id: 'default-export-error',
    pattern: 'TS2613.*has no default export',
    category: ErrorCategory.EXPORT_ERROR,
    occurrences: 0,
    lastSeen: new Date(),
    fix: 'Change to named import: import { X } from instead of import X from',
    rootCause: 'Component uses named export but import expects default',
    preventionPrompt: 'Use named exports for all components except page.tsx/layout.tsx',
    autoFixable: true,
  },
  {
    id: 'react-version-hallucination',
    pattern: 'react@19|react@^19',
    category: ErrorCategory.DEPENDENCY_VERSION,
    occurrences: 0,
    lastSeen: new Date(),
    fix: 'Replace with react@18.2.0',
    rootCause: 'AI hallucinated React 19 which is not stable',
    preventionPrompt: 'Use React 18.2.0 (stable)',
    autoFixable: true,
  },
  {
    id: 'missing-export-member',
    pattern: 'TS2305.*has no exported member',
    category: ErrorCategory.IMPORT_ERROR,
    occurrences: 0,
    lastSeen: new Date(),
    fix: 'Add the missing export to the source file or remove the import',
    rootCause: 'Importing a member that does not exist in the module',
    preventionPrompt: 'Verify all exports exist before importing',
    autoFixable: true,
  },
  {
    id: 'implicit-any',
    pattern: 'TS7006.*implicitly has an',
    category: ErrorCategory.TYPE_ERROR,
    occurrences: 0,
    lastSeen: new Date(),
    fix: 'Add explicit type annotation',
    rootCause: 'TypeScript strict mode requires explicit types',
    preventionPrompt: 'Always add type annotations to function parameters',
    autoFixable: true,
  },
  {
    id: 'projectRoot-config',
    pattern: 'Unrecognized key.*projectRoot',
    category: ErrorCategory.CONFIG_ERROR,
    occurrences: 0,
    lastSeen: new Date(),
    fix: 'Remove projectRoot from next.config.mjs',
    rootCause: 'projectRoot is not a valid Next.js config option',
    preventionPrompt: 'Do NOT use projectRoot in next.config.mjs',
    autoFixable: true,
  },
  {
    id: 'src-app-structure',
    pattern: 'Cannot find module.*src/app',
    category: ErrorCategory.CONFIG_ERROR,
    occurrences: 0,
    lastSeen: new Date(),
    fix: 'Move files from src/app/ to app/ (Golden Stack uses root structure)',
    rootCause: 'Golden Stack uses app/ in root, not src/app/',
    preventionPrompt: 'Use app/ in root directory, NOT src/app/',
    autoFixable: true,
  },
];

/**
 * Load error patterns from disk
 */
export function loadErrorPatterns(): ErrorPattern[] {
  try {
    if (fs.existsSync(TELEMETRY_PATH)) {
      const data = fs.readFileSync(TELEMETRY_PATH, 'utf-8');
      const patterns = JSON.parse(data);
      // Merge with known patterns
      return mergePatterns(KNOWN_PATTERNS, patterns);
    }
  } catch (e) {
    console.warn('⚠️ Could not load error patterns:', e);
  }
  return KNOWN_PATTERNS;
}

/**
 * Save error patterns to disk
 */
export function saveErrorPatterns(patterns: ErrorPattern[]): void {
  try {
    const dir = path.dirname(TELEMETRY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TELEMETRY_PATH, JSON.stringify(patterns, null, 2));
  } catch (e) {
    console.warn('⚠️ Could not save error patterns:', e);
  }
}

/**
 * Merge patterns, preferring newer data
 */
function mergePatterns(known: ErrorPattern[], loaded: ErrorPattern[]): ErrorPattern[] {
  const merged = new Map<string, ErrorPattern>();
  
  // Add known patterns first
  for (const p of known) {
    merged.set(p.id, p);
  }
  
  // Merge with loaded patterns (update occurrences)
  for (const p of loaded) {
    if (merged.has(p.id)) {
      const existing = merged.get(p.id)!;
      existing.occurrences = Math.max(existing.occurrences, p.occurrences);
      existing.lastSeen = new Date(Math.max(
        new Date(existing.lastSeen).getTime(),
        new Date(p.lastSeen).getTime()
      ));
    } else {
      merged.set(p.id, p);
    }
  }
  
  return Array.from(merged.values());
}

/**
 * Record an error occurrence
 */
export function recordErrorOccurrence(error: string, category: ErrorCategory, fix?: string): void {
  const patterns = loadErrorPatterns();
  
  // Find matching pattern
  const matchingPattern = patterns.find(p => {
    const regex = new RegExp(p.pattern, 'i');
    return regex.test(error);
  });
  
  if (matchingPattern) {
    matchingPattern.occurrences++;
    matchingPattern.lastSeen = new Date();
    if (fix) {
      matchingPattern.fix = fix;
    }
  } else {
    // Create new pattern
    const newPattern: ErrorPattern = {
      id: `auto-${Date.now()}`,
      pattern: error.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '.'),
      category,
      occurrences: 1,
      lastSeen: new Date(),
      fix: fix || 'Unknown',
      rootCause: 'Auto-detected pattern',
      preventionPrompt: 'Avoid this error pattern',
      autoFixable: false,
    };
    patterns.push(newPattern);
  }
  
  saveErrorPatterns(patterns);
}

/**
 * Generate prevention prompt based on common errors
 */
export function generatePreventionPrompt(minOccurrences: number = 2): string {
  const patterns = loadErrorPatterns();
  
  const commonErrors = patterns
    .filter(p => p.occurrences >= minOccurrences)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);
  
  if (commonErrors.length === 0) {
    return '';
  }
  
  let prompt = `\nKNOWN ISSUES TO AVOID (Based on ${commonErrors.reduce((sum, p) => sum + p.occurrences, 0)} previous errors):\n`;
  
  for (const error of commonErrors) {
    prompt += `- ${error.preventionPrompt} (${error.occurrences}x seen)\n`;
  }
  
  return prompt;
}

/**
 * Get auto-fix suggestion for an error
 */
export function getAutoFixSuggestion(error: string): { canFix: boolean; fix?: string; pattern?: ErrorPattern } {
  const patterns = loadErrorPatterns();
  
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.pattern, 'i');
    if (regex.test(error)) {
      return {
        canFix: pattern.autoFixable,
        fix: pattern.fix,
        pattern,
      };
    }
  }
  
  return { canFix: false };
}

/**
 * Get statistics about error patterns
 */
export function getErrorStats(): {
  totalPatterns: number;
  totalOccurrences: number;
  topErrors: Array<{ id: string; occurrences: number; fix: string }>;
  byCategory: Record<string, number>;
} {
  const patterns = loadErrorPatterns();
  
  const byCategory: Record<string, number> = {};
  for (const p of patterns) {
    byCategory[p.category] = (byCategory[p.category] || 0) + p.occurrences;
  }
  
  return {
    totalPatterns: patterns.length,
    totalOccurrences: patterns.reduce((sum, p) => sum + p.occurrences, 0),
    topErrors: patterns
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5)
      .map(p => ({ id: p.id, occurrences: p.occurrences, fix: p.fix })),
    byCategory,
  };
}

