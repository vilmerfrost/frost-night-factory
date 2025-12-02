// =============================================================================
// PRE-COMMIT VALIDATION - Run checks BEFORE sending to user
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GOLDEN_VERSIONS, validateAndFixDependencies } from './goldenVersions';
import { GOLDEN_TEMPLATES, getGoldenTemplate } from './goldenTemplates';

/**
 * Validation result
 */
export interface ValidationResult {
  check: string;
  passed: boolean;
  errors: string[];
  autoFixable: boolean;
  fixApplied?: boolean;
}

/**
 * Run all pre-commit validation checks
 */
export async function runPreCommitValidation(
  projectDir: string,
  autoFix: boolean = true
): Promise<{ passed: boolean; results: ValidationResult[] }> {
  console.log('\n🔍 RUNNING PRE-COMMIT VALIDATION SUITE...\n');
  
  const results: ValidationResult[] = [];
  
  // 1. Validate package.json
  const pkgResult = await validatePackageJson(projectDir, autoFix);
  results.push(pkgResult);
  console.log(`  ${pkgResult.passed ? '✅' : '❌'} Package.json validation`);
  
  // 2. Validate tsconfig.json
  const tsResult = await validateTsConfig(projectDir, autoFix);
  results.push(tsResult);
  console.log(`  ${tsResult.passed ? '✅' : '❌'} TypeScript config validation`);
  
  // 3. Validate exports (no default exports in components)
  const exportResult = await validateExports(projectDir, autoFix);
  results.push(exportResult);
  console.log(`  ${exportResult.passed ? '✅' : '❌'} Export validation`);
  
  // 4. Run type check
  const typeResult = await runTypeCheck(projectDir);
  results.push(typeResult);
  console.log(`  ${typeResult.passed ? '✅' : '❌'} Type check`);
  
  // 5. Scan for lazy code
  const lazyResult = await scanForLazyCode(projectDir);
  results.push(lazyResult);
  console.log(`  ${lazyResult.passed ? '✅' : '❌'} Lazy code scan`);
  
  // 6. Validate imports
  const importResult = await validateImports(projectDir);
  results.push(importResult);
  console.log(`  ${importResult.passed ? '✅' : '❌'} Import validation`);
  
  // 7. Validate required files exist
  const filesResult = await validateRequiredFiles(projectDir, autoFix);
  results.push(filesResult);
  console.log(`  ${filesResult.passed ? '✅' : '❌'} Required files check`);
  
  const allPassed = results.every(r => r.passed);
  
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}\n`);
  
  return { passed: allPassed, results };
}

/**
 * Validate package.json versions
 */
async function validatePackageJson(
  projectDir: string,
  autoFix: boolean
): Promise<ValidationResult> {
  const pkgPath = path.join(projectDir, 'package.json');
  const errors: string[] = [];
  let fixApplied = false;
  
  if (!fs.existsSync(pkgPath)) {
    return {
      check: 'package.json',
      passed: false,
      errors: ['package.json not found'],
      autoFixable: true,
    };
  }
  
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    // Check for hallucinated versions
    for (const [name, version] of Object.entries(allDeps)) {
      const goldenVersion = GOLDEN_VERSIONS[name as keyof typeof GOLDEN_VERSIONS];
      if (goldenVersion && version !== goldenVersion) {
        // Check if it's a known bad version
        const cleanVersion = (version as string).replace(/[\^~]/g, '');
        if (cleanVersion.startsWith('3.5') && name === 'tailwindcss') {
          errors.push(`${name}@${version} - hallucinated version, should be ${goldenVersion}`);
        }
        if (cleanVersion.startsWith('19') && name === 'react') {
          errors.push(`${name}@${version} - hallucinated version, should be ${goldenVersion}`);
        }
        if (cleanVersion.startsWith('15') && name === 'next') {
          errors.push(`${name}@${version} - unstable version, should be ${goldenVersion}`);
        }
      }
    }
    
    // Auto-fix if enabled and errors found
    if (autoFix && errors.length > 0) {
      const { fixed: fixedDeps, corrections: depCorrections } = validateAndFixDependencies(pkg.dependencies || {});
      const { fixed: fixedDevDeps, corrections: devCorrections } = validateAndFixDependencies(pkg.devDependencies || {});
      
      pkg.dependencies = fixedDeps;
      pkg.devDependencies = fixedDevDeps;
      
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      fixApplied = true;
      
      console.log('    📦 Auto-fixed package.json versions:');
      [...depCorrections, ...devCorrections].forEach(c => console.log(`      - ${c}`));
    }
  } catch (e) {
    errors.push(`Failed to parse package.json: ${e}`);
  }
  
  return {
    check: 'package.json',
    passed: errors.length === 0 || fixApplied,
    errors,
    autoFixable: true,
    fixApplied,
  };
}

/**
 * Validate tsconfig.json has strict mode
 */
async function validateTsConfig(
  projectDir: string,
  autoFix: boolean
): Promise<ValidationResult> {
  const tsConfigPath = path.join(projectDir, 'tsconfig.json');
  const errors: string[] = [];
  let fixApplied = false;
  
  if (!fs.existsSync(tsConfigPath)) {
    if (autoFix) {
      const template = getGoldenTemplate('tsconfig.json');
      if (template) {
        fs.writeFileSync(tsConfigPath, template);
        fixApplied = true;
      }
    }
    return {
      check: 'tsconfig.json',
      passed: fixApplied,
      errors: fixApplied ? [] : ['tsconfig.json not found'],
      autoFixable: true,
      fixApplied,
    };
  }
  
  try {
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
    const opts = tsConfig.compilerOptions || {};
    
    if (opts.strict !== true) {
      errors.push('strict mode is not enabled');
    }
    if (opts.noImplicitAny !== true && opts.strict !== true) {
      errors.push('noImplicitAny is not enabled');
    }
    
    // Auto-fix by replacing with golden template
    if (autoFix && errors.length > 0) {
      const template = getGoldenTemplate('tsconfig.json');
      if (template) {
        fs.writeFileSync(tsConfigPath, template);
        fixApplied = true;
        console.log('    📝 Auto-fixed tsconfig.json with strict mode');
      }
    }
  } catch (e) {
    errors.push(`Failed to parse tsconfig.json: ${e}`);
  }
  
  return {
    check: 'tsconfig.json',
    passed: errors.length === 0 || fixApplied,
    errors,
    autoFixable: true,
    fixApplied,
  };
}

/**
 * Validate no default exports in components (except page/layout)
 */
async function validateExports(
  projectDir: string,
  autoFix: boolean
): Promise<ValidationResult> {
  const errors: string[] = [];
  const componentsDir = path.join(projectDir, 'components');
  
  if (!fs.existsSync(componentsDir)) {
    return {
      check: 'exports',
      passed: true,
      errors: [],
      autoFixable: true,
    };
  }
  
  function scanDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDir(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        // Skip page.tsx and layout.tsx
        if (file === 'page.tsx' || file === 'layout.tsx') continue;
        
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('export default')) {
          const relativePath = path.relative(projectDir, filePath);
          errors.push(`${relativePath} uses 'export default' - should use named exports`);
          
          // Auto-fix
          if (autoFix) {
            let fixed = content;
            // Convert "export default function X" to "export function X"
            fixed = fixed.replace(/export default function\s+(\w+)/g, 'export function $1');
            // Convert "export default const X" to "export const X"
            fixed = fixed.replace(/export default const\s+(\w+)/g, 'export const $1');
            
            if (fixed !== content) {
              fs.writeFileSync(filePath, fixed);
              console.log(`    🔧 Fixed exports in ${relativePath}`);
            }
          }
        }
      }
    }
  }
  
  scanDir(componentsDir);
  
  return {
    check: 'exports',
    passed: errors.length === 0,
    errors,
    autoFixable: true,
  };
}

/**
 * Run TypeScript type check
 */
async function runTypeCheck(projectDir: string): Promise<ValidationResult> {
  const errors: string[] = [];
  
  try {
    execSync('npx tsc --noEmit', { 
      cwd: projectDir, 
      stdio: 'pipe',
      timeout: 60000 
    });
  } catch (e: any) {
    const output = e.stdout?.toString() || e.stderr?.toString() || '';
    // Extract first few errors
    const errorLines = output.split('\n').filter((l: string) => l.includes('error TS')).slice(0, 5);
    errors.push(...errorLines);
  }
  
  return {
    check: 'typecheck',
    passed: errors.length === 0,
    errors,
    autoFixable: false,
  };
}

/**
 * Scan for lazy code patterns
 */
async function scanForLazyCode(projectDir: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const lazyPatterns = [
    { pattern: /TODO:/gi, message: 'TODO comment found' },
    { pattern: /FIXME:/gi, message: 'FIXME comment found' },
    { pattern: /:\s*any\b/g, message: 'Explicit any type' },
    { pattern: /return\s+null\s*;?\s*$/gm, message: 'Returns null (empty component?)' },
    { pattern: /pass\s*$/gm, message: 'Python pass statement' },
    { pattern: /Lorem ipsum/gi, message: 'Placeholder text' },
  ];
  
  function scanFile(filePath: string) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(projectDir, filePath);
    
    for (const { pattern, message } of lazyPatterns) {
      if (pattern.test(content)) {
        errors.push(`${relativePath}: ${message}`);
      }
    }
  }
  
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === '.next') continue;
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        scanDir(filePath);
      } else {
        scanFile(filePath);
      }
    }
  }
  
  scanDir(path.join(projectDir, 'app'));
  scanDir(path.join(projectDir, 'components'));
  scanDir(path.join(projectDir, 'lib'));
  
  return {
    check: 'lazy-code',
    passed: errors.length === 0,
    errors: errors.slice(0, 10), // Limit to first 10
    autoFixable: false,
  };
}

/**
 * Validate all imports resolve
 */
async function validateImports(projectDir: string): Promise<ValidationResult> {
  const errors: string[] = [];
  
  function checkImports(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(projectDir, filePath);
    
    // Find all import statements
    const importRegex = /import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Skip node_modules imports
      if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
        continue;
      }
      
      // Resolve the import path
      let resolvedPath: string;
      if (importPath.startsWith('@/')) {
        resolvedPath = path.join(projectDir, importPath.replace('@/', ''));
      } else {
        resolvedPath = path.join(path.dirname(filePath), importPath);
      }
      
      // Check if file exists (with common extensions)
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      const exists = extensions.some(ext => fs.existsSync(resolvedPath + ext));
      
      if (!exists) {
        errors.push(`${relativePath}: Cannot resolve import '${importPath}'`);
      }
    }
  }
  
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === '.next') continue;
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        scanDir(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        checkImports(filePath);
      }
    }
  }
  
  scanDir(path.join(projectDir, 'app'));
  scanDir(path.join(projectDir, 'components'));
  scanDir(path.join(projectDir, 'lib'));
  
  return {
    check: 'imports',
    passed: errors.length === 0,
    errors: errors.slice(0, 10),
    autoFixable: false,
  };
}

/**
 * Validate required files exist
 */
async function validateRequiredFiles(
  projectDir: string,
  autoFix: boolean
): Promise<ValidationResult> {
  const errors: string[] = [];
  let fixApplied = false;
  
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'next.config.mjs',
    'tailwind.config.ts',
    'postcss.config.js',
    'app/page.tsx',
    'app/layout.tsx',
    'app/globals.css',
    'lib/types.ts',
    'lib/mock-data.ts',
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(projectDir, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required file: ${file}`);
      
      // Auto-fix by creating from golden template
      if (autoFix) {
        const template = getGoldenTemplate(file);
        if (template) {
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const content = typeof template === 'function' ? (template as any)() : template;
          fs.writeFileSync(filePath, content);
          fixApplied = true;
          console.log(`    📄 Created ${file} from golden template`);
        }
      }
    }
  }
  
  return {
    check: 'required-files',
    passed: errors.length === 0 || fixApplied,
    errors,
    autoFixable: true,
    fixApplied,
  };
}

