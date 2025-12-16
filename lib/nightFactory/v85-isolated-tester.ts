// =============================================================================
// FROST NIGHT FACTORY v8.5 - ISOLATED PIPELINE TESTER
// =============================================================================
// Runs validation in isolated per-pipeline temp folders

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { runFrameworkGuardrails } from './v85-ast-validators';
import type { Violation } from './v85-ast-validators';
import { validateLayoutComponents, autoFixLayoutComponents } from './v85-layout-validator';
import { LAYOUT_CONTRACTS, generateComponentFromContract, getLayoutContract, isLayoutComponent } from './layout-contract';
import { DEFAULT_V85_FLAGS } from './v85-types';
import type { V85FeatureFlags, CostLog } from './v85-types';

const execAsync = promisify(exec);

/**
 * Isolated tester configuration
 */
export interface IsolatedTesterConfig {
  workspaceRoot: string;       // e.g., workspace/sandbox
  tempProjectsRoot: string;    // e.g., workspace/temp-projects
  pipelineId: string;
  flags: V85FeatureFlags;
  copySharedScaffolding: boolean;
  runNpmInstall: boolean;
  maxValidationRetries: number;
}

/**
 * Isolated tester result
 */
export interface IsolatedTesterResult {
  success: boolean;
  tempProjectRoot: string;
  violations: Violation[];
  layoutViolations: any[];
  tscErrors: string[];
  fixedFiles: string[];
  costLog: CostLog[];
  cleanupFn: () => Promise<void>;
}

/**
 * Run validation in an isolated temp folder for a single pipeline
 */
export async function runIsolatedPipelineTest(
  generatedFiles: Map<string, string>,
  config: IsolatedTesterConfig
): Promise<IsolatedTesterResult> {
  const tempRoot = path.join(config.tempProjectsRoot, config.pipelineId);
  const costLog: CostLog[] = [];
  
  console.log(`\n🔒 Starting isolated pipeline test`);
  console.log(`   Pipeline: ${config.pipelineId}`);
  console.log(`   Temp root: ${tempRoot}`);
  console.log(`   Files: ${generatedFiles.size}`);
  
  // Step 1: Create clean temp folder
  await createCleanTempFolder(tempRoot);
  
  // Step 2: Copy shared scaffolding (tsconfig, package.json, etc.)
  if (config.copySharedScaffolding) {
    await copySharedScaffolding(config.workspaceRoot, tempRoot);
  }
  
  // Step 3: Copy frozen layout templates
  await copyFrozenLayoutTemplates(tempRoot);
  
  // Step 4: Write generated files
  await writeGeneratedFiles(tempRoot, generatedFiles);
  
  // Step 5: Run npm install if needed
  if (config.runNpmInstall) {
    await runNpmInstall(tempRoot);
  }
  
  // Step 6: Validate layout contracts first
  console.log(`\n📋 Validating layout contracts...`);
  const layoutResult = validateLayoutComponents(tempRoot);
  
  if (!layoutResult.valid) {
    console.log(`   ⚠️ Layout contract violations found: ${layoutResult.violations.length}`);
    
    // Auto-fix layout components from contracts
    const { fixed, failed } = await autoFixLayoutComponents(tempRoot);
    console.log(`   ✅ Fixed ${fixed.length} layout files from contracts`);
    
    if (failed.length > 0) {
      console.log(`   ❌ Failed to fix: ${failed.join(', ')}`);
    }
  }
  
  // Step 7: Run AST guardrails
  console.log(`\n🔍 Running AST guardrails...`);
  let violations = runFrameworkGuardrails(tempRoot);
  console.log(`   Found ${violations.length} violations`);
  
  // Step 8: Run TypeScript type checking
  console.log(`\n🔧 Running TypeScript check...`);
  const tscResult = await runTypeScriptCheck(tempRoot);
  console.log(`   Errors: ${tscResult.errors.length}`);
  
  // Cleanup function
  const cleanupFn = async () => {
    try {
      await fs.rm(tempRoot, { recursive: true, force: true });
      console.log(`🧹 Cleaned up ${tempRoot}`);
    } catch {
      // Ignore cleanup errors
    }
  };
  
  const success = violations.length === 0 && tscResult.errors.length === 0;
  
  return {
    success,
    tempProjectRoot: tempRoot,
    violations,
    layoutViolations: layoutResult.violations,
    tscErrors: tscResult.errors,
    fixedFiles: [],
    costLog,
    cleanupFn,
  };
}

/**
 * Create a clean temp folder
 */
async function createCleanTempFolder(tempRoot: string): Promise<void> {
  // Remove existing folder if present
  try {
    await fs.rm(tempRoot, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
  
  // Create fresh folder
  await fs.mkdir(tempRoot, { recursive: true });
  console.log(`   📁 Created temp folder: ${tempRoot}`);
}

/**
 * Copy shared scaffolding files
 */
async function copySharedScaffolding(
  sourceRoot: string,
  tempRoot: string
): Promise<void> {
  const scaffoldingFiles = [
    'tsconfig.json',
    'package.json',
    'tailwind.config.js',
    'tailwind.config.ts',
    'postcss.config.js',
    'postcss.config.mjs',
    'next.config.js',
    'next.config.mjs',
    '.env.local',
  ];
  
  for (const file of scaffoldingFiles) {
    const sourcePath = path.join(sourceRoot, file);
    const destPath = path.join(tempRoot, file);
    
    try {
      await fs.access(sourcePath);
      await fs.copyFile(sourcePath, destPath);
      console.log(`   📄 Copied ${file}`);
    } catch {
      // File doesn't exist, skip
    }
  }
  
  // Create minimal tsconfig if none exists
  const tsconfigPath = path.join(tempRoot, 'tsconfig.json');
  try {
    await fs.access(tsconfigPath);
  } catch {
    await fs.writeFile(tsconfigPath, JSON.stringify({
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./src/*'] },
        forceConsistentCasingInFileNames: true,
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2), 'utf-8');
    console.log(`   📄 Created default tsconfig.json`);
  }
}

/**
 * Copy frozen layout templates
 */
async function copyFrozenLayoutTemplates(tempRoot: string): Promise<void> {
  const layoutDir = path.join(tempRoot, 'src', 'components', 'layout');
  await fs.mkdir(layoutDir, { recursive: true });
  
  // Generate all layout components from contracts
  for (const contract of LAYOUT_CONTRACTS) {
    const fileName = `${contract.name}.tsx`;
    const filePath = path.join(layoutDir, fileName);
    
    // Only write if file doesn't exist (don't overwrite generated code)
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, contract.example, 'utf-8');
      console.log(`   🧱 Created frozen template: ${fileName}`);
    }
  }
}

/**
 * Write generated files to temp folder
 */
async function writeGeneratedFiles(
  tempRoot: string,
  files: Map<string, string>
): Promise<void> {
  for (const [relativePath, content] of files.entries()) {
    // Normalize path
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const fullPath = path.join(tempRoot, normalizedPath);
    
    // Skip layout files if they're contracted (use frozen templates)
    if (isLayoutFile(normalizedPath)) {
      const componentName = getComponentNameFromPath(normalizedPath);
      if (componentName && isLayoutComponent(componentName)) {
        // Use frozen template instead of generated code
        const contract = getLayoutContract(componentName);
        if (contract) {
          console.log(`   🔒 Using frozen template for ${componentName}`);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, contract.example, 'utf-8');
          continue;
        }
      }
    }
    
    // Write generated file
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
  
  console.log(`   📝 Wrote ${files.size} generated files`);
}

/**
 * Run npm install in temp folder
 */
async function runNpmInstall(tempRoot: string): Promise<void> {
  console.log(`   📦 Running npm install...`);
  
  try {
    // Check if package.json exists
    await fs.access(path.join(tempRoot, 'package.json'));
    
    await execAsync('npm install --legacy-peer-deps', {
      cwd: tempRoot,
      timeout: 120000, // 2 minute timeout
    });
    
    console.log(`   ✅ npm install complete`);
  } catch (error: any) {
    console.log(`   ⚠️ npm install skipped or failed: ${error.message}`);
  }
}

/**
 * Run TypeScript type checking
 */
async function runTypeScriptCheck(
  tempRoot: string
): Promise<{ success: boolean; errors: string[] }> {
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit 2>&1', {
      cwd: tempRoot,
      timeout: 60000, // 1 minute timeout
    });
    
    return { success: true, errors: [] };
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message || '';
    const errors = parseTypeScriptErrors(output);
    
    return { success: false, errors };
  }
}

/**
 * Parse TypeScript errors from tsc output
 */
function parseTypeScriptErrors(output: string): string[] {
  const lines = output.split('\n');
  const errors: string[] = [];
  
  for (const line of lines) {
    if (line.includes('error TS')) {
      errors.push(line.trim());
    }
  }
  
  return errors;
}

/**
 * Check if a path is a layout file
 */
function isLayoutFile(filePath: string): boolean {
  return filePath.includes('/components/layout/') || 
         filePath.includes('\\components\\layout\\');
}

/**
 * Get component name from path
 */
function getComponentNameFromPath(filePath: string): string | null {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename.charAt(0).toUpperCase() + basename.slice(1);
}

/**
 * Cleanup all temp project folders
 */
export async function cleanupAllTempProjects(tempProjectsRoot: string): Promise<number> {
  let cleaned = 0;
  
  try {
    const entries = await fs.readdir(tempProjectsRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(tempProjectsRoot, entry.name);
        await fs.rm(fullPath, { recursive: true, force: true });
        cleaned++;
      }
    }
    
    console.log(`🧹 Cleaned up ${cleaned} temp project folders`);
  } catch {
    // Root folder doesn't exist, nothing to clean
  }
  
  return cleaned;
}

/**
 * Get list of active temp projects
 */
export async function listTempProjects(tempProjectsRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(tempProjectsRoot, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {
    return [];
  }
}

/**
 * Create default isolated tester config
 */
export function createDefaultIsolatedTesterConfig(
  pipelineId: string,
  workspaceRoot: string = 'workspace/sandbox'
): IsolatedTesterConfig {
  return {
    workspaceRoot,
    tempProjectsRoot: 'workspace/temp-projects',
    pipelineId,
    flags: DEFAULT_V85_FLAGS,
    copySharedScaffolding: true,
    runNpmInstall: false, // Skip by default for speed
    maxValidationRetries: 5,
  };
}

