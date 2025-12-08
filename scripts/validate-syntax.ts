// =============================================================================
// SYNTAX VALIDATOR - Pre-commit validation for all TypeScript files
// =============================================================================
// Run: npm run validate-syntax

import * as fs from 'fs/promises';
import * as path from 'path';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  fileCount: number;
  errorCount: number;
}

/**
 * Validate all TypeScript files in a directory
 */
async function validateAllFiles(dir: string): Promise<ValidationResult> {
  const errors: string[] = [];
  let fileCount = 0;
  
  // Dynamic import of TypeScript
  let ts: typeof import('typescript');
  try {
    ts = await import('typescript');
  } catch {
    console.error('❌ TypeScript not installed. Run: npm install typescript');
    return { valid: false, errors: ['TypeScript not installed'], fileCount: 0, errorCount: 1 };
  }
  
  const files = await getAllTsFiles(dir);
  console.log(`🔍 Validating ${files.length} TypeScript files...`);
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      fileCount++;
      
      // Create source file and check for parse errors
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
      );
      
      // Check for syntax errors via diagnostics
      const diagnostics = (sourceFile as any).parseDiagnostics || [];
      
      for (const diag of diagnostics) {
        const line = sourceFile.getLineAndCharacterOfPosition(diag.start || 0).line + 1;
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        errors.push(`${file}:${line}: ${message}`);
      }
      
      // Additional checks
      const additionalErrors = await checkAdditionalIssues(content, file);
      errors.push(...additionalErrors);
      
    } catch (err: any) {
      errors.push(`${file}: Failed to parse - ${err.message}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    fileCount,
    errorCount: errors.length,
  };
}

/**
 * Check for additional common issues
 */
async function checkAdditionalIssues(content: string, file: string): Promise<string[]> {
  const errors: string[] = [];
  const lines = content.split('\n');
  
  // Check for unbalanced brackets
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`${file}: Unbalanced braces (${openBraces} open, ${closeBraces} close)`);
  }
  
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`${file}: Unbalanced parentheses (${openParens} open, ${closeParens} close)`);
  }
  
  // Check for incomplete template literals
  const backticks = (content.match(/`/g) || []).length;
  if (backticks % 2 !== 0) {
    errors.push(`${file}: Incomplete template literal (odd number of backticks)`);
  }
  
  // Check for common AI mistakes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // interface X = ... (should be type X = ...)
    if (line.match(/interface\s+\w+\s*=/)) {
      errors.push(`${file}:${lineNum}: Invalid syntax - use 'type' instead of 'interface' for type aliases`);
    }
    
    // Double semicolons
    if (line.includes(';;')) {
      errors.push(`${file}:${lineNum}: Double semicolon detected`);
    }
    
    // Missing closing quote
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    const templateStart = (line.match(/`[^`]*$/g) || []).length;
    
    if (!line.includes('//') && !line.includes('/*')) {
      if (singleQuotes % 2 !== 0 && !templateStart) {
        errors.push(`${file}:${lineNum}: Possible unclosed string (odd number of single quotes)`);
      }
      if (doubleQuotes % 2 !== 0 && !templateStart) {
        errors.push(`${file}:${lineNum}: Possible unclosed string (odd number of double quotes)`);
      }
    }
  }
  
  return errors;
}

/**
 * Get all TypeScript files recursively
 */
async function getAllTsFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip directories
      if (entry.isDirectory()) {
        // Skip common non-source directories
        if (['node_modules', '.next', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) {
          continue;
        }
        files.push(...await getAllTsFiles(fullPath));
      } else if (
        entry.isFile() && 
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.d.ts')
      ) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Directory might not exist, skip
  }
  
  return files;
}

/**
 * Main entry point
 */
async function main() {
  const targetDir = process.argv[2] || '.';
  
  console.log('🔬 Syntax Validator');
  console.log('==================\n');
  console.log(`Target: ${path.resolve(targetDir)}\n`);
  
  const result = await validateAllFiles(targetDir);
  
  console.log('\n--- Results ---');
  console.log(`Files checked: ${result.fileCount}`);
  console.log(`Errors found: ${result.errorCount}`);
  
  if (!result.valid) {
    console.log('\n❌ Syntax errors found:\n');
    for (const error of result.errors) {
      console.log(`  ${error}`);
    }
    process.exit(1);
  }
  
  console.log('\n✅ All files have valid syntax!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

export { validateAllFiles, checkAdditionalIssues };

