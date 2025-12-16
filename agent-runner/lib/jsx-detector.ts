// agent-runner/lib/jsx-detector.ts
/**
 * ✅ IMPROVED JSX Detector - AST-based detection (no false positives)
 * 
 * Uses TypeScript compiler API AST to detect JSX nodes (JsxElement, JsxSelfClosingElement, JsxFragment).
 * This prevents false positives from TypeScript generics like Promise<InvoiceData> or Array<T>.
 */

import * as ts from "typescript";
import { containsJsxAst } from './nightFactory/jsxAst';

/**
 * ✅ PRIMARY: AST-based JSX detection (no false positives on generics)
 * 
 * @param filePath - File path for source file context
 * @param code - File content to check
 * @returns true if file contains real JSX syntax (not generics)
 */
export function hasRealJsx(filePath: string, code: string): boolean {
  // Quick guard: if no <, definitely no JSX
  if (!code.includes("<")) return false;
  
  // Use AST-based detection (no false positives)
  return containsJsxAst(filePath, code);
}

/**
 * Check if code contains actual JSX syntax (not false positives)
 * 
 * ✅ DEPRECATED: Use hasRealJsx() instead for AST-based detection
 * Kept for backward compatibility
 * 
 * Strategy:
 * 1. Skip TypeScript generics (<T>, <Result<T>>, etc.)
 * 2. Skip content inside strings and comments
 * 3. Only match JSX patterns that are likely real JSX
 */
export function hasRealJsxSyntax(code: string): boolean {
  // Remove strings and comments to avoid false positives
  const withoutStringsAndComments = removeStringsAndComments(code);
  
  // Pattern 1: JSX elements with opening and closing tags
  // Match: <Component>...</Component> or <div>...</div>
  // But NOT: <T> (generic) or <string> (generic)
  const jsxElementPattern = /<([A-Z][A-Za-z0-9]*|div|span|p|button|input|form|a|img|ul|ol|li|h[1-6])[^>]*>[\s\S]*?<\/\1>/;
  if (jsxElementPattern.test(withoutStringsAndComments)) {
    return true;
  }
  
  // Pattern 2: Self-closing JSX elements
  // Match: <Component /> or <img src="..." />
  // But NOT: <T> (generic) - generics don't have spaces before />
  const selfClosingJsxPattern = /<([A-Z][A-Za-z0-9]*|div|span|p|button|input|form|a|img|ul|ol|li|h[1-6])[^>]*\s+\/>/;
  if (selfClosingJsxPattern.test(withoutStringsAndComments)) {
    return true;
  }
  
  // Pattern 3: JSX fragments
  // Match: <>...</> or <React.Fragment>...</React.Fragment>
  const jsxFragmentPattern = /<>\s*[\s\S]*?<\/>|<React\.Fragment>[\s\S]*?<\/React\.Fragment>/;
  if (jsxFragmentPattern.test(withoutStringsAndComments)) {
    return true;
  }
  
  // Pattern 4: JSX in return statements (most common case)
  // Match: return <Component /> or return (<div>...</div>)
  // But NOT: return <T>() (generic function call)
  const returnJsxPattern = /return\s*\(?\s*<([A-Z][A-Za-z0-9]*|div|span|p|button|input|form|a|img|ul|ol|li|h[1-6])/;
  if (returnJsxPattern.test(withoutStringsAndComments)) {
    // Double-check: make sure it's not a generic function call
    const match = withoutStringsAndComments.match(returnJsxPattern);
    if (match) {
      const afterMatch = withoutStringsAndComments.slice(match.index! + match[0].length);
      // If we see /> or > followed by content, it's JSX
      // If we see > followed immediately by (, it's likely a generic
      if (/\/>|>[\s\S]{1,100}<\//.test(afterMatch)) {
        return true;
      }
    }
  }
  
  // Pattern 5: JSX attributes (className, onClick, etc.)
  // Match: <Component className="..." onClick={...} />
  const jsxAttributePattern = /<(?:[A-Z][A-Za-z0-9]*|div|span|p|button|input|form|a|img|ul|ol|li|h[1-6])[^>]*(?:className|onClick|onSubmit|onChange|style|id|key|ref)\s*=/;
  if (jsxAttributePattern.test(withoutStringsAndComments)) {
    return true;
  }
  
  return false;
}

/**
 * Remove strings and comments from code to avoid false positives
 */
function removeStringsAndComments(code: string): string {
  let result = code;
  
  // Remove single-line comments
  result = result.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove template literals (backticks)
  result = result.replace(/`[\s\S]*?`/g, '');
  
  // Remove single-quoted strings
  result = result.replace(/'[^']*'/g, '');
  
  // Remove double-quoted strings
  result = result.replace(/"[^"]*"/g, '');
  
  return result;
}

import { isSrcLibFile } from './path-rules';

/**
 * Check if a file path is a lib file that should never contain JSX
 * ✅ Uses centralized path-rules for consistency
 */
export function isLibFile(filePath: string): boolean {
  return isSrcLibFile(filePath);
}

/**
 * Check if code needs JSX sanitization (lib file with JSX)
 * ✅ Uses AST-based detection to avoid false positives
 */
export function needsJsxSanitization(filePath: string, code: string): boolean {
  const isLib = isLibFile(filePath);
  const isTsFile = filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
  const hasJsx = hasRealJsx(filePath, code); // ✅ Use AST-based detection
  
  return isLib && isTsFile && hasJsx;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use hasRealJsxSyntax instead
 */
export function hasJsxSyntax(code: string): boolean {
  return hasRealJsxSyntax(code);
}

