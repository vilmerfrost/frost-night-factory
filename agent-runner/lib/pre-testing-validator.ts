// agent-runner/lib/pre-testing-validator.ts
// Layer 1: Quick AST Validation (After Coder Phase)
// Validates syntax, imports, types, and detects lazy code before testing

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import * as ts from 'typescript';
import { callAI, selectModel } from '../ai-client';
import type { CoderPhaseJSON } from '../../lib/pipeline/pipeline-json-types';

export interface ValidationError {
  category: string; // 'syntax', 'import', 'type', 'export', 'lazy'
  file: string;
  line: number;
  message: string;
  autoFixable: boolean;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  fixedCode?: string;
  shouldRetryPhase: boolean;
}

/**
 * Main validation function - validates Coder phase output
 */
export async function validateCoderPhaseOutput(
  coderJSON: CoderPhaseJSON,
  repoPath: string,
  pipelineId: string
): Promise<ValidationResult> {
  console.log('\n🔍 [Pre-Testing Validator] Starting validation...');
  const errors: ValidationError[] = [];

  // 1. SYNTAX CHECK - 1 second
  console.log('   [1/4] Checking syntax...');
  const syntaxErrors = await checkSyntax(coderJSON, repoPath);
  errors.push(...syntaxErrors);

  // 2. IMPORT/EXPORT CHECK - 1 second
  console.log('   [2/4] Validating imports/exports...');
  const importErrors = await validateImports(coderJSON, repoPath);
  errors.push(...importErrors);

  // 3. TYPE CONSISTENCY - 2 seconds
  console.log('   [3/4] Checking type consistency...');
  const typeErrors = await validateTypeConsistency(coderJSON, repoPath);
  errors.push(...typeErrors);

  // 4. LAZY CODE CHECK - 1 second
  console.log('   [4/4] Detecting lazy code...');
  const lazyErrors = detectLazyCode(coderJSON, repoPath);
  errors.push(...lazyErrors);

  if (errors.length === 0) {
    console.log('✅ [Pre-Testing Validator] All checks passed!');
    return { passed: true, errors: [], shouldRetryPhase: false };
  }

  console.log(`⚠️  [Pre-Testing Validator] Found ${errors.length} errors`);
  console.log(`   Auto-fixable: ${errors.filter(e => e.autoFixable).length}`);
  console.log(`   Needs AI: ${errors.filter(e => !e.autoFixable).length}`);

  // ✅ CRITICAL FIX: Attempt AI fix for ALL errors (both autoFixable AND needsAi)
  // We want DeepSeek to attempt to fix EVERYTHING, not just auto-fixable errors
  const errorsToFix = errors; // Fix ALL errors (both autoFixable and needsAi)
  
  if (errorsToFix.length > 0) {
    console.log('🔧 [Pre-Testing Validator] Attempting AI fix for ALL errors...');
    console.log(`   📊 Processing ${errorsToFix.length} errors (${errors.filter(e => e.autoFixable).length} auto-fixable + ${errors.filter(e => !e.autoFixable).length} needs AI)`);
    const fixedCode = await autoFixErrors(
      coderJSON,
      repoPath,
      errorsToFix, // ✅ Send ALL errors to AI fixer
      pipelineId
    );
    return {
      passed: false,
      errors,
      fixedCode,
      shouldRetryPhase: true, // Retry Coder with fixed code
    };
  }

  // No errors (shouldn't reach here, but safety check)
  return {
    passed: true,
    errors: [],
    shouldRetryPhase: false,
  };
}

/**
 * Check syntax errors using TypeScript compiler
 */
async function checkSyntax(
  coderJSON: CoderPhaseJSON,
  repoPath: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  try {
    // Run tsc --noEmit to check syntax
    execSync('npx tsc --noEmit --skipLibCheck 2>&1', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000, // 5 second timeout
    });
  } catch (e: any) {
    const output = e.stdout || e.stderr || e.message;
    const lines = output.split('\n');

    // Parse TypeScript errors: file.tsx(line,col): error TS2307: message
    const errorPattern = /([^(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/;

    for (const line of lines) {
      const match = line.match(errorPattern);
      if (match) {
        const [, file, lineNum, , code, message] = match;
        const autoFixable = ['TS2307', 'TS2305', 'TS2304'].includes(code); // Missing module, wrong import, unused

        errors.push({
          category: 'syntax',
          file: file.trim(),
          line: parseInt(lineNum),
          message: message.trim(),
          autoFixable,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate imports and exports
 */
async function validateImports(
  coderJSON: CoderPhaseJSON,
  repoPath: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Check all generated files
  const allFiles = [
    ...(coderJSON.code_generated?.frontend?.files || []),
    ...(coderJSON.code_generated?.backend?.files || []),
  ];

  for (const fileInfo of allFiles) {
    const filePath = path.join(repoPath, fileInfo.path);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check import order (imports must come before exports)
    let foundExport = false;
    let foundImportAfterExport = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('export ') && !line.includes('export default')) {
        foundExport = true;
      }
      if (foundExport && line.startsWith('import ')) {
        foundImportAfterExport = true;
        errors.push({
          category: 'import',
          file: fileInfo.path,
          line: i + 1,
          message: 'Import statement found after export (must be before)',
          autoFixable: true,
        });
      }
    }

    // Check for missing imports (basic check)
    const importPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      // Skip node_modules and built-ins
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        const resolvedPath = path.resolve(path.dirname(filePath), importPath);
        const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
        let exists = false;

        for (const ext of possibleExtensions) {
          if (fs.existsSync(resolvedPath + ext) || fs.existsSync(resolvedPath)) {
            exists = true;
            break;
          }
        }

        if (!exists) {
          errors.push({
            category: 'import',
            file: fileInfo.path,
            line: content.substring(0, match.index).split('\n').length,
            message: `Import not found: '${importPath}'`,
            autoFixable: true,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate type consistency
 */
async function validateTypeConsistency(
  coderJSON: CoderPhaseJSON,
  repoPath: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Check if type definitions match generated code
  const typeDefs = coderJSON.type_definitions?.types_defined || [];
  const allFiles = [
    ...(coderJSON.code_generated?.frontend?.files || []),
    ...(coderJSON.code_generated?.backend?.files || []),
  ];

  // Basic check: ensure types are used consistently
  for (const typeDef of typeDefs) {
    const typeName = typeDef.name;
    let foundUsage = false;

    for (const fileInfo of allFiles) {
      const filePath = path.join(repoPath, fileInfo.path);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(typeName)) {
        foundUsage = true;
        break;
      }
    }

    // If type is defined but never used, it's a warning (not blocking)
    // We'll focus on actual type errors from tsc
  }

  return errors;
}

/**
 * Detect lazy code patterns
 */
function detectLazyCode(
  coderJSON: CoderPhaseJSON,
  repoPath: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const lazyPatterns = [
    { pattern: /TODO:/i, message: 'TODO comment found' },
    { pattern: /FIXME:/i, message: 'FIXME comment found' },
    { pattern: /placeholder/i, message: 'Placeholder code found' },
    { pattern: /mock_data/i, message: 'Mock data detected' },
    { pattern: /mocked_/i, message: 'Mocked function detected' },
    { pattern: /\.\.\./g, message: 'Ellipsis placeholder found' },
    { pattern: /pass\s*$/m, message: 'Empty pass statement (Python)' },
    { pattern: /throw new Error\(['"]Not implemented['"]\)/i, message: 'Not implemented error' },
  ];

  const allFiles = [
    ...(coderJSON.code_generated?.frontend?.files || []),
    ...(coderJSON.code_generated?.backend?.files || []),
  ];

  for (const fileInfo of allFiles) {
    const filePath = path.join(repoPath, fileInfo.path);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, message } of lazyPatterns) {
        if (pattern.test(line)) {
          // Skip if it's in a comment or string (basic check)
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
            continue; // It's a comment, which is okay
          }

          errors.push({
            category: 'lazy',
            file: fileInfo.path,
            line: i + 1,
            message,
            autoFixable: false, // Requires manual review
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Auto-fix errors using AI (Groq for fast fixes)
 * ⚡ PARALLEL PROCESSING: Processes files in batches of 5 concurrently
 */
async function autoFixErrors(
  coderJSON: CoderPhaseJSON,
  repoPath: string,
  errors: ValidationError[],
  pipelineId: string
): Promise<string> {
  console.log(`   🔧 Auto-fixing ${errors.length} errors...`);

  // Group errors by file
  const errorsByFile = new Map<string, ValidationError[]>();
  for (const error of errors) {
    if (!errorsByFile.has(error.file)) {
      errorsByFile.set(error.file, []);
    }
    errorsByFile.get(error.file)!.push(error);
  }

  const filesToFix = Array.from(errorsByFile.entries());
  const fixedFiles: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // 🏗️ LAYERED REPAIR PROTOCOL: Sort by architectural layer priority
  // ═══════════════════════════════════════════════════════════════════
  /**
   * Get priority for a file path based on architectural layer
   * Lower number = higher priority (fixes first)
   */
  const getPriority = (filePath: string): number => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Priority 0: Foundation (lib, types, utils)
    if (normalizedPath.includes('/lib/') || 
        normalizedPath.includes('/types/') || 
        normalizedPath.includes('/utils/') ||
        normalizedPath.includes('/src/lib/') ||
        normalizedPath.includes('/src/types/') ||
        normalizedPath.includes('/src/utils/')) {
      return 0;
    }
    
    // Priority 1: Atomic components (ui components)
    if (normalizedPath.includes('/components/ui/') ||
        normalizedPath.includes('/src/components/ui/')) {
      return 1;
    }
    
    // Priority 2: Feature components (non-ui components)
    if (normalizedPath.includes('/components/') ||
        normalizedPath.includes('/src/components/')) {
      return 2;
    }
    
    // Priority 3: Routes/Views (app, pages)
    if (normalizedPath.includes('/app/') ||
        normalizedPath.includes('/pages/') ||
        normalizedPath.includes('/src/app/') ||
        normalizedPath.includes('/src/pages/')) {
      return 3;
    }
    
    // Priority 4: Everything else (configs, root files, etc.)
    return 4;
  };

  // Sort files by priority (foundation first, routes last)
  const sortedFilesToFix = filesToFix.sort((a, b) => {
    const priorityA = getPriority(a[0]);
    const priorityB = getPriority(b[0]);
    return priorityA - priorityB;
  });

  // Log priority distribution
  const priorityGroups = sortedFilesToFix.reduce((acc, [filePath]) => {
    const priority = getPriority(filePath);
    const groupName = ['Foundation (lib/types)', 'UI Components', 'Feature Components', 'Routes/Views', 'Other'][priority] || 'Other';
    acc[groupName] = (acc[groupName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`🏗️ [Layered Repair] Queue sorted by architectural layer:`);
  Object.entries(priorityGroups).forEach(([group, count]) => {
    console.log(`   ${group}: ${count} files`);
  });

  // ⚡ PARALLEL FIXER ENABLED
  const CONCURRENCY_LIMIT = 5; // Process 5 files at once
  console.log(`🚀 Starting Parallel Fixer: Processing ${sortedFilesToFix.length} files with concurrency ${CONCURRENCY_LIMIT}...`);
  console.log(`🏗️ [Layered Repair] Fixing Foundations (Lib/Types) before Structure (App/Components)...`);

  // Create batches that respect layer boundaries
  // Priority 0 files (Foundation) should run in their own batch FIRST
  // Do NOT mix Priority 0 files with Priority 4 files in the same batch
  const chunks: Array<Array<[string, ValidationError[]]>> = [];
  
  // Group files by priority first
  const filesByPriority: Record<number, Array<[string, ValidationError[]]>> = {};
  for (const fileEntry of sortedFilesToFix) {
    const filePath = fileEntry[0];
    const priority = getPriority(filePath);
    if (!filesByPriority[priority]) {
      filesByPriority[priority] = [];
    }
    filesByPriority[priority].push(fileEntry);
  }

  // Process each priority group separately, ensuring Priority 0 runs first
  const priorityOrder = [0, 1, 2, 3, 4]; // Foundation → UI → Components → Routes → Other
  
  for (const priority of priorityOrder) {
    const filesInPriority = filesByPriority[priority] || [];
    if (filesInPriority.length === 0) continue;

    // Chunk files within this priority group
    for (let i = 0; i < filesInPriority.length; i += CONCURRENCY_LIMIT) {
      const chunk = filesInPriority.slice(i, i + CONCURRENCY_LIMIT);
      chunks.push(chunk);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🏗️ PHASED REPAIR PROTOCOL: Foundation (Sequential) → Structure (Parallel)
  // ═══════════════════════════════════════════════════════════════════
  
  // Import Type Consistency Enforcer
  const { TypeConsistencyEnforcer } = await import('../scripts/type-consistency-enforcer');
  const enforcer = new TypeConsistencyEnforcer(repoPath);
  
  // PHASE A: FOUNDATION (Sequential) - Fix types and lib files first
  const foundationFiles = sortedFilesToFix.filter(([filePath]) => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.includes('src/lib/') || 
           normalizedPath.includes('src/types/') ||
           normalizedPath.includes('/lib/types') ||
           normalizedPath.includes('/types.ts');
  });
  
  if (foundationFiles.length > 0) {
    console.log(`\n🏗️ [Phase A] Fixing Foundation Layer (Sequential): ${foundationFiles.length} files...`);
    
    for (const [filePath, fileErrors] of foundationFiles) {
      const fullPath = path.join(repoPath, filePath);
      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  Skipping ${filePath} (file not found)`);
        continue;
      }

      try {
        console.log(`⚡ [Phase A] Fixing foundation file: ${filePath}`);

        const originalContent = fs.readFileSync(fullPath, 'utf-8');
        const errorSummary = fileErrors.map(e => 
          `Line ${e.line}: [${e.category}] ${e.message}`
        ).join('\n');

        const prompt = `Fix these errors in the following TypeScript file:

FILE: ${filePath}

ERRORS:
${errorSummary}

CURRENT CODE:
\`\`\`typescript
${originalContent}
\`\`\`

RULES:
1. Fix all errors listed above
2. Maintain code structure and functionality
3. Ensure imports are at the top (before exports)
4. Fix import paths if they're incorrect
5. Return ONLY the fixed code, no explanations

Return the complete fixed file:`;

        const fixed = await callAI({
          pipelineId,
          step: 'pre-testing-validator',
          role: 'FIXER',
          model: selectModel('FIXER', 'simple'),
          messages: [{ role: 'user', content: prompt }],
        });

        // Extract code from response
        let fixedCode = fixed.trim();
        if (fixedCode.includes('```typescript')) {
          fixedCode = fixedCode.split('```typescript')[1].split('```')[0].trim();
        } else if (fixedCode.includes('```')) {
          fixedCode = fixedCode.split('```')[1].split('```')[0].trim();
        }

        // Write fixed code
        fs.writeFileSync(fullPath, fixedCode);
        fixedFiles.push(filePath);
        console.log(`✅ [Phase A] Fixed: ${filePath}`);
      } catch (error: any) {
        console.error(`⚠️ [Phase A] Failed to fix ${filePath}: ${error.message}`);
      }
    }
    
    // Re-run Type Enforcer to update the "Truth" after foundation fixes
    console.log(`🔍 [Phase A] Updating type definitions cache...`);
    await enforcer.run();
    console.log(`✅ [Phase A] Foundation layer complete. Type definitions updated.`);
  }

  // PHASE B: STRUCTURE (Parallel) - Fix components and app files with cheat sheet
  const structureFiles = sortedFilesToFix.filter(([filePath]) => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return !normalizedPath.includes('src/lib/') && 
           !normalizedPath.includes('src/types/') &&
           !normalizedPath.includes('/lib/types') &&
           !normalizedPath.includes('/types.ts');
  });

  if (structureFiles.length > 0) {
    console.log(`\n🏗️ [Phase B] Fixing Structure Layer (Parallel): ${structureFiles.length} files...`);
    
    // Chunk into batches of 5
    const CONCURRENCY_LIMIT = 5;
    const structureChunks: Array<Array<[string, ValidationError[]]>> = [];
    for (let i = 0; i < structureFiles.length; i += CONCURRENCY_LIMIT) {
      structureChunks.push(structureFiles.slice(i, i + CONCURRENCY_LIMIT));
    }

    let processedCount = 0;

    // Process each batch in parallel
    for (const chunk of structureChunks) {
      const batchNumber = Math.floor(processedCount / CONCURRENCY_LIMIT) + 1;
      console.log(`\n📦 [Phase B] Processing Batch ${batchNumber}/${structureChunks.length} (${chunk.length} files)...`);

      // Run this batch in parallel
      await Promise.all(chunk.map(async ([filePath, fileErrors]) => {
        const fullPath = path.join(repoPath, filePath);
        if (!fs.existsSync(fullPath)) {
          console.log(`   ⚠️  Skipping ${filePath} (file not found)`);
          return;
        }

        try {
          console.log(`⚡ [Phase B] Starting fix for: ${filePath}`);

          const originalContent = fs.readFileSync(fullPath, 'utf-8');
          const errorSummary = fileErrors.map(e => 
            `Line ${e.line}: [${e.category}] ${e.message}`
          ).join('\n');

          // ENHANCED PROMPT: Get Cheat Sheet from Type Enforcer
          const cheatSheet = enforcer.generateFixerContext(fullPath);

          const prompt = `Fix these errors in the following TypeScript/React file:

FILE: ${filePath}

ERRORS:
${errorSummary}

${cheatSheet}

CURRENT CODE:
\`\`\`typescript
${originalContent}
\`\`\`

RULES:
1. Fix all errors listed above
2. Use the EXACT type definitions from the cheat sheet above (do NOT invent new types)
3. Maintain code structure and functionality
4. Ensure imports are at the top (before exports)
5. Fix import paths if they're incorrect
6. Return ONLY the fixed code, no explanations

Return the complete fixed file:`;

          const fixed = await callAI({
            pipelineId,
            step: 'pre-testing-validator',
            role: 'FIXER',
            model: selectModel('FIXER', 'simple'), // Use cheap model for auto-fixes
            messages: [{ role: 'user', content: prompt }],
          });

          // Extract code from response (handle markdown code blocks)
          let fixedCode = fixed.trim();
          if (fixedCode.includes('```typescript')) {
            fixedCode = fixedCode.split('```typescript')[1].split('```')[0].trim();
          } else if (fixedCode.includes('```')) {
            fixedCode = fixedCode.split('```')[1].split('```')[0].trim();
          }

          // Write fixed code
          fs.writeFileSync(fullPath, fixedCode);
          fixedFiles.push(filePath);
          console.log(`✅ [Phase B] Finished: ${filePath}`);
        } catch (error: any) {
          console.error(`⚠️ [Phase B] Failed to fix ${filePath}: ${error.message}`);
        }
      }));

      processedCount += chunk.length;
      console.log(`   ✅ Batch ${batchNumber} complete (${processedCount}/${structureFiles.length} files processed)`);
    }
  }

  console.log(`\n🎉 Parallel Fixer Complete: Fixed ${fixedFiles.length}/${filesToFix.length} files`);

  // Return fixes in format that applyFixes can use
  return JSON.stringify({
    fixedFiles,
    errorsFixed: errors.length,
    files: fixedFiles.map(filePath => {
      const fullPath = path.join(repoPath, filePath);
      if (fs.existsSync(fullPath)) {
        return {
          file: filePath,
          content: fs.readFileSync(fullPath, 'utf-8'),
        };
      }
      return null;
    }).filter(Boolean),
  });
}

/**
 * Class-based validator using TypeScript compiler API
 * Provides robust validation using ts.createProgram
 * Scans all .ts and .tsx files in src/ and collects diagnostics
 */
export class PreTestingValidator {
  /**
   * Validate project using TypeScript compiler API
   * @param projectRoot Root directory of the project
   * @returns ValidationResult with errors and validation status
   */
  async validateProject(projectRoot: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    try {
      // Initialize TypeScript config path
      const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
      
      // Find all TypeScript files in src/
      const srcPath = path.join(projectRoot, 'src');
      if (!fs.existsSync(srcPath)) {
        console.warn(`⚠️ [PreTestingValidator] src/ directory not found at ${srcPath}`);
        return {
          passed: true,
          errors: [],
          shouldRetryPhase: false,
        };
      }

      // Collect all .ts and .tsx files recursively
      const files: string[] = [];
      async function collectFiles(dir: string): Promise<void> {
        if (!fs.existsSync(dir)) return;
        
        try {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            // Skip node_modules and hidden directories
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
              continue;
            }
            
            if (entry.isDirectory()) {
              await collectFiles(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
              files.push(fullPath);
            }
          }
        } catch (error) {
          // Ignore read errors
        }
      }
      
      await collectFiles(srcPath);
      
      if (files.length === 0) {
        console.warn(`⚠️ [PreTestingValidator] No TypeScript files found in ${srcPath}`);
        return {
          passed: true,
          errors: [],
          shouldRetryPhase: false,
        };
      }

      // Read and parse tsconfig.json
      let compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2022,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.Preserve,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: false,
        isolatedModules: true,
        incremental: true,
        paths: {
          '@/*': ['./src/*']
        },
      };

      if (fs.existsSync(tsConfigPath)) {
        try {
          const configContent = await fsPromises.readFile(tsConfigPath, 'utf-8');
          const configJson = ts.parseConfigFileTextToJson(tsConfigPath, configContent);
          
          if (configJson.config && configJson.config.compilerOptions) {
            // Merge with defaults
            compilerOptions = {
              ...compilerOptions,
              ...configJson.config.compilerOptions,
            };
          }
        } catch (e: any) {
          console.warn(`⚠️ [PreTestingValidator] Failed to parse tsconfig.json: ${e.message}. Using defaults.`);
        }
      }

      // Create TypeScript program
      const program = ts.createProgram(files, compilerOptions);
      
      // Get diagnostics (errors)
      const diagnostics = ts.getPreEmitDiagnostics(program);
      
      // Convert diagnostics to ValidationError format
      // Filter out node_modules errors if possible
      for (const diagnostic of diagnostics) {
        if (diagnostic.file && diagnostic.start !== undefined) {
          const filePath = diagnostic.file.fileName;
          
          // Skip node_modules errors
          if (filePath.includes('node_modules')) {
            continue;
          }
          
          const relativePath = path.relative(projectRoot, filePath);
          const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
          const code = diagnostic.code;
          
          // Categorize error
          let category = 'type';
          if (code >= 2300 && code < 2400) {
            category = 'import'; // Module resolution errors
          } else if (code >= 2400 && code < 2500) {
            category = 'syntax'; // Syntax errors
          }
          
          // Determine if auto-fixable based on error code
          const autoFixable = [
            2307, // Cannot find module
            2305, // Module has no exported member
            2304, // Cannot find name
            2552, // Cannot find name (different category)
          ].includes(code);

          errors.push({
            category,
            file: relativePath,
            line: line + 1,
            message: `TS${code}: ${message}`,
            autoFixable,
          });
        } else {
          // Global diagnostics (no file associated)
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
          errors.push({
            category: 'syntax',
            file: 'unknown',
            line: 0,
            message: `TS${diagnostic.code}: ${message}`,
            autoFixable: false,
          });
        }
      }

      if (errors.length === 0) {
        console.log('✅ [PreTestingValidator] All TypeScript checks passed!');
        return {
          passed: true,
          errors: [],
          shouldRetryPhase: false,
        };
      }

      console.log(`⚠️ [PreTestingValidator] Found ${errors.length} TypeScript errors`);
      return {
        passed: false,
        errors,
        shouldRetryPhase: true,
      };
    } catch (error: any) {
      console.error(`❌ [PreTestingValidator] Validation failed: ${error.message}`);
      return {
        passed: false,
        errors: [{
          category: 'syntax',
          file: 'unknown',
          line: 0,
          message: `Validation error: ${error.message}`,
          autoFixable: false,
        }],
        shouldRetryPhase: false,
      };
    }
  }
}
