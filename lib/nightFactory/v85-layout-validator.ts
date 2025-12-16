// =============================================================================
// FROST NIGHT FACTORY v8.5 - LAYOUT CONTRACT VALIDATOR
// =============================================================================
// Validates layout components against their contracts

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { 
  LAYOUT_CONTRACTS, 
  getLayoutContract,
  isLayoutComponent,
  generateComponentFromContract 
} from './layout-contract';
import type { LayoutComponent } from './layout-contract';
import type { Violation } from './v85-ast-validators';

/**
 * Layout validation result
 */
export interface LayoutValidationResult {
  valid: boolean;
  violations: LayoutViolation[];
  fixableFiles: Map<string, string>; // path -> fixed content
}

/**
 * Layout-specific violation
 */
export interface LayoutViolation extends Violation {
  componentName: LayoutComponent;
  contractMismatch: boolean;
  missingProps: string[];
  extraProps: string[];
  suggestedFix: string;
}

/**
 * Validate all layout components in a project against contracts
 */
export function validateLayoutComponents(projectRoot: string): LayoutValidationResult {
  const layoutDir = path.join(projectRoot, 'src', 'components', 'layout');
  const violations: LayoutViolation[] = [];
  const fixableFiles = new Map<string, string>();
  
  if (!fs.existsSync(layoutDir)) {
    // No layout directory - not an error, just nothing to validate
    return { valid: true, violations: [], fixableFiles };
  }
  
  // Get all layout files
  const files = fs.readdirSync(layoutDir).filter(f => 
    f.endsWith('.tsx') || f.endsWith('.ts')
  );
  
  for (const file of files) {
    const filePath = path.join(layoutDir, file);
    const componentName = getComponentNameFromFile(file);
    
    if (!componentName || !isLayoutComponent(componentName)) {
      continue; // Not a contracted layout component
    }
    
    const contract = getLayoutContract(componentName);
    if (!contract) continue;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const validation = validateComponentAgainstContract(
      filePath,
      content,
      componentName,
      contract
    );
    
    if (!validation.valid) {
      violations.push(...validation.violations);
      
      // Generate fixed version from contract
      const fixedContent = generateComponentFromContract(contract);
      fixableFiles.set(filePath, fixedContent);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
    fixableFiles,
  };
}

/**
 * Get component name from filename
 */
function getComponentNameFromFile(filename: string): string | null {
  // Remove extension
  const name = filename.replace(/\.(tsx|ts)$/, '');
  
  // Convert to PascalCase
  return name
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Validate a single component against its contract
 */
function validateComponentAgainstContract(
  filePath: string,
  content: string,
  componentName: LayoutComponent,
  contract: typeof LAYOUT_CONTRACTS[0]
): { valid: boolean; violations: LayoutViolation[] } {
  const violations: LayoutViolation[] = [];
  
  try {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
    
    // Find the component function/interface
    const propsInterface = findPropsInterface(sourceFile, componentName);
    const componentFunction = findComponentFunction(sourceFile, componentName);
    
    if (!propsInterface && !componentFunction) {
      violations.push({
        filePath,
        code: 'LAYOUT_MISSING_COMPONENT',
        message: `Layout component ${componentName} not found in file`,
        componentName,
        contractMismatch: true,
        missingProps: Object.keys(contract.props),
        extraProps: [],
        suggestedFix: `Regenerate ${componentName} from layout contract`,
      });
      return { valid: false, violations };
    }
    
    // Check props against contract
    const foundProps = propsInterface 
      ? extractPropsFromInterface(propsInterface, sourceFile)
      : extractPropsFromFunction(componentFunction!, sourceFile);
    
    const contractProps = Object.keys(contract.props);
    const requiredProps = Object.entries(contract.props)
      .filter(([_, def]) => !def.optional)
      .map(([name]) => name);
    
    // Find missing required props
    const missingProps = requiredProps.filter(p => !foundProps.includes(p));
    
    // Find extra props not in contract
    const extraProps = foundProps.filter(p => !contractProps.includes(p));
    
    if (missingProps.length > 0 || extraProps.length > 0) {
      violations.push({
        filePath,
        code: 'LAYOUT_CONTRACT_MISMATCH',
        message: `${componentName} props do not match contract`,
        componentName,
        contractMismatch: true,
        missingProps,
        extraProps,
        suggestedFix: `Regenerate ${componentName} from layout contract. Missing: ${missingProps.join(', ')}. Extra: ${extraProps.join(', ')}`,
      });
    }
    
  } catch (error: any) {
    violations.push({
      filePath,
      code: 'LAYOUT_PARSE_ERROR',
      message: `Failed to parse ${componentName}: ${error.message}`,
      componentName,
      contractMismatch: true,
      missingProps: [],
      extraProps: [],
      suggestedFix: `Regenerate ${componentName} from layout contract`,
    });
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Find props interface in source file
 */
function findPropsInterface(
  sourceFile: ts.SourceFile,
  componentName: string
): ts.InterfaceDeclaration | null {
  const propsName = `${componentName}Props`;
  
  let result: ts.InterfaceDeclaration | null = null;
  
  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === propsName) {
      result = node;
    }
    ts.forEachChild(node, visit);
  }
  
  ts.forEachChild(sourceFile, visit);
  return result;
}

/**
 * Find component function in source file
 */
function findComponentFunction(
  sourceFile: ts.SourceFile,
  componentName: string
): ts.FunctionDeclaration | ts.ArrowFunction | null {
  let result: ts.FunctionDeclaration | ts.ArrowFunction | null = null;
  
  function visit(node: ts.Node) {
    // Check function declaration
    if (ts.isFunctionDeclaration(node) && node.name?.text === componentName) {
      result = node;
    }
    
    // Check variable declaration with arrow function
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === componentName) {
          if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
            result = decl.initializer;
          }
        }
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  ts.forEachChild(sourceFile, visit);
  return result;
}

/**
 * Extract prop names from interface
 */
function extractPropsFromInterface(
  node: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile
): string[] {
  const props: string[] = [];
  
  for (const member of node.members) {
    if (ts.isPropertySignature(member) && member.name) {
      if (ts.isIdentifier(member.name)) {
        props.push(member.name.text);
      }
    }
  }
  
  return props;
}

/**
 * Extract prop names from function parameters
 */
function extractPropsFromFunction(
  node: ts.FunctionDeclaration | ts.ArrowFunction,
  sourceFile: ts.SourceFile
): string[] {
  const props: string[] = [];
  
  if (node.parameters.length > 0) {
    const firstParam = node.parameters[0];
    
    // Check for destructured props
    if (ts.isObjectBindingPattern(firstParam.name)) {
      for (const element of firstParam.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          props.push(element.name.text);
        }
      }
    }
  }
  
  return props;
}

/**
 * Auto-fix layout components by regenerating from contract
 */
export async function autoFixLayoutComponents(
  projectRoot: string
): Promise<{ fixed: string[]; failed: string[] }> {
  const validation = validateLayoutComponents(projectRoot);
  const fixed: string[] = [];
  const failed: string[] = [];
  
  for (const [filePath, fixedContent] of validation.fixableFiles.entries()) {
    try {
      await fs.promises.writeFile(filePath, fixedContent, 'utf-8');
      fixed.push(filePath);
      console.log(`✅ Fixed ${path.basename(filePath)} from contract`);
    } catch (error) {
      failed.push(filePath);
      console.error(`❌ Failed to fix ${path.basename(filePath)}`);
    }
  }
  
  return { fixed, failed };
}

/**
 * Check if a file is a layout component file
 */
export function isLayoutComponentFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.includes('/components/layout/') ||
         normalizedPath.includes('/layout/');
}

/**
 * Get the component name from a file path
 */
export function getLayoutComponentNameFromPath(filePath: string): LayoutComponent | null {
  const filename = path.basename(filePath);
  const name = getComponentNameFromFile(filename);
  
  if (name && isLayoutComponent(name)) {
    return name;
  }
  
  return null;
}

