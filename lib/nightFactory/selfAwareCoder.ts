// =============================================================================
// SELF-AWARE CODER - Validate imports before writing
// =============================================================================
// After AI generates code, this validates that all imports are correct
// BEFORE writing to disk, preventing broken builds from the start

import * as fs from 'fs';
import * as path from 'path';

export interface ImportValidation {
  file: string;
  importPath: string;
  importedNames: string[];
  isValid: boolean;
  issue?: string;
  suggestion?: string;
}

export interface ExportInfo {
  file: string;
  defaultExport: string | null;
  namedExports: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ImportValidation[];
  exports: ExportInfo[];
  fixes: { file: string; content: string }[];
}

/**
 * Extract all imports from code content
 */
export function extractImportsFromCode(content: string): {
  path: string;
  names: string[];
  isDefault: boolean;
  isType: boolean;
  fullStatement: string;
}[] {
  const imports: {
    path: string;
    names: string[];
    isDefault: boolean;
    isType: boolean;
    fullStatement: string;
  }[] = [];
  
  // Match: import X from 'path'
  const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = defaultImportRegex.exec(content)) !== null) {
    imports.push({
      path: match[2],
      names: [match[1]],
      isDefault: true,
      isType: false,
      fullStatement: match[0],
    });
  }
  
  // Match: import { X, Y } from 'path'
  const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = namedImportRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim()).filter(Boolean);
    imports.push({
      path: match[2],
      names,
      isDefault: false,
      isType: match[0].includes('import type'),
      fullStatement: match[0],
    });
  }
  
  // Match: import type { X } from 'path'
  const typeImportRegex = /import\s+type\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = typeImportRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim()).filter(Boolean);
    imports.push({
      path: match[2],
      names,
      isDefault: false,
      isType: true,
      fullStatement: match[0],
    });
  }
  
  return imports;
}

/**
 * Extract all exports from code content
 */
export function extractExportsFromCode(content: string): ExportInfo {
  let defaultExport: string | null = null;
  const namedExports: string[] = [];
  
  // Match: export default function X
  const defaultFuncMatch = content.match(/export\s+default\s+function\s+(\w+)/);
  if (defaultFuncMatch) {
    defaultExport = defaultFuncMatch[1];
  }
  
  // Match: export default X
  const defaultMatch = content.match(/export\s+default\s+(\w+)/);
  if (defaultMatch && !defaultExport) {
    defaultExport = defaultMatch[1];
  }
  
  // Match: export default (anonymous)
  if (content.includes('export default') && !defaultExport) {
    defaultExport = 'default';
  }
  
  // Match: export const/function/class X
  const namedExportRegex = /export\s+(const|function|class|type|interface|enum)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    namedExports.push(match[2]);
  }
  
  // Match: export { X, Y }
  const exportListRegex = /export\s+\{([^}]+)\}/g;
  while ((match = exportListRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim()).filter(Boolean);
    namedExports.push(...names);
  }
  
  return {
    file: '',
    defaultExport,
    namedExports: [...new Set(namedExports)],
  };
}

/**
 * Build an export map from generated files
 */
export function buildExportMap(
  files: { path: string; content: string }[]
): Map<string, ExportInfo> {
  const exportMap = new Map<string, ExportInfo>();
  
  for (const file of files) {
    if (!file.path.match(/\.(tsx?|jsx?)$/)) continue;
    
    const exports = extractExportsFromCode(file.content);
    exports.file = file.path;
    
    // Store with various path formats for lookup
    exportMap.set(file.path, exports);
    
    // Also store without extension
    const withoutExt = file.path.replace(/\.(tsx?|jsx?)$/, '');
    exportMap.set(withoutExt, exports);
    
    // Also store as @/ alias
    if (file.path.startsWith('src/')) {
      const aliasPath = '@/' + file.path.slice(4).replace(/\.(tsx?|jsx?)$/, '');
      exportMap.set(aliasPath, exports);
    }
  }
  
  return exportMap;
}

/**
 * Validate imports against export map
 */
export function validateImports(
  files: { path: string; content: string }[],
  exportMap: Map<string, ExportInfo>
): ImportValidation[] {
  const issues: ImportValidation[] = [];
  
  for (const file of files) {
    if (!file.path.match(/\.(tsx?|jsx?)$/)) continue;
    
    const imports = extractImportsFromCode(file.content);
    
    for (const imp of imports) {
      // Skip node_modules imports
      if (!imp.path.startsWith('.') && !imp.path.startsWith('@/')) {
        continue;
      }
      
      // Resolve the import path
      let resolvedPath = imp.path;
      if (imp.path.startsWith('@/')) {
        resolvedPath = 'src/' + imp.path.slice(2);
      } else if (imp.path.startsWith('.')) {
        // Relative import - resolve from current file
        const currentDir = path.dirname(file.path);
        resolvedPath = path.join(currentDir, imp.path).replace(/\\/g, '/');
      }
      
      // Look up in export map
      const exports = exportMap.get(resolvedPath) || 
                      exportMap.get(resolvedPath + '.tsx') ||
                      exportMap.get(resolvedPath + '.ts') ||
                      exportMap.get(imp.path);
      
      if (!exports) {
        // File doesn't exist in our generated files
        issues.push({
          file: file.path,
          importPath: imp.path,
          importedNames: imp.names,
          isValid: false,
          issue: `Module '${imp.path}' not found in generated files`,
          suggestion: `Create the file or check if it's a node_module`,
        });
        continue;
      }
      
      // Check if import style matches export style
      if (imp.isDefault) {
        if (!exports.defaultExport) {
          issues.push({
            file: file.path,
            importPath: imp.path,
            importedNames: imp.names,
            isValid: false,
            issue: `Default import '${imp.names[0]}' but module has no default export`,
            suggestion: exports.namedExports.length > 0 
              ? `Use named import: import { ${exports.namedExports[0]} } from '${imp.path}'`
              : `Add 'export default' to ${resolvedPath}`,
          });
        }
      } else {
        // Named import - check if all names are exported
        for (const name of imp.names) {
          if (!exports.namedExports.includes(name) && exports.defaultExport !== name) {
            issues.push({
              file: file.path,
              importPath: imp.path,
              importedNames: [name],
              isValid: false,
              issue: `Named import '${name}' not found in module exports`,
              suggestion: exports.defaultExport 
                ? `Use default import: import ${exports.defaultExport} from '${imp.path}'`
                : exports.namedExports.length > 0
                  ? `Available exports: ${exports.namedExports.join(', ')}`
                  : `Add 'export const ${name}' to ${resolvedPath}`,
            });
          }
        }
      }
    }
  }
  
  return issues;
}

/**
 * Auto-fix import/export mismatches
 */
export function autoFixImportExportMismatches(
  files: { path: string; content: string }[],
  issues: ImportValidation[]
): { path: string; content: string }[] {
  const fixedFiles = new Map<string, string>();
  
  // Initialize with original content
  for (const file of files) {
    fixedFiles.set(file.path, file.content);
  }
  
  for (const issue of issues) {
    if (!issue.suggestion) continue;
    
    let content = fixedFiles.get(issue.file);
    if (!content) continue;
    
    // Fix: Change default import to named import
    if (issue.issue?.includes('no default export') && issue.suggestion.includes('Use named import')) {
      const namedImportMatch = issue.suggestion.match(/import \{ (\w+) \} from/);
      if (namedImportMatch) {
        const oldImport = `import ${issue.importedNames[0]} from '${issue.importPath}'`;
        const newImport = `import { ${namedImportMatch[1]} } from '${issue.importPath}'`;
        content = content.replace(oldImport, newImport);
        
        // Also replace usage if name changed
        if (issue.importedNames[0] !== namedImportMatch[1]) {
          const usageRegex = new RegExp(`\\b${issue.importedNames[0]}\\b`, 'g');
          content = content.replace(usageRegex, namedImportMatch[1]);
        }
      }
    }
    
    // Fix: Change named import to default import
    if (issue.issue?.includes('not found in module exports') && issue.suggestion.includes('Use default import')) {
      const defaultName = issue.suggestion.match(/import (\w+) from/)?.[1];
      if (defaultName) {
        // Find the full import statement
        const namedImportRegex = new RegExp(
          `import\\s+\\{[^}]*\\b${issue.importedNames[0]}\\b[^}]*\\}\\s+from\\s+['"]${issue.importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`
        );
        const match = content.match(namedImportRegex);
        if (match) {
          const newImport = `import ${defaultName} from '${issue.importPath}'`;
          content = content.replace(match[0], newImport);
          
          // Replace usage
          if (issue.importedNames[0] !== defaultName) {
            const usageRegex = new RegExp(`\\b${issue.importedNames[0]}\\b`, 'g');
            content = content.replace(usageRegex, defaultName);
          }
        }
      }
    }
    
    fixedFiles.set(issue.file, content);
  }
  
  return Array.from(fixedFiles.entries()).map(([path, content]) => ({ path, content }));
}

/**
 * Main validation function - run after AI generates code
 */
export function runSelfAwareValidation(
  files: { path: string; content: string }[]
): ValidationResult {
  console.log("\n🧠 SELF-AWARE CODER: Validating generated code...");
  
  // Build export map
  const exportMap = buildExportMap(files);
  console.log(`   Found ${exportMap.size / 2} files with exports`);
  
  // Validate imports
  const issues = validateImports(files, exportMap);
  console.log(`   Found ${issues.length} import issues`);
  
  if (issues.length > 0) {
    console.log("\n   Issues found:");
    issues.forEach(i => {
      console.log(`      ❌ ${i.file}: ${i.issue}`);
      if (i.suggestion) {
        console.log(`         💡 ${i.suggestion}`);
      }
    });
    
    // Auto-fix
    console.log("\n   🔧 Attempting auto-fix...");
    const fixedFiles = autoFixImportExportMismatches(files, issues);
    
    // Re-validate
    const remainingIssues = validateImports(fixedFiles, buildExportMap(fixedFiles));
    console.log(`   Remaining issues after fix: ${remainingIssues.length}`);
    
    return {
      valid: remainingIssues.length === 0,
      issues: remainingIssues,
      exports: Array.from(exportMap.values()),
      fixes: fixedFiles,
    };
  }
  
  console.log("   ✅ All imports are valid!");
  
  return {
    valid: true,
    issues: [],
    exports: Array.from(exportMap.values()),
    fixes: files,
  };
}

/**
 * Generate a report of all exports for AI context
 */
export function generateExportReport(files: { path: string; content: string }[]): string {
  const exportMap = buildExportMap(files);
  
  const lines: string[] = ['=== EXPORT MAP ==='];
  
  for (const [filePath, exports] of exportMap) {
    if (!filePath.includes('.')) continue; // Skip alias entries
    
    const exportList: string[] = [];
    if (exports.defaultExport) {
      exportList.push(`default: ${exports.defaultExport}`);
    }
    if (exports.namedExports.length > 0) {
      exportList.push(`named: { ${exports.namedExports.join(', ')} }`);
    }
    
    if (exportList.length > 0) {
      lines.push(`${filePath}: ${exportList.join(', ')}`);
    }
  }
  
  return lines.join('\n');
}

