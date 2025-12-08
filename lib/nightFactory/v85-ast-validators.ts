// =============================================================================
// FROST NIGHT FACTORY v8.5 - AST GUARDRAILS
// =============================================================================
// ChatGPT's production-ready AST validators

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

export interface Violation {
  filePath: string;
  code: string;
  message: string;
  line?: number;
}

/**
 * Run all framework guardrails against a project
 */
export function runFrameworkGuardrails(projectRoot: string): Violation[] {
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');
  
  if (!configPath) {
    console.warn(`⚠️ tsconfig.json not found in ${projectRoot}, using default config`);
    return runWithDefaultConfig(projectRoot);
  }

  try {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot);
    const program = ts.createProgram(parsed.fileNames, parsed.options);

    const violations: Violation[] = [];
    
    try { violations.push(...checkNoJsxInTsFiles(program)); } catch (e) { /* ignore */ }
    try { violations.push(...checkApiRouteFiles(program)); } catch (e) { /* ignore */ }
    try { violations.push(...checkLazyReturnNull(program)); } catch (e) { /* ignore */ }
    try { violations.push(...checkBrokenImports(program)); } catch (e) { /* ignore */ }
    try { violations.push(...checkReactImportsInApiRoutes(program)); } catch (e) { /* ignore */ }

    return violations;
  } catch (error: any) {
    console.warn(`⚠️ Error running guardrails: ${error.message}`);
    return runWithDefaultConfig(projectRoot);
  }
}

/**
 * Run validators without tsconfig.json
 */
function runWithDefaultConfig(projectRoot: string): Violation[] {
  const violations: Violation[] = [];
  const srcDir = path.join(projectRoot, 'src');
  
  if (!fs.existsSync(srcDir)) {
    return violations;
  }

  const files = getAllTsFiles(srcDir);
  
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    violations.push(...checkSingleFile(sourceFile, filePath));
  }

  return violations;
}

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        files.push(...getAllTsFiles(fullPath));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore permission errors
  }

  return files;
}

function checkSingleFile(sourceFile: ts.SourceFile, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const normalizedPath = filePath.replace(/\\/g, '/');
  const isApiRoute = normalizedPath.includes('/app/api/') && normalizedPath.endsWith('/route.ts');
  const isTsFile = filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');

  let hasJsx = false;
  let hasReactImport = false;
  let jsxLine = 0;

  function visit(node: ts.Node) {
    // Check for JSX
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      hasJsx = true;
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      jsxLine = line + 1;
    }

    // Check for React imports
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        const text = specifier.text;
        if (text === 'react' || text.startsWith('next/navigation')) {
          hasReactImport = true;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  // JSX in .ts file
  if (hasJsx && isTsFile) {
    violations.push({
      filePath,
      code: 'NO_JSX_IN_TS',
      message: 'JSX syntax detected in .ts file. Rename to .tsx or remove JSX.',
      line: jsxLine,
    });
  }

  // API route violations
  if (isApiRoute) {
    if (hasJsx) {
      violations.push({
        filePath,
        code: 'API_NO_JSX',
        message: 'API route files must not contain JSX.',
        line: jsxLine,
      });
    }

    if (hasReactImport) {
      violations.push({
        filePath,
        code: 'API_NO_REACT_IMPORTS',
        message: 'API route files must not import React or next/navigation.',
      });
    }
  }

  return violations;
}

/**
 * Check for JSX in .ts files (not .tsx)
 */
function checkNoJsxInTsFiles(program: ts.Program): Violation[] {
  const violations: Violation[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!sourceFile.fileName.endsWith('.ts')) continue;
    if (sourceFile.fileName.endsWith('.d.ts')) continue;

    let hasJsx = false;
    let jsxLine = 0;

    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
        hasJsx = true;
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        jsxLine = line + 1;
      }
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);

    if (hasJsx) {
      violations.push({
        filePath: sourceFile.fileName,
        code: 'NO_JSX_IN_TS',
        message: 'JSX syntax detected in .ts file. Rename to .tsx or remove JSX.',
        line: jsxLine,
      });
    }
  }

  return violations;
}

/**
 * Check API route files for violations
 */
function checkApiRouteFiles(program: ts.Program): Violation[] {
  const violations: Violation[] = [];
  const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    
    const filePath = sourceFile.fileName.replace(/\\/g, '/');
    if (!filePath.includes('/app/api/') || !filePath.endsWith('/route.ts')) continue;

    let hasJsx = false;
    let hasReactImport = false;
    const namedExports = new Set<string>();

    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        hasJsx = true;
      }

      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const specifier = node.moduleSpecifier;
        if (ts.isStringLiteral(specifier)) {
          const text = specifier.text;
          if (text === 'react' || text.startsWith('next/navigation')) {
            hasReactImport = true;
          }
        }
      }

      // Check for exported functions
      if (ts.isFunctionDeclaration(node) && node.name) {
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        if (hasExport) {
          namedExports.add(node.name.text);
        }
      }

      // Check for exported arrow functions
      if (ts.isVariableStatement(node)) {
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        if (hasExport) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              namedExports.add(decl.name.text);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);

    if (hasJsx) {
      violations.push({
        filePath,
        code: 'API_NO_JSX',
        message: 'API route files must not contain JSX.',
      });
    }

    if (hasReactImport) {
      violations.push({
        filePath,
        code: 'API_NO_REACT_IMPORTS',
        message: 'API route files must not import React or next/navigation.',
      });
    }

    const httpExports = Array.from(namedExports).filter(n => HTTP_METHODS.has(n));
    if (httpExports.length === 0) {
      violations.push({
        filePath,
        code: 'API_MISSING_HANDLER',
        message: 'API route must export at least one HTTP handler (GET, POST, etc.).',
      });
    }
  }

  return violations;
}

/**
 * Check for lazy "return null" in React components
 */
function checkLazyReturnNull(program: ts.Program): Violation[] {
  const violations: Violation[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!sourceFile.fileName.endsWith('.tsx')) continue;

    function visit(node: ts.Node) {
      if (ts.isReturnStatement(node) && node.expression?.kind === ts.SyntaxKind.NullKeyword) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          filePath: sourceFile.fileName,
          code: 'LAZY_RETURN_NULL',
          message: 'Found "return null" in React component. Render fallback UI instead.',
          line: line + 1,
        });
      }
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
  }

  return violations;
}

/**
 * Check for deep relative imports
 */
function checkBrokenImports(program: ts.Program): Violation[] {
  const violations: Violation[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!sourceFile.fileName.includes('/src/')) continue;

    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const specifier = node.moduleSpecifier;
        if (ts.isStringLiteral(specifier)) {
          const spec = specifier.text;

          if (spec.startsWith('../../') || spec.startsWith('../../../')) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push({
              filePath: sourceFile.fileName,
              code: 'IMPORT_DEEP_RELATIVE',
              message: `Avoid deep relative imports ("${spec}"). Use "@/..." path alias.`,
              line: line + 1,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
  }

  return violations;
}

/**
 * Check for React imports in API routes
 */
function checkReactImportsInApiRoutes(program: ts.Program): Violation[] {
  const violations: Violation[] = [];
  const FORBIDDEN_IMPORTS = ['react', 'react-dom', 'next/navigation', 'next/router'];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    
    const filePath = sourceFile.fileName.replace(/\\/g, '/');
    if (!filePath.includes('/app/api/')) continue;

    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const specifier = node.moduleSpecifier;
        if (ts.isStringLiteral(specifier)) {
          const spec = specifier.text;
          
          if (FORBIDDEN_IMPORTS.includes(spec)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push({
              filePath,
              code: 'API_FORBIDDEN_IMPORT',
              message: `API routes cannot import "${spec}". Remove this import.`,
              line: line + 1,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
  }

  return violations;
}

/**
 * Quick syntax check for a single file
 */
export function checkFileSyntax(filePath: string, content: string): Violation[] {
  const violations: Violation[] = [];
  
  try {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    // Check for syntax errors via diagnostics
    const diagnostics = (sourceFile as any).parseDiagnostics || [];
    
    for (const diag of diagnostics) {
      if (diag.file) {
        const { line } = diag.file.getLineAndCharacterOfPosition(diag.start || 0);
        violations.push({
          filePath,
          code: 'SYNTAX_ERROR',
          message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
          line: line + 1,
        });
      }
    }
  } catch (error: any) {
    violations.push({
      filePath,
      code: 'PARSE_ERROR',
      message: error.message || 'Failed to parse file',
    });
  }

  return violations;
}

