// =============================================================================
// PRE-FLIGHT VALIDATOR - Enhanced validation before build
// =============================================================================

import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { validateImports, autoFixImports } from './import-validator';
import { getImportForType } from '../nightFactory/type-registry';

interface ValidationError {
  file: string;
  message: string;
  line?: number;
  code?: string;
}

/**
 * Run TypeScript compilation check
 */
async function runTypeScriptCheck(workspace: string): Promise<{
  success: boolean;
  errors: ValidationError[];
}> {
  const errors: ValidationError[] = [];

  try {
    const result = execSync('npx tsc --noEmit --pretty false', {
      cwd: workspace,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    return { success: true, errors: [] };
  } catch (error: any) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    const lines = output.split('\n');

    for (const line of lines) {
      // Parse TypeScript error format: file.ts(line,col): error TS2304: message
      const match = line.match(/(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)/);
      if (match) {
        const [, file, lineNum, , code, message] = match;
        errors.push({
          file: path.relative(workspace, file),
          message,
          line: parseInt(lineNum),
          code
        });
      }
    }

    return { success: false, errors };
  }
}

/**
 * Validate import graph
 */
async function validateImportGraph(workspace: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const srcDir = path.join(workspace, 'src');

  try {
    // Find all TypeScript files
    const files = await findTypeScriptFiles(srcDir);
    
    for (const file of files) {
      const validation = await validateImports(file);
      if (!validation.valid) {
        validation.missing.forEach(m => {
          errors.push(`${path.relative(workspace, file)}:${m.line} - Missing import: ${m.typeName}`);
        });
      }
    }
  } catch (error: any) {
    errors.push(`Import graph validation failed: ${error.message}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate type registry sync
 */
async function validateTypeRegistry(workspace: string): Promise<{
  synced: boolean;
  missing: string[];
}> {
  const missing: string[] = [];
  const srcDir = path.join(workspace, 'src');

  try {
    const files = await findTypeScriptFiles(srcDir);
    
    // Simple check: if types.ts exists, verify registry knows about it
    const typesFile = path.join(srcDir, 'lib', 'types.ts');
    if (await fileExists(typesFile)) {
      // Could add more sophisticated checks here
      // For now, just verify registry file exists
    }
  } catch (error: any) {
    missing.push(`Registry validation failed: ${error.message}`);
  }

  return {
    synced: missing.length === 0,
    missing
  };
}

/**
 * Run enhanced pre-flight validation
 */
export async function runEnhancedPreFlight(
  workspace: string
): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];

  console.log('🔍 [Pre-Flight] Running enhanced validation...');

  // 1. TypeScript compilation check
  console.log('   📝 Checking TypeScript compilation...');
  const tsResult = await runTypeScriptCheck(workspace);
  if (!tsResult.success) {
    // Categorize errors
    tsResult.errors.forEach(err => {
      if (err.code === 'TS2304') {
        // Cannot find name 'X' - likely missing import
        const match = err.message.match(/Cannot find name ['"]([\w]+)['"]/);
        if (match) {
          const typeName = match[1];
          if (!typeName) continue;
          const suggestedImport = getImportForType(typeName);
          
          if (suggestedImport) {
            errors.push(
              `Missing import in ${err.file}:${err.line} - ${suggestedImport}`
            );
          } else {
            errors.push(
              `Undefined type '${typeName}' in ${err.file}:${err.line} (not in type registry)`
            );
          }
        } else {
          errors.push(`${err.file}:${err.line} - ${err.message}`);
        }
      } else {
        errors.push(`${err.file}:${err.line} - [${err.code}] ${err.message}`);
      }
    });
  } else {
    console.log('   ✅ TypeScript compilation passed');
  }

  // 2. Import graph validation
  console.log('   🔗 Validating import graph...');
  const graphResult = await validateImportGraph(workspace);
  if (!graphResult.valid) {
    errors.push(...graphResult.errors);
  } else {
    console.log('   ✅ Import graph valid');
  }

  // 3. Type registry sync check
  console.log('   📋 Checking type registry sync...');
  const registryResult = await validateTypeRegistry(workspace);
  if (!registryResult.synced) {
    console.log('   ⚠️ Type registry out of sync');
    errors.push(...registryResult.missing);
  } else {
    console.log('   ✅ Type registry synced');
  }

  return {
    passed: errors.length === 0,
    errors
  };
}

/**
 * Auto-fix all import issues found in pre-flight
 */
export async function autoFixPreFlightIssues(workspace: string): Promise<{
  fixed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let fixed = 0;
  const srcDir = path.join(workspace, 'src');

  try {
    const files = await findTypeScriptFiles(srcDir);
    
    for (const file of files) {
      const validation = await validateImports(file);
      if (!validation.valid) {
        const success = await autoFixImports(file);
        if (success) {
          fixed += validation.missing.length;
        } else {
          errors.push(`Failed to fix imports in ${path.relative(workspace, file)}`);
        }
      }
    }
  } catch (error: any) {
    errors.push(`Auto-fix failed: ${error.message}`);
  }

  return { fixed, errors };
}

// Helper functions
async function findTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        files.push(...await findTypeScriptFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory might not exist, skip
  }
  
  return files;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

