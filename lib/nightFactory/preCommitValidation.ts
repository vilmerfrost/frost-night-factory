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
  
  // 8. Validate component casing (JSX tags)
  const casingResult = await validateComponentCasing(projectDir, autoFix);
  results.push(casingResult);
  console.log(`  ${casingResult.passed ? '✅' : '❌'} Component casing validation`);
  
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
    'src/app/page.tsx',  // STRICT: Always use src/ structure
    'src/app/layout.tsx',
    'src/app/globals.css',
    'src/lib/types.ts',
    'src/lib/mock-data.ts',
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

/**
 * Check component casing in JSX tags
 * Finds lowercase JSX tags that should be capitalized (e.g., <card> -> <Card>)
 */
function checkComponentCasing(fileContent: string): string[] {
  const errors: string[] = [];
  
  // Common HTML tags that are lowercase by design
  const commonHtmlTags = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'button', 'input', 'form', 'label',
    'section', 'main', 'header', 'footer', 'nav', 'article', 'aside',
    'img', 'svg', 'path', 'circle', 'rect', 'line', 'polygon',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'select', 'option', 'textarea', 'fieldset', 'legend',
    'br', 'hr', 'meta', 'link', 'script', 'style',
    'html', 'head', 'body', 'title',
  ]);
  
  // Regex för att hitta JSX-taggar som börjar med liten bokstav
  const jsxTagRegex = /<([a-z][a-z0-9-]*)(?:\s|>|\/)/g;
  const closingTagRegex = /<\/([a-z][a-z0-9-]*)>/g;
  
  const foundTags = new Set<string>();
  
  // Find opening tags
  let match;
  while ((match = jsxTagRegex.exec(fileContent)) !== null) {
    const tag = match[1];
    if (!commonHtmlTags.has(tag)) {
      foundTags.add(tag);
    }
  }
  
  // Find closing tags
  while ((match = closingTagRegex.exec(fileContent)) !== null) {
    const tag = match[1];
    if (!commonHtmlTags.has(tag)) {
      foundTags.add(tag);
    }
  }
  
  // Check if we have imports that match (with capital letter)
  for (const tag of foundTags) {
    const capitalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1);
    
    // Check for import statements with capitalized version
    const hasImport = fileContent.includes(`import { ${capitalizedTag} }`) ||
                      fileContent.includes(`import ${capitalizedTag} `) ||
                      fileContent.includes(`import ${capitalizedTag} from`) ||
                      fileContent.includes(`import { ${capitalizedTag} } from`);
    
    if (hasImport) {
      errors.push(`Suspicious lowercase JSX tag: <${tag}>. Did you mean <${capitalizedTag}>?`);
    }
  }
  
  return errors;
}

/**
 * Validate component casing and auto-fix if enabled
 */
async function validateComponentCasing(
  projectDir: string,
  autoFix: boolean
): Promise<ValidationResult> {
  const errors: string[] = [];
  let fixApplied = false;
  const fixes: Array<{ file: string; fixes: number }> = [];
  
  // Common HTML tags that are lowercase by design
  const commonHtmlTags = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'button', 'input', 'form', 'label',
    'section', 'main', 'header', 'footer', 'nav', 'article', 'aside',
    'img', 'svg', 'path', 'circle', 'rect', 'line', 'polygon',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'select', 'option', 'textarea', 'fieldset', 'legend',
    'br', 'hr', 'meta', 'link', 'script', 'style',
    'html', 'head', 'body', 'title',
  ]);
  
  // Common component names that are often mistyped
  const commonComponents = [
    'card', 'badge', 'button', 'input', 'select', 'textarea',
    'modal', 'dialog', 'dropdown', 'menu', 'nav', 'sidebar',
    'header', 'footer', 'section', 'article', 'aside',
    'form', 'field', 'label', 'checkbox', 'radio', 'switch',
    'table', 'row', 'cell', 'column', 'thead', 'tbody',
    'list', 'item', 'grid', 'container', 'wrapper',
    'avatar', 'icon', 'image', 'link', 'text', 'heading',
    'spinner', 'loader', 'skeleton', 'alert', 'toast', 'notification',
    'tabs', 'tab', 'panel', 'accordion', 'collapse',
    'tooltip', 'popover', 'dropdown', 'menu',
  ];
  
  function scanFile(filePath: string) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) return;
    
    const relativePath = path.relative(projectDir, filePath);
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Check for casing errors
    const fileErrors = checkComponentCasing(content);
    if (fileErrors.length > 0) {
      errors.push(...fileErrors.map(e => `${relativePath}: ${e}`));
      
      // Auto-fix: Replace lowercase tags with capitalized versions
      if (autoFix) {
        let fixCount = 0;
        
        // Fix common components
        for (const component of commonComponents) {
          const capitalized = component.charAt(0).toUpperCase() + component.slice(1);
          
          // Check if component is imported (indicating it should be capitalized)
          const hasImport = content.includes(`import { ${capitalized} }`) ||
                          content.includes(`import ${capitalized} `) ||
                          content.includes(`import ${capitalized} from`) ||
                          content.includes(`import { ${capitalized} } from`);
          
          if (hasImport) {
            // Replace opening tags: <card> -> <Card>
            const openingRegex = new RegExp(`<${component}(?=\\s|>|/)`, 'g');
            const openingMatches = content.match(openingRegex);
            if (openingMatches) {
              content = content.replace(openingRegex, `<${capitalized}`);
              fixCount += openingMatches.length;
            }
            
            // Replace closing tags: </card> -> </Card>
            const closingRegex = new RegExp(`</${component}>`, 'g');
            const closingMatches = content.match(closingRegex);
            if (closingMatches) {
              content = content.replace(closingRegex, `</${capitalized}>`);
              fixCount += closingMatches.length;
            }
          }
        }
        
        // Generic fix: Find any lowercase tag that has a capitalized import
        const lowercaseTagRegex = /<([a-z][a-z0-9-]*)(?=\s|>|\/)/g;
        let tagMatch;
        const tagReplacements = new Map<string, string>();
        
        while ((tagMatch = lowercaseTagRegex.exec(content)) !== null) {
          const tag = tagMatch[1];
          const capitalized = tag.charAt(0).toUpperCase() + tag.slice(1);
          
          // Skip if it's a common HTML tag
          if (commonHtmlTags.has(tag)) continue;
          
          // Check if capitalized version is imported
          const hasImport = content.includes(`import { ${capitalized} }`) ||
                          content.includes(`import ${capitalized} `) ||
                          content.includes(`import ${capitalized} from`) ||
                          content.includes(`import { ${capitalized} } from`);
          
          if (hasImport && !tagReplacements.has(tag)) {
            tagReplacements.set(tag, capitalized);
          }
        }
        
        // Apply replacements
        for (const [lowercase, capitalized] of tagReplacements.entries()) {
          // Opening tags
          content = content.replace(
            new RegExp(`<${lowercase}(?=\\s|>|/)`, 'g'),
            `<${capitalized}`
          );
          // Closing tags
          content = content.replace(
            new RegExp(`</${lowercase}>`, 'g'),
            `</${capitalized}>`
          );
          fixCount += 2; // Approximate count
        }
        
        if (content !== originalContent) {
          fs.writeFileSync(filePath, content);
          fixes.push({ file: relativePath, fixes: fixCount });
          fixApplied = true;
        }
      }
    }
  }
  
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === '.next' || file.startsWith('.')) continue;
      
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDir(filePath);
      } else {
        scanFile(filePath);
      }
    }
  }
  
  // Scan common directories
  scanDir(path.join(projectDir, 'src'));
  scanDir(path.join(projectDir, 'app'));
  scanDir(path.join(projectDir, 'components'));
  
  // Log fixes if any were applied
  if (fixApplied && fixes.length > 0) {
    console.log('    🔧 Auto-fixed component casing:');
    fixes.forEach(({ file, fixes: count }) => {
      console.log(`      - ${file} (${count} fixes)`);
    });
  }
  
  return {
    check: 'component-casing',
    passed: errors.length === 0 || fixApplied,
    errors: errors.slice(0, 10), // Limit to first 10
    autoFixable: true,
    fixApplied,
  };
}

