// agent-runner/lib/pre-testing-validator.ts
// Layer 1: Quick AST Validation (After Coder Phase)
// Validates syntax, imports, types, and detects lazy code before testing

import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import { execSync } from 'child_process';
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
 * New robust validation result interface
 */
export interface ProjectValidationResult {
  success: boolean;
  diagnostics: string[]; // Human-readable error messages
  errorCount: number;
}

/**
 * Main validation function - validates Coder phase output
 * Maintains backward compatibility
 */
export async function validateCoderPhaseOutput(
  coderJSON: CoderPhaseJSON,
  repoPath: string,
  pipelineId: string
): Promise<ValidationResult> {
  console.log('\n🔍 [Pre-Testing Validator] Starting validation...');
  
  // Use the new ProjectValidator for robust TypeScript checking
  const validator = new ProjectValidator(repoPath);
  const projectValidation = validator.validate();
  
  // Convert ProjectValidationResult to ValidationResult format
  const errors: ValidationError[] = projectValidation.diagnostics.map(diagnostic => {
    // Parse diagnostic format: "file.ts (line,col): message"
    const match = diagnostic.match(/^(.+?)\s+\((\d+),(\d+)\):\s*(.+)$/);
    if (match) {
      const [, file, line, , message] = match;
      return {
        category: 'type',
        file: file.trim(),
        line: parseInt(line),
        message: message.trim(),
        autoFixable: message.includes('Cannot find module') || message.includes('Cannot find name'),
      };
    }
    return {
      category: 'syntax',
      file: 'unknown',
      line: 0,
      message: diagnostic,
      autoFixable: false,
    };
  });

  // Also run legacy checks for compatibility
  const syntaxErrors = await checkSyntax(coderJSON, repoPath);
  const importErrors = await validateImports(coderJSON, repoPath);
  const typeErrors = await validateTypeConsistency(coderJSON, repoPath);
  const lazyErrors = detectLazyCode(coderJSON, repoPath);
  
  errors.push(...syntaxErrors, ...importErrors, ...typeErrors, ...lazyErrors);

  if (errors.length === 0) {
    console.log('✅ [Pre-Testing Validator] All checks passed!');
    return { passed: true, errors: [], shouldRetryPhase: false };
  }

  console.log(`⚠️  [Pre-Testing Validator] Found ${errors.length} errors`);
  console.log(`   Auto-fixable: ${errors.filter(e => e.autoFixable).length}`);
  console.log(`   Needs AI: ${errors.filter(e => !e.autoFixable).length}`);

  // ✅ CRITICAL FIX: Attempt AI fix for ALL errors (both autoFixable AND needsAi)
  const errorsToFix = errors; // Fix ALL errors (both autoFixable and needsAi)
  
  if (errorsToFix.length > 0) {
    console.log('🔧 [Pre-Testing Validator] Attempting AI fix for ALL errors...');
    console.log(`   📊 Processing ${errorsToFix.length} errors (${errors.filter(e => e.autoFixable).length} auto-fixable + ${errors.filter(e => !e.autoFixable).length} needs AI)`);
    const fixedCode = await autoFixErrors(
      coderJSON,
      repoPath,
      errorsToFix,
      pipelineId
    );
    return {
      passed: false,
      errors,
      fixedCode,
      shouldRetryPhase: true,
    };
  }

  return {
    passed: true,
    errors: [],
    shouldRetryPhase: false,
  };
}

/**
 * Robust Project Validator using TypeScript compiler API
 * Mimics 'tsc --noEmit' but allows programmatic access to errors
 */
export class ProjectValidator {
  private projectRoot: string;
  private tsConfigPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.tsConfigPath = path.join(projectRoot, "tsconfig.json");
  }

  /**
   * Validates the project using the TypeScript compiler API.
   * It mimics 'tsc --noEmit' but allows for programmatic access to errors.
   */
  public validate(): ProjectValidationResult {
    console.log("🔍 Validator: Initializing TypeScript compiler check...");

    // 1. Parse tsconfig.json
    if (!fs.existsSync(this.tsConfigPath)) {
      return {
        success: false,
        diagnostics: [`Error: tsconfig.json not found at ${this.tsConfigPath}`],
        errorCount: 1,
      };
    }

    const configConfigFile = ts.readConfigFile(this.tsConfigPath, ts.sys.readFile);
    if (configConfigFile.error) {
      return {
        success: false,
        diagnostics: [`Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(configConfigFile.error.messageText, '\n')}`],
        errorCount: 1,
      };
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configConfigFile.config,
      ts.sys,
      this.projectRoot
    );

    // 2. Create the Program
    // We include all file names found in the project root based on tsconfig include/exclude
    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);

    // 3. Emit and get Diagnostics
    const emitResult = program.emit();
    const allDiagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);

    // 4. Filter and Format Diagnostics
    const formattedErrors: string[] = [];

    allDiagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start!
        );
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        
        // Exclude node_modules errors - we only care about source code
        if (!diagnostic.file.fileName.includes("node_modules")) {
          // Path relative to project root for cleaner logs
          const relativePath = path.relative(this.projectRoot, diagnostic.file.fileName);
          formattedErrors.push(
            `${relativePath} (${line + 1},${character + 1}): ${message}`
          );
        }
      } else {
        formattedErrors.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      }
    });

    const success = formattedErrors.length === 0;

    if (!success) {
      console.log(`❌ Validator: Found ${formattedErrors.length} errors.`);
    } else {
      console.log("✅ Validator: Project clean.");
    }

    return {
      success,
      diagnostics: formattedErrors,
      errorCount: formattedErrors.length,
    };
  }
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
    execSync('npx tsc --noEmit --skipLibCheck 2>&1', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000,
    });
  } catch (e: any) {
    const output = e.stdout || e.stderr || e.message;
    const lines = output.split('\n');
    const errorPattern = /([^(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/;

    for (const line of lines) {
      const match = line.match(errorPattern);
      if (match) {
        const [, file, lineNum, , code, message] = match;
        const autoFixable = ['TS2307', 'TS2305', 'TS2304'].includes(code);

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
  const allFiles = [
    ...(coderJSON.code_generated?.frontend?.files || []),
    ...(coderJSON.code_generated?.backend?.files || []),
  ];

  for (const fileInfo of allFiles) {
    const filePath = path.join(repoPath, fileInfo.path);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let foundExport = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('export ') && !line.includes('export default')) {
        foundExport = true;
      }
      if (foundExport && line.startsWith('import ')) {
        errors.push({
          category: 'import',
          file: fileInfo.path,
          line: i + 1,
          message: 'Import statement found after export (must be before)',
          autoFixable: true,
        });
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
  return []; // Type errors are handled by ProjectValidator
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
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
            continue;
          }

          errors.push({
            category: 'lazy',
            file: fileInfo.path,
            line: i + 1,
            message,
            autoFixable: false,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Auto-fix errors using AI with Phased Repair Protocol
 * ⚡ PHASED PROCESSING: Foundation (Sequential) → Structure (Parallel)
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
  // 🧠 PHASED REPAIR: Foundation (Sequential) → Structure (Parallel)
  // ═══════════════════════════════════════════════════════════════════
  
  // Import Type Consistency Enforcer
  const { TypeConsistencyEnforcer } = await import('../scripts/type-consistency-enforcer');
  const typeEnforcer = new TypeConsistencyEnforcer(repoPath);
  
  // Generate Cheat Sheet (The Hallucination Killer)
  const typeContext = typeEnforcer.generateCheatSheet();
  
  // CLASSIFY & SORT ERRORS (The Strategy Shift)
  const foundationErrors = filesToFix.filter(([filePath]) => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.includes("src/lib/") || 
           normalizedPath.includes("src/types/") ||
           normalizedPath.includes("/lib/types") ||
           normalizedPath.includes("/types.ts") ||
           filePath.includes("interface") ||
           filePath.includes("type alias");
  });

  const uiErrors = filesToFix.filter(([filePath]) => !foundationErrors.some(([f]) => f === filePath));

  let activeErrors: Array<[string, ValidationError[]]>;
  let executionMode: "SEQUENTIAL" | "PARALLEL";

  if (foundationErrors.length > 0) {
    console.log(`🧱 [ARCHITECT] Detected ${foundationErrors.length} Foundation/Type errors. Entering PHASE A (Sequential).`);
    activeErrors = foundationErrors;
    executionMode = "SEQUENTIAL";
  } else {
    console.log(`🎨 [ARCHITECT] Foundation stable. Detected ${uiErrors.length} UI errors. Entering PHASE B (Parallel).`);
    activeErrors = uiErrors;
    executionMode = "PARALLEL";
  }

  // PHASE A: FOUNDATION (Sequential)
  if (executionMode === "SEQUENTIAL" && activeErrors.length > 0) {
    console.log(`\n🏗️ [Phase A] Fixing Foundation Layer (Sequential): ${activeErrors.length} files...`);
    
    // Process first 3 critical type errors to avoid context overload
    const criticalErrors = activeErrors.slice(0, 3);
    
    for (const [filePath, fileErrors] of criticalErrors) {
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

${typeContext}

FILE: ${filePath}

ERRORS:
${errorSummary}

CURRENT CODE:
\`\`\`typescript
${originalContent}
\`\`\`

RULES:
1. Fix all errors listed above
2. Use the EXACT type definitions from the context above (do NOT invent new types)
3. Maintain code structure and functionality
4. Ensure imports are at the top (before exports)
5. Fix import paths if they're incorrect
6. Return ONLY the fixed code, no explanations

Return the complete fixed file:`;

        const fixed = await callAI({
          pipelineId,
          step: 'pre-testing-validator',
          role: 'FIXER',
          model: selectModel('FIXER', 'simple'),
          messages: [{ role: 'user', content: prompt }],
        });

        let fixedCode = fixed.trim();
        if (fixedCode.includes('```typescript')) {
          fixedCode = fixedCode.split('```typescript')[1].split('```')[0].trim();
        } else if (fixedCode.includes('```')) {
          fixedCode = fixedCode.split('```')[1].split('```')[0].trim();
        }

        fs.writeFileSync(fullPath, fixedCode);
        fixedFiles.push(filePath);
        console.log(`✅ [Phase A] Fixed: ${filePath}`);
      } catch (error: any) {
        console.error(`⚠️ [Phase A] Failed to fix ${filePath}: ${error.message}`);
      }
    }
    
    // Re-run Type Enforcer to update the "Truth" after foundation fixes
    console.log(`🔍 [Phase A] Updating type definitions cache...`);
    await typeEnforcer.run();
    console.log(`✅ [Phase A] Foundation layer complete. Type definitions updated.`);
  }

  // PHASE B: STRUCTURE (Parallel)
  if (executionMode === "PARALLEL" && activeErrors.length > 0) {
    console.log(`\n🏗️ [Phase B] Fixing Structure Layer (Parallel): ${activeErrors.length} files...`);
    
    // Process in batches of 5
    const batchSize = 5;
    const batches: Array<Array<[string, ValidationError[]]>> = [];
    for (let i = 0; i < activeErrors.length; i += batchSize) {
      batches.push(activeErrors.slice(i, i + batchSize));
    }

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`\n📦 [Phase B] Processing Batch ${batchIdx + 1}/${batches.length} (${batch.length} files)...`);

      await Promise.all(batch.map(async ([filePath, fileErrors]) => {
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

          const prompt = `Fix these errors in the following TypeScript/React file:

${typeContext}

FILE: ${filePath}

ERRORS:
${errorSummary}

CURRENT CODE:
\`\`\`typescript
${originalContent}
\`\`\`

RULES:
1. Fix all errors listed above
2. Use the EXACT type definitions from the context above (do NOT invent new types)
3. Maintain code structure and functionality
4. Ensure imports are at the top (before exports)
5. Fix import paths if they're incorrect
6. Return ONLY the fixed code, no explanations

Return the complete fixed file:`;

          const fixed = await callAI({
            pipelineId,
            step: 'pre-testing-validator',
            role: 'FIXER',
            model: selectModel('FIXER', 'simple'),
            messages: [{ role: 'user', content: prompt }],
          });

          let fixedCode = fixed.trim();
          if (fixedCode.includes('```typescript')) {
            fixedCode = fixedCode.split('```typescript')[1].split('```')[0].trim();
          } else if (fixedCode.includes('```')) {
            fixedCode = fixedCode.split('```')[1].split('```')[0].trim();
          }

          fs.writeFileSync(fullPath, fixedCode);
          fixedFiles.push(filePath);
          console.log(`✅ [Phase B] Finished: ${filePath}`);
        } catch (error: any) {
          console.error(`⚠️ [Phase B] Failed to fix ${filePath}: ${error.message}`);
        }
      }));

      console.log(`   ✅ Batch ${batchIdx + 1} complete (${fixedFiles.length}/${filesToFix.length} files processed)`);
    }
  }

  console.log(`\n🎉 Parallel Fixer Complete: Fixed ${fixedFiles.length}/${filesToFix.length} files`);

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
