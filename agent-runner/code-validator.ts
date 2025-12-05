// agent-runner/code-validator.ts

import * as fs from 'fs'
import * as path from 'path'
import { validateCodeCompleteness } from './ast-validator'

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
  { pattern: /return\s+null\s*;/g, message: 'Null return (likely placeholder)' },
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
    
    // Resolve @/ alias
    let resolvedPath = importPath
    if (importPath.startsWith('@/')) {
      resolvedPath = importPath.replace('@/', 'src/')
    }
    
    // Check if file exists
    const fullPath = path.resolve(projectRoot, resolvedPath)
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

// ═══════════════════════════════════════════════════════════════════
// MASTER VALIDATOR
// ═══════════════════════════════════════════════════════════════════

export function validateCode(
  code: string, 
  fileName: string, 
  projectRoot: string
): ValidationResult {
  const allErrors: string[] = []
  const allWarnings: string[] = []
  
  // Run all validators
  const placeholderResult = detectPlaceholderCode(code, fileName)
  const extensionResult = validateFileExtension(code, fileName)
  const importResult = validateImports(code, fileName, projectRoot)
  
  // ✅ NEW: AST-based completeness check
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
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

