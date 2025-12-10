// agent-runner/code-validator.ts

import * as fs from 'fs'
import * as path from 'path'
import { validateCodeCompleteness } from './ast-validator'
import { validateCode as validateCodeLenient, type ValidationResult as LenientValidationResult } from './lib/validator'

// ═══════════════════════════════════════════════════════════════════
// LAYER 1: ANTI-PLACEHOLDER SCANNER
// ═══════════════════════════════════════════════════════════════════

const FORBIDDEN_PATTERNS = [
  // Placeholder comments
  { pattern: /\/\/\s*TODO:/gi, message: 'TODO comment detected' },
  { pattern: /\/\/\s*FIXME:/gi, message: 'FIXME comment detected' },
  { pattern: /\/\/\s*XXX:/gi, message: 'XXX comment detected' },
  { pattern: /\/\/\s*HACK:/gi, message: 'HACK comment detected' },
  { pattern: /\/\/\s*implement/gi, message: 'Placeholder "implement" comment' },
  { pattern: /\/\/\s*add\s+(logic|code)\s+here/gi, message: 'Placeholder instruction' },
  
  // Lazy returns
  { pattern: /return\s+\[\s*\]\s*;/g, message: 'Empty array return' },
  { pattern: /return\s+\{\s*\}\s*;/g, message: 'Empty object return' },
  // Note: return null is checked separately with context awareness (see detectPlaceholderCode)
  { pattern: /return\s+undefined\s*;/g, message: 'Undefined return (placeholder)' },
  
  // Mock/placeholder data
  { pattern: /\/\*\s*mock\s+data\s*\*\//gi, message: 'Mock data comment' },
  { pattern: /\/\*\s*placeholder\s*\*\//gi, message: 'Placeholder comment' },
  { pattern: /Promise\.resolve\(\s*\{\s*\/\*.*?\*\/\s*\}\s*\)/g, message: 'Promise with placeholder object' },
  { pattern: /Promise\.resolve\(\s*\[\s*\]\s*\)/g, message: 'Promise with empty array' },
  
  // String placeholders
  { pattern: /'mocked_\w+'/g, message: 'Mocked string placeholder' },
  { pattern: /"mocked_\w+"/g, message: 'Mocked string placeholder' },
  { pattern: /'placeholder'/gi, message: 'Placeholder string' },
  { pattern: /"placeholder"/gi, message: 'Placeholder string' },
]

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  renamedPath?: string  // 🔧 Extension Enforcer: Signal to rename .ts -> .tsx
}

export function detectPlaceholderCode(code: string, fileName: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    const matches = code.match(pattern)
    if (matches) {
      errors.push(`[${fileName}] PLACEHOLDER DETECTED: ${message} (found: "${matches[0]}")`)
    }
  }
  
  // ✅ CONTEXT-AWARE: Check for "return null" with context awareness
  if (code.includes('return null')) {
    // Allow "return null" in:
    // - Conditional returns: if (!mounted) return null;
    // - Error states: if (error) return null;
    // - Loading states: if (loading) return null;
    const isConditional = /if\s*\([^)]+\)\s*return\s+null/g.test(code)
    const hasOtherReturns = (code.match(/return\s+</g) || []).length > 0 || // JSX returns
                            (code.match(/return\s+[^n]/g) || []).length > 0  // Other non-null returns
    
    if (!isConditional && !hasOtherReturns) {
      errors.push(`[${fileName}] PLACEHOLDER DETECTED: Null return (likely placeholder)`)
    }
  }
  
  // Check for empty function bodies
  const emptyFunctionPattern = /(?:function\s+\w+|(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)\s*\{\s*\}/g
  const emptyMatches = code.match(emptyFunctionPattern)
  if (emptyMatches) {
    errors.push(`[${fileName}] Empty function body detected: ${emptyMatches[0].slice(0, 50)}...`)
  }
  
  // Check for 'any' type (warning, not error)
  const anyTypePattern = /:\s*any\b/g
  const anyMatches = code.match(anyTypePattern)
  if (anyMatches) {
    warnings.push(`[${fileName}] 'any' type used ${anyMatches.length} times`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 2: FILE EXTENSION ENFORCER
// ═══════════════════════════════════════════════════════════════════

const JSX_PATTERNS = [
  /<[A-Z][A-Za-z0-9]*[^>]*>/,     // React component tags <Component>
  /<[a-z]+[^>]*>/,                 // HTML tags <div>
  /<\/[A-Za-z]+>/,                 // Closing tags </div>
  /<[A-Za-z]+[^>]*\/>/,            // Self-closing tags <img />
]

export function validateFileExtension(code: string, fileName: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Only check .ts files (not .tsx)
  if (fileName.endsWith('.ts') && !fileName.endsWith('.d.ts')) {
    for (const pattern of JSX_PATTERNS) {
      if (pattern.test(code)) {
        errors.push(`[${fileName}] JSX syntax detected in .ts file. Rename to .tsx or remove JSX.`)
        break
      }
    }
  }
  
  return { valid: errors.length === 0, errors, warnings }
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 3: IMPORT VALIDATOR
// ═══════════════════════════════════════════════════════════════════

export function validateImports(
  code: string, 
  fileName: string, 
  projectRoot: string
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Find all imports
  const importPattern = /import\s+(?:type\s+)?(?:\{[^}]+\}|[^'"]+)\s+from\s+['"]([^'"]+)['"]/g
  let match
  
  while ((match = importPattern.exec(code)) !== null) {
    const importPath = match[1]
    
    // Skip node_modules imports
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
      continue
    }
    
    // Resolve import path
    let fullPath: string
    if (importPath.startsWith('@/')) {
      // Resolve @/ alias relative to project root
      const resolvedPath = importPath.replace('@/', 'src/')
      fullPath = path.resolve(projectRoot, resolvedPath)
    } else if (importPath.startsWith('.')) {
      // Resolve relative imports relative to the file, not project root
      const fileDir = path.dirname(fileName)
      fullPath = path.resolve(projectRoot, fileDir, importPath)
    } else {
      continue // Skip other imports
    }
    
    const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']
    
    let fileExists = false
    for (const ext of possibleExtensions) {
      if (fs.existsSync(fullPath + ext)) {
        fileExists = true
        break
      }
    }
    
    if (!fileExists) {
      errors.push(`[${fileName}] Import not found: '${importPath}' (resolved to: ${fullPath})`)
    }
  }
  
  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Determines if a .ts file with JSX should be renamed to .tsx
 * 
 * Rules:
 * 1. Never rename lib/ or fortress files
 * 2. Never rename API routes (route.ts in app/api/**)
 * 3. Only rename React components (app/** and components/**)
 */
async function shouldRenameTsToTsx(
  filePath: string,
  hasJsx: boolean
): Promise<boolean> {
  if (!hasJsx || !filePath.endsWith('.ts')) return false;

  const normalized = filePath.replace(/\\/g, '/');

  const isLibFile = normalized.includes('/src/lib/') || normalized.includes('/lib/');
  
  const isApiRoute =
    (normalized.includes('/src/app/api/') || normalized.includes('/app/api/')) &&
    path.basename(normalized).startsWith('route.');

  const isAppComponent =
    (normalized.includes('/src/app/') || normalized.includes('/app/')) &&
    !normalized.includes('/api/');

  const isComponentFile = 
    normalized.includes('/src/components/') || normalized.includes('/components/');

  // Try to check if file is fortress-protected (graceful fallback if fortress not available)
  let isFortress = false;
  try {
    const fortressModule = await import('../lib/nightFactory/v90-index');
    const tier = fortressModule.getFileTier?.(normalized);
    const FortressTier = fortressModule.FortressTier;
    if (FortressTier && tier !== undefined) {
      isFortress = tier === FortressTier.GOLDEN || tier === FortressTier.REGENERATE_ONLY;
    }
  } catch {
    // Fortress not available, continue without fortress check
  }

  // 1) Never rename on fortress or lib files
  if (isFortress || isLibFile) {
    return false;
  }

  // 2) Never rename API routes – these should be pure TS handlers
  if (isApiRoute) {
    return false;
  }

  // 3) Only rename on actual React components
  if (isAppComponent || isComponentFile) {
    return true;
  }

  // 4) Default: no rename
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// MASTER VALIDATOR
// ═══════════════════════════════════════════════════════════════════

export async function validateCode(
  code: string, 
  fileName: string, 
  projectRoot: string
): Promise<ValidationResult> {
  const allErrors: string[] = []
  const allWarnings: string[] = []
  
  // ═══════════════════════════════════════════════════════════════════
  // 🔧 EXTENSION ENFORCER: Detect JSX in .ts files (The "Loop Killer")
  // ═══════════════════════════════════════════════════════════════════
  const hasJSX = /<[A-Z][A-Za-z0-9]*[^>]*>/.test(code) || /<>[^<]+<\/>/.test(code) || /<\/[A-Za-z]+>/.test(code);
  const isTS = fileName.endsWith('.ts') && !fileName.endsWith('.d.ts');
  
  if (hasJSX && isTS) {
    const shouldRename = await shouldRenameTsToTsx(fileName, hasJSX);
    
    if (shouldRename) {
      const newPath = fileName + 'x'; // .ts -> .tsx
      console.log(`⚠️ [AUTO-FIX] Detected JSX in .ts file. Auto-renaming: ${fileName} -> ${newPath}`);
      
      return {
        valid: true, // PASS IT! Do not trigger a retry loop.
        errors: [],
        warnings: [`JSX detected in .ts file - auto-renaming to .tsx`],
        renamedPath: newPath // Signal the runner to change the filename
      };
    } else {
      // Log warning but don't rename
      console.warn(
        `⚠️ [AUTO-FIX] JSX detected in ${fileName}, but skipping rename (lib/fortress/api-route/other).`
      );
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // 🔧 LENIENT VALIDATION: Check for config/data files FIRST
  // ═══════════════════════════════════════════════════════════════════
  try {
    const lenientResult = await validateCodeLenient(code, fileName, { phase: 'coder' });
    
    // If it's a config/data file and lenient validator says it's valid, accept it immediately
    if (lenientResult.fileType === 'config' || lenientResult.fileType === 'data') {
      if (lenientResult.valid || !lenientResult.reason?.includes('Syntax error')) {
        console.log(`📋 ${fileName} is a config/data file - accepting despite low complexity score`);
        return {
          valid: true,
          errors: [],
          warnings: lenientResult.warnings || []
        };
      }
    }
  } catch (lenientError: any) {
    // If lenient validator fails, fall through to strict validation
    console.warn(`⚠️ Lenient validation failed, using strict validation: ${lenientError.message}`);
  }
  
  // Run all validators
  const placeholderResult = detectPlaceholderCode(code, fileName)
  const extensionResult = validateFileExtension(code, fileName)
  const importResult = validateImports(code, fileName, projectRoot)
  
  // ✅ NEW: AST-based completeness check (skip for config files)
  const isConfigFile = /\.config\.(ts|js|mjs)$/.test(fileName) || 
                       /^(next|tailwind|postcss|tsconfig|jest|vitest)\.config/.test(fileName) ||
                       /src\/lib\/(design-system|constants|config|data)\//.test(fileName) ||
                       /\/(colors|theme|constants|schema|types)\.(ts|js)$/.test(fileName);
  
  if (!isConfigFile && (fileName.endsWith('.ts') || fileName.endsWith('.tsx'))) {
    const astResult = validateCodeCompleteness(code, fileName)
    
    if (!astResult.complete) {
      allErrors.push(`[${fileName}] Incomplete implementation (score: ${astResult.score.toFixed(1)})`)
      astResult.issues.forEach(issue => allErrors.push(`   - ${issue}`))
    }
    
    if (astResult.score < 5 && astResult.score > 0) {
      allWarnings.push(`[${fileName}] Low code density: ${astResult.score.toFixed(1)} statements/function`)
    }
  }
  
  allErrors.push(...placeholderResult.errors)
  allErrors.push(...extensionResult.errors)
  allErrors.push(...importResult.errors)
  
  allWarnings.push(...placeholderResult.warnings)
  allWarnings.push(...extensionResult.warnings)
  allWarnings.push(...importResult.warnings)
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  }
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-FIX: File Extension Corrector
// ═══════════════════════════════════════════════════════════════════

export function autoFixFileExtension(code: string, fileName: string): { code: string; newFileName: string } {
  // ✅ NEVER rename type-only files
  if (
    fileName.includes('/types.ts') ||
    fileName.includes('\\types.ts') ||
    fileName.endsWith('database.ts')
  ) {
    return { code, newFileName: fileName };
  }
  
  // If .ts file has JSX, rename to .tsx
  if (fileName.endsWith('.ts') && !fileName.endsWith('.d.ts')) {
    // Only rename if ACTUAL JSX is present (not just imports)
    const hasJSX = /<[a-zA-Z][a-zA-Z0-9]*[\s>]/.test(code) ||  // <div>, <Component>
                   /<>/.test(code) ||                          // <>
                   /React\.createElement/.test(code);
    
    if (hasJSX) {
      const newFileName = fileName.replace(/\.ts$/, '.tsx')
      console.log(`🔧 Auto-fixing: Renamed ${fileName} → ${newFileName} (JSX detected)`)
      return { code, newFileName }
    }
  }
  
  return { code, newFileName: fileName }
}

