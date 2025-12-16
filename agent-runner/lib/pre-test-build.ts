// agent-runner/lib/pre-test-build.ts
// Layer 3: Build Simulation (Before Testing)
// Runs tsc --noEmit and eslint BEFORE test phase and fixes issues

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { callAI, selectModel } from '../ai-client';
import { assertDefined } from '@/lib/utils/assert';

export interface BuildError {
  category: 'SYNTAXERROR' | 'IMPORTERROR' | 'EXPORTERROR' | 'TYPEERROR' | 'RUNTIMEERROR' | 'ESLINTERROR';
  file: string;
  line: number;
  message: string;
  autoFixable: boolean;
}

export interface PreTestBuildResult {
  passed: boolean;
  fixedCount?: number;
  unfixableErrors?: Array<{ error: BuildError; fixed: boolean; code: string }>;
  typescript: { errors: BuildError[] };
  eslint: { errors: BuildError[] };
  imports: { errors: BuildError[] };
  exports: { errors: BuildError[] };
}

/**
 * Main build simulation function
 */
export async function simulateBuild(
  repoPath: string,
  pipelineId: string
): Promise<PreTestBuildResult> {
  console.log('\n🔨 [Pre-Test Build] Simulating build...');

  const results: PreTestBuildResult = {
    passed: false,
    typescript: await runTypeScript(repoPath),
    eslint: await runESLint(repoPath),
    imports: await validateAllImports(repoPath),
    exports: await validateAllExports(repoPath),
  };

  const allErrors = [
    ...results.typescript.errors,
    ...results.eslint.errors,
    ...results.imports.errors,
    ...results.exports.errors,
  ];

  if (allErrors.length === 0) {
    console.log('✅ [Pre-Test Build] Build simulation passed!');
    return {
      passed: true,
      typescript: { errors: [] },
      eslint: { errors: [] },
      imports: { errors: [] },
      exports: { errors: [] },
    };
  }

  console.log(`⚠️  [Pre-Test Build] Found ${allErrors.length} build errors`);
  console.log(`   Auto-fixable: ${allErrors.filter(e => e.autoFixable).length}`);

  // Attempt auto-fixes
  return await attemptAutoFixes(allErrors, repoPath, pipelineId, results);
}

/**
 * Run TypeScript compiler check
 */
async function runTypeScript(repoPath: string): Promise<{ errors: BuildError[] }> {
  const errors: BuildError[] = [];

  try {
    execSync('npx tsc --noEmit --skipLibCheck 2>&1', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000, // 10 second timeout
    });
  } catch (e: any) {
    const output = e.stdout || e.stderr || e.message;
    const lines = output.split('\n');

    // Parse TypeScript errors
    const errorPattern = /([^(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/;

    for (const line of lines) {
      const match = line.match(errorPattern);
      if (match) {
        const [, file, lineNum, , code, message] = match;
        const category = code.startsWith('TS23') ? 'IMPORTERROR' : 'TYPEERROR';
        const autoFixable = ['TS2307', 'TS2305', 'TS2304', 'TS2300'].includes(code);

        errors.push({
          category,
          file: file.trim(),
          line: parseInt(lineNum),
          message: message.trim(),
          autoFixable,
        });
      }
    }
  }

  return { errors };
}

/**
 * Run ESLint check
 */
async function runESLint(repoPath: string): Promise<{ errors: BuildError[] }> {
  const errors: BuildError[] = [];

  // Check if ESLint config exists
  const eslintConfigs = ['.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', 'eslint.config.js'];
  const hasEslintConfig = eslintConfigs.some(config => 
    fs.existsSync(path.join(repoPath, config))
  );

  if (!hasEslintConfig) {
    // No ESLint config, skip check
    return { errors };
  }

  try {
    execSync('npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 2>&1', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000,
    });
  } catch (e: any) {
    const output = e.stdout || e.stderr || e.message;
    const lines = output.split('\n');

    // Parse ESLint errors
    for (const line of lines) {
      if (line.includes('error') || line.includes('Error:')) {
        const fileMatch = line.match(/([^\s]+)\s+(\d+):(\d+)/);
        if (fileMatch) {
          errors.push({
            category: 'ESLINTERROR',
            file: fileMatch[1],
            line: parseInt(fileMatch[2]),
            message: line,
            autoFixable: line.includes('import') || line.includes('export'),
          });
        }
      }
    }
  }

  return { errors };
}

/**
 * Validate all imports in the project
 */
async function validateAllImports(repoPath: string): Promise<{ errors: BuildError[] }> {
  const errors: BuildError[] = [];
  const tsFiles = getAllTypeScriptFiles(repoPath);

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const importPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath) continue;
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        const resolvedPath = path.resolve(path.dirname(file), importPath);
        const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
        let exists = false;

        for (const ext of possibleExtensions) {
          if (fs.existsSync(resolvedPath + ext) || fs.existsSync(resolvedPath)) {
            exists = true;
            break;
          }
        }

        if (!exists) {
          const lineNum = content.substring(0, match.index ?? 0).split('\n').length;
          errors.push({
            category: 'IMPORTERROR',
            file: path.relative(repoPath, file),
            line: lineNum,
            message: `Import not found: '${importPath}'`,
            autoFixable: true,
          });
        }
      }
    }
  }

  return { errors };
}

/**
 * Validate all exports in the project
 */
async function validateAllExports(repoPath: string): Promise<{ errors: BuildError[] }> {
  const errors: BuildError[] = [];
  const tsFiles = getAllTypeScriptFiles(repoPath);

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    // Check for exports that reference non-existent identifiers
    const exportPattern = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
    let match;

    while ((match = exportPattern.exec(content)) !== null) {
      const exportName = match[1];
      // Basic check: ensure the export actually exists in the file
      // More sophisticated checks would require AST parsing
    }

    // Check import order (imports before exports)
    let foundExport = false;
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      const line = rawLine.trim();
      if (line.startsWith('export ') && !line.includes('export default')) {
        foundExport = true;
      }
      if (foundExport && line.startsWith('import ')) {
        errors.push({
          category: 'EXPORTERROR',
          file: path.relative(repoPath, file),
          line: i + 1,
          message: 'Import found after export (must be before)',
          autoFixable: true,
        });
      }
    }
  }

  return { errors };
}

/**
 * Get all TypeScript files in the project
 */
function getAllTypeScriptFiles(repoPath: string): string[] {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx'];

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, .next, etc.
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  walkDir(repoPath);
  return files;
}

/**
 * Attempt to auto-fix build errors
 */
async function attemptAutoFixes(
  errors: BuildError[],
  repoPath: string,
  pipelineId: string,
  results: PreTestBuildResult
): Promise<PreTestBuildResult> {
  const fixedErrors: Array<{ error: BuildError; fixed: boolean; code: string }> = [];

  // Group errors by file
  const errorsByFile = new Map<string, BuildError[]>();
  for (const error of errors) {
    if (!errorsByFile.has(error.file)) {
      errorsByFile.set(error.file, []);
    }
    errorsByFile.get(error.file)!.push(error);
  }

  // Fix each file
  for (const [filePath, fileErrors] of Array.from(errorsByFile)) {
    const fullPath = path.join(repoPath, filePath);
    if (!fs.existsSync(fullPath)) continue;

    // ✅ CRITICAL FIX: Fix ALL errors (both autoFixable AND needsAi)
    // We want DeepSeek to attempt to fix EVERYTHING, not just auto-fixable errors
    const errorsToFix = fileErrors; // Fix ALL errors (both autoFixable and needsAi)
    
    if (errorsToFix.length === 0) {
      continue; // No errors for this file
    }

    const originalContent = fs.readFileSync(fullPath, 'utf-8');
    const errorSummary = errorsToFix.map(e => 
      `Line ${e.line}: [${e.category}] ${e.message}`
    ).join('\n');

    // Determine model based on error category
    const hasComplexErrors = errorsToFix.some(e => 
      ['TYPEERROR', 'RUNTIMEERROR'].includes(e.category)
    );
    const modelTier = hasComplexErrors ? 'medium' : 'simple';

    const prompt = `Fix these build errors in the following file:

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
5. Fix type errors if present
6. Return ONLY the fixed code, no explanations

Return the complete fixed file:`;

    try {
      const fixed = await callAI({
        pipelineId,
        step: 'pre-test-build',
        role: 'FIXER',
        model: selectModel('FIXER', modelTier),
        messages: [{ role: 'user', content: prompt }],
      });

      // Extract code from response
      let fixedCode = fixed.trim();
      if (fixedCode.includes('```typescript')) {
        const parts = fixedCode.split('```typescript');
        if (parts[1]) {
          const codeParts = parts[1].split('```');
          if (codeParts[0]) {
            fixedCode = codeParts[0].trim();
          }
        }
      } else if (fixedCode.includes('```')) {
        const parts = fixedCode.split('```');
        if (parts[1]) {
          const codeParts = parts[1].split('```');
          if (codeParts[0]) {
            fixedCode = codeParts[0].trim();
          }
        }
      }

      // Write fixed code
      fs.writeFileSync(fullPath, fixedCode);
      
      for (const error of errorsToFix) {
        fixedErrors.push({
          error,
          fixed: true,
          code: fixedCode,
        });
      }

      console.log(`   ✅ Fixed: ${filePath}`);
    } catch (error: any) {
      console.warn(`   ⚠️  Failed to fix ${filePath}: ${error.message}`);
      for (const err of errorsToFix) {
        fixedErrors.push({
          error: err,
          fixed: false,
          code: '',
        });
      }
    }
  }

  const fixedCount = fixedErrors.filter(e => e.fixed).length;
  const unfixableErrors = fixedErrors.filter(e => !e.fixed);

  return {
    ...results,
    passed: fixedCount === errors.length,
    fixedCount,
    unfixableErrors,
  };
}

