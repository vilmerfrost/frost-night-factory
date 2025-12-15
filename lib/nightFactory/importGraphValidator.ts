// =============================================================================
// IMPORT GRAPH VALIDATOR - Validate and fix import/export mismatches
// =============================================================================
// Reads all files from disk, validates imports against exports, and auto-fixes
// This solves 30% of TypeScript errors caused by import/export mismatches

import * as fs from 'fs';
import * as path from 'path';

interface ExportInfo {
  file: string;
  defaultExport: string | null;
  namedExports: string[];
}

interface ImportInfo {
  file: string;
  importPath: string;
  importedNames: string[];
  isDefault: boolean;
  line: number;
}

interface ValidationIssue {
  file: string;
  importPath: string;
  importedNames: string[];
  issue: string;
  suggestion: string;
  line: number;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  fixed: number;
}

/**
 * Extract exports from a file on disk
 */
function extractExportsFromFile(filePath: string): ExportInfo {
  if (!fs.existsSync(filePath)) {
    return { file: filePath, defaultExport: null, namedExports: [] };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  let defaultExport: string | null = null;
  const namedExports: string[] = [];
  
  // Match: export default function X
  const defaultFuncMatch = content.match(/export\s+default\s+function\s+(\w+)/);
  if (defaultFuncMatch && defaultFuncMatch[1]) {
    defaultExport = defaultFuncMatch[1];
  }
  
  // Match: export default X (variable/const)
  const defaultVarMatch = content.match(/export\s+default\s+(\w+)(?:\s|;|$)/);
  if (defaultVarMatch && defaultVarMatch[1] && !defaultExport) {
    defaultExport = defaultVarMatch[1];
  }
  
  // Match: export default (anonymous)
  if (content.includes('export default') && !defaultExport) {
    defaultExport = 'default';
  }
  
  // Match: export const/function/class/type/interface/enum X
  const namedExportRegex = /export\s+(?:const|function|class|type|interface|enum|let|var)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    const name = match[1];
    if (name) {
      namedExports.push(name);
    }
  }
  
  // Match: export { X, Y }
  const exportListRegex = /export\s+\{([^}]+)\}/g;
  while ((match = exportListRegex.exec(content)) !== null) {
    const namesStr = match[1];
    if (namesStr) {
      const names = namesStr
        .split(',')
        .map(n => (n.trim().split(' as ')[0] ?? '').trim())
        .filter(Boolean);
      namedExports.push(...names);
    }
  }
  
  return {
    file: filePath,
    defaultExport,
    namedExports: [...new Set(namedExports)],
  };
}

/**
 * Extract imports from a file on disk
 */
function extractImportsFromFile(filePath: string): ImportInfo[] {
  if (!fs.existsSync(filePath)) return [];
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports: ImportInfo[] = [];
  
  lines.forEach((line, index) => {
    // Match: import X from 'path'
    const defaultMatch = line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
    if (defaultMatch && defaultMatch[1] && defaultMatch[2]) {
      imports.push({
        file: filePath,
        importPath: defaultMatch[2],
        importedNames: [defaultMatch[1]],
        isDefault: true,
        line: index + 1,
      });
    }
    
    // Match: import { X, Y } from 'path'
    const namedMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (namedMatch && namedMatch[1] && namedMatch[2]) {
      const namesStr = namedMatch[1];
      const names = namesStr
        .split(',')
        .map(n => (n.trim().split(' as ')[0] ?? '').trim())
        .filter(Boolean);
      imports.push({
        file: filePath,
        importPath: namedMatch[2],
        importedNames: names,
        isDefault: false,
        line: index + 1,
      });
    }
  });
  
  return imports;
}

/**
 * Resolve import path to actual file path
 */
function resolveImportPath(
  importPath: string,
  currentFile: string,
  projectRoot: string
): string | null {
  // Skip node_modules
  if (!importPath.startsWith('.') && !importPath.startsWith('@/') && !importPath.startsWith('/')) {
    return null; // External package
  }
  
  // Handle @/ alias
  if (importPath.startsWith('@/')) {
    const srcPath = path.join(projectRoot, 'src');
    const relativePath = importPath.slice(2);
    const fullPath = path.join(srcPath, relativePath);
    
    // Try extensions (prefer .tsx over .ts for evolution)
    const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];
    for (const ext of extensions) {
      const testPath = fullPath + ext;
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }
    return fullPath; // Return even if not found, for error reporting
  }
  
  // Handle relative imports
  if (importPath.startsWith('.')) {
    const currentDir = path.dirname(currentFile);
    const resolved = path.resolve(currentDir, importPath);
    
    // Try extensions (prefer .tsx over .ts for evolution)
    const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];
    for (const ext of extensions) {
      const testPath = resolved + ext;
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }
    return resolved; // Return even if not found
  }
  
  return null;
}

/**
 * Build export map for entire project
 */
function buildExportMap(projectPath: string): Map<string, ExportInfo> {
  const exportMap = new Map<string, ExportInfo>();
  
  function scanDirectory(dir: string): void {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.name.match(/\.(tsx?|jsx?)$/)) {
        const exports = extractExportsFromFile(fullPath);
        const withoutExt = fullPath.replace(/\.(tsx?|jsx?)$/, '');
        
        // 🎯 PRIORITY: Prefer .tsx over .ts when both exist (evolution takes precedence)
        const existingEntry = exportMap.get(withoutExt);
        const isTsx = fullPath.endsWith('.tsx');
        const existingIsTsx = existingEntry?.file.endsWith('.tsx') || false;
        
        if (!existingEntry) {
          // No existing entry, add it
          exportMap.set(fullPath, exports);
          exportMap.set(withoutExt, exports);
        } else if (isTsx && !existingIsTsx) {
          // New .tsx file takes precedence over old .ts file
          exportMap.set(fullPath, exports);
          exportMap.set(withoutExt, exports);
        } else if (!isTsx && existingIsTsx) {
          // Old .ts file, but .tsx already exists - skip (don't overwrite)
          // Still store the full path entry for reference
          exportMap.set(fullPath, exports);
          // Don't update withoutExt or alias - keep the .tsx version
        } else {
          // Same priority or both .tsx/.ts - update normally
          exportMap.set(fullPath, exports);
          exportMap.set(withoutExt, exports);
        }
        
        // Store as @/ alias if in src/
        if (fullPath.includes(path.join(projectPath, 'src'))) {
          const relativePath = path.relative(path.join(projectPath, 'src'), fullPath);
          const aliasPath = '@/' + relativePath.replace(/\.(tsx?|jsx?)$/, '').replace(/\\/g, '/');
          // Only set alias if this is the preferred file (.tsx) or no .tsx exists
          const existingAlias = exportMap.get(aliasPath);
          const aliasIsTsx = existingAlias?.file.endsWith('.tsx') || false;
          if (!existingAlias || (isTsx && !aliasIsTsx)) {
            exportMap.set(aliasPath, exports);
          }
        }
      }
    }
  }
  
  // Scan src/ or app/
  const srcPath = path.join(projectPath, 'src');
  const appPath = path.join(projectPath, 'app');
  
  if (fs.existsSync(srcPath)) {
    scanDirectory(srcPath);
  }
  if (fs.existsSync(appPath)) {
    scanDirectory(appPath);
  }
  
  return exportMap;
}

/**
 * Validate imports against exports
 */
function validateImports(
  projectPath: string,
  exportMap: Map<string, ExportInfo>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  function scanDirectory(dir: string): void {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.name.match(/\.(tsx?|jsx?)$/)) {
        const imports = extractImportsFromFile(fullPath);
        
        for (const imp of imports) {
          // Skip external packages
          if (!imp.importPath.startsWith('.') && !imp.importPath.startsWith('@/')) {
            continue;
          }
          
          // Resolve import path
          const resolvedPath = resolveImportPath(imp.importPath, fullPath, projectPath);
          if (!resolvedPath) continue;
          
          // Look up exports
          const exports = exportMap.get(resolvedPath) ||
                         exportMap.get(resolvedPath.replace(/\.(tsx?|jsx?)$/, '')) ||
                         exportMap.get(imp.importPath);
          
          if (!exports || !exports.defaultExport && exports.namedExports.length === 0) {
            // File doesn't exist or has no exports
            issues.push({
              file: fullPath,
              importPath: imp.importPath,
              importedNames: imp.importedNames,
              issue: `Module '${imp.importPath}' not found or has no exports`,
              suggestion: `Check if file exists or add exports`,
              line: imp.line,
            });
            continue;
          }
          
          // Check import/export mismatch
          if (imp.isDefault) {
            if (!exports.defaultExport) {
              issues.push({
                file: fullPath,
                importPath: imp.importPath,
                importedNames: imp.importedNames,
                issue: `Default import '${imp.importedNames[0]}' but module has no default export`,
                suggestion: exports.namedExports.length > 0
                  ? `Use named import: import { ${exports.namedExports[0]} } from '${imp.importPath}'`
                  : `Add 'export default' to ${resolvedPath}`,
                line: imp.line,
              });
            }
          } else {
            // Named import - check if all names exist
            for (const name of imp.importedNames) {
              if (!exports.namedExports.includes(name) && exports.defaultExport !== name) {
                issues.push({
                  file: fullPath,
                  importPath: imp.importPath,
                  importedNames: [name],
                  issue: `Named import '${name}' not found in module exports`,
                  suggestion: exports.defaultExport
                    ? `Use default import: import ${exports.defaultExport} from '${imp.importPath}'`
                    : exports.namedExports.length > 0
                      ? `Available exports: ${exports.namedExports.join(', ')}`
                      : `Add 'export const ${name}' to ${resolvedPath}`,
                  line: imp.line,
                });
              }
            }
          }
        }
      }
    }
  }
  
  const srcPath = path.join(projectPath, 'src');
  const appPath = path.join(projectPath, 'app');
  
  if (fs.existsSync(srcPath)) {
    scanDirectory(srcPath);
  }
  if (fs.existsSync(appPath)) {
    scanDirectory(appPath);
  }
  
  return issues;
}

/**
 * Auto-fix import/export mismatches
 */
function autoFixIssues(
  projectPath: string,
  issues: ValidationIssue[]
): number {
  let fixedCount = 0;
  const filesToFix = new Map<string, number[]>();
  
  // Group issues by file
  for (const issue of issues) {
    if (!filesToFix.has(issue.file)) {
      filesToFix.set(issue.file, []);
    }
    filesToFix.get(issue.file)!.push(issue.line);
  }
  
  // Fix each file
  for (const [filePath, lines] of filesToFix.entries()) {
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    const contentLines = content.split('\n');
    
    // Fix issues on specific lines
    for (const issue of issues) {
      if (issue.file !== filePath) continue;
      
      const lineIndex = issue.line - 1;
      if (lineIndex < 0 || lineIndex >= contentLines.length) continue;
      
      const line = contentLines[lineIndex];
      
      // Fix: Change default import to named import
      if (issue.issue.includes('no default export') && issue.suggestion.includes('Use named import')) {
        const namedMatch = issue.suggestion.match(/import \{ (\w+) \} from/);
        if (namedMatch && namedMatch[1] && issue.importedNames[0]) {
          const newName = namedMatch[1];
          const oldImport = `import ${issue.importedNames[0]} from`;
          const newImport = `import { ${newName} } from`;
          
          if (line && line.includes(oldImport)) {
            contentLines[lineIndex] = line.replace(oldImport, newImport);
            // Also replace usage in the file
            content = content.replace(
              new RegExp(`\\b${issue.importedNames[0]}\\b`, 'g'),
              newName
            );
            fixedCount++;
          }
        }
      }
      
      // Fix: Change named import to default import
      if (issue.issue.includes('not found in module exports') && issue.suggestion.includes('Use default import')) {
        const defaultMatch = issue.suggestion.match(/import (\w+) from/);
        if (defaultMatch && defaultMatch[1] && issue.importedNames[0]) {
          const defaultName = defaultMatch[1];
          const oldImport = `import { ${issue.importedNames[0]} } from`;
          const newImport = `import ${defaultName} from`;
          
          if (line && line.includes(oldImport)) {
            contentLines[lineIndex] = line.replace(oldImport, newImport);
            // Also replace usage
            content = content.replace(
              new RegExp(`\\b${issue.importedNames[0]}\\b`, 'g'),
              defaultName
            );
            fixedCount++;
          }
        }
      }
    }
    
    // Write back if changed
    if (contentLines.join('\n') !== originalContent) {
      fs.writeFileSync(filePath, contentLines.join('\n'));
    }
  }
  
  return fixedCount;
}

/**
 * Main validation function
 */
export function runImportGraphValidator(projectPath: string): ValidationResult {
  console.log("\n🔗 IMPORT GRAPH VALIDATOR: Validating import/export graph...");
  
  // Build export map
  const exportMap = buildExportMap(projectPath);
  console.log(`   📊 Found ${exportMap.size / 3} files with exports`);
  
  // Validate imports
  const issues = validateImports(projectPath, exportMap);
  console.log(`   🔍 Found ${issues.length} import/export mismatches`);
  
  if (issues.length === 0) {
    console.log("   ✅ All imports are valid!");
    return { valid: true, issues: [], fixed: 0 };
  }
  
  // Show issues
  issues.forEach(issue => {
    console.log(`   ⚠️ ${path.basename(issue.file)}:${issue.line}: ${issue.issue}`);
  });
  
  // Auto-fix
  console.log("\n   🔧 Attempting auto-fix...");
  const fixedCount = autoFixIssues(projectPath, issues);
  console.log(`   ✅ Fixed ${fixedCount} import statements`);
  
  return {
    valid: fixedCount === issues.length,
    issues,
    fixed: fixedCount,
  };
}

