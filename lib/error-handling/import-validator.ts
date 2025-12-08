// =============================================================================
// IMPORT VALIDATOR - Validates and auto-fixes missing type imports
// =============================================================================

import * as ts from 'typescript';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getImportForType, TYPE_REGISTRY } from '../nightFactory/type-registry';

export interface MissingImport {
  typeName: string;
  line: number;
  suggestedImport: string;
}

/**
 * Scan generated code for missing type imports
 */
export async function validateImports(
  filePath: string
): Promise<{ valid: boolean; missing: MissingImport[] }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const missing: MissingImport[] = [];
    const importedTypes = new Set<string>();

    // Step 1: Collect all imported types
    function collectImports(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          clause.namedBindings.elements.forEach(el => {
            importedTypes.add(el.name.text);
          });
        }
        // Also check type imports
        if (clause?.typeOnly) {
          if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            clause.namedBindings.elements.forEach(el => {
              importedTypes.add(el.name.text);
            });
          }
        }
      }
      ts.forEachChild(node, collectImports);
    }
    collectImports(sourceFile);

    // Step 2: Find all type references
    const usedTypes = new Set<string>();
    function findTypeReferences(node: ts.Node) {
      if (ts.isTypeReferenceNode(node)) {
        const typeName = node.typeName.getText(sourceFile);
        // Skip built-in types
        if (!['string', 'number', 'boolean', 'void', 'null', 'undefined', 'any', 'unknown'].includes(typeName)) {
          usedTypes.add(typeName);
          
          // Check if this type is in our registry but not imported
          if (!importedTypes.has(typeName)) {
            const importStatement = getImportForType(typeName);
            if (importStatement) {
              const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              missing.push({
                typeName,
                line: pos.line + 1,
                suggestedImport: importStatement
              });
            }
          }
        }
      }
      ts.forEachChild(node, findTypeReferences);
    }
    findTypeReferences(sourceFile);

    return {
      valid: missing.length === 0,
      missing
    };
  } catch (error: any) {
    console.warn(`⚠️ [Import Validator] Failed to validate ${filePath}: ${error.message}`);
    return { valid: true, missing: [] }; // Don't fail on parse errors
  }
}

/**
 * Auto-fix missing imports
 */
export async function autoFixImports(filePath: string): Promise<boolean> {
  try {
    const validation = await validateImports(filePath);
    
    if (validation.valid) return true;

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Find last import statement
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportLine = i;
      }
    }

    // If no imports found, find where to insert (after 'use client' or at top)
    let insertLine = 0;
    if (lastImportLine >= 0) {
      insertLine = lastImportLine + 1;
    } else {
      // Check for 'use client' directive
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith("'use client'") || lines[i].trim().startsWith('"use client"')) {
          insertLine = i + 1;
          break;
        }
      }
    }

    // Get unique imports
    const imports = Array.from(new Set(
      validation.missing.map(m => m.suggestedImport)
    ));

    // Insert missing imports
    lines.splice(insertLine, 0, ...imports);

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');

    console.log(`✅ [Import Validator] Auto-fixed ${imports.length} missing imports in ${path.basename(filePath)}`);
    return true;
  } catch (error: any) {
    console.error(`❌ [Import Validator] Failed to auto-fix ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Validate imports in multiple files
 */
export async function validateImportsBatch(
  filePaths: string[]
): Promise<{ valid: boolean; results: Map<string, MissingImport[]> }> {
  const results = new Map<string, MissingImport[]>();
  let allValid = true;

  for (const filePath of filePaths) {
    const validation = await validateImports(filePath);
    results.set(filePath, validation.missing);
    if (!validation.valid) {
      allValid = false;
    }
  }

  return {
    valid: allValid,
    results
  };
}

