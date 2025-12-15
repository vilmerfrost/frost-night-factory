// agent-runner/lib/validation/tsSyntaxGuard.ts
/**
 * ✅ TypeScript Syntax Guard
 * 
 * Validates TypeScript syntax using the TypeScript compiler API AST parser.
 * Prevents half-written TypeScript files from being marked as "validated & wrote".
 * 
 * This catches syntax errors like:
 * - Unterminated template literals
 * - Unbalanced brackets/braces
 * - Missing semicolons (in strict mode)
 * - Invalid type syntax
 */

import * as ts from "typescript";

export interface SyntaxError {
  file: string;
  line: number;
  column: number;
  message: string;
  code?: number;
}

/**
 * Get all syntax errors from TypeScript source code using AST parser
 * 
 * @param sourceText - The TypeScript/TSX source code to validate
 * @param fileName - The file name (used for error reporting and determining TS vs TSX)
 * @returns Array of syntax error messages with file location
 */
export function getSyntaxErrors(sourceText: string, fileName: string): SyntaxError[] {
  try {
    // ✅ Hardening: Ensure fileName is always a string before passing to TypeScript API
    const fileNameSafe =
      typeof fileName === "string"
        ? fileName
        : typeof (fileName as any)?.path === "string"
          ? (fileName as any).path
          : "unknown.ts";

    if (typeof fileName !== "string") {
      console.warn("[tsSyntaxGuard] Non-string fileName passed to createSourceFile", {
        typeofFileName: typeof fileName,
        fileName,
        fileNameSafe,
      });
    }

    // Determine script kind based on file extension (use safe fileName)
    const scriptKind = fileNameSafe.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS;

    // Create source file with parse diagnostics enabled (use safe fileName)
    const sf = ts.createSourceFile(
      fileNameSafe,
      sourceText,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      scriptKind
    );

    // Get parse diagnostics (syntax errors) directly from SourceFile
    // parseDiagnostics contains syntax errors from parsing
    const diags = (sf as any).parseDiagnostics as readonly ts.Diagnostic[] | undefined;
    const parseDiags = Array.isArray(diags) ? diags : [];

    // Convert diagnostics to user-friendly error messages
    return parseDiags.map((d) => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
      const pos = d.start != null ? sf.getLineAndCharacterOfPosition(d.start) : null;
      const loc = pos ? { line: pos.line + 1, column: pos.character + 1 } : { line: 0, column: 0 };
      
      return {
        file: fileNameSafe,
        line: loc.line,
        column: loc.column,
        message: msg,
        code: d.code,
      };
    });
  } catch (error: any) {
    // If parsing itself fails, return a generic error
    // Use fileNameSafe if available, otherwise fallback to original fileName
    const safeFileName = typeof fileName === "string" 
      ? fileName 
      : typeof (fileName as any)?.path === "string"
        ? (fileName as any).path
        : String(fileName ?? "unknown.ts");
    
    return [{
      file: safeFileName,
      line: 0,
      column: 0,
      message: `Failed to parse TypeScript: ${error?.message || String(error)}`,
    }];
  }
}

/**
 * Check if source code has any syntax errors
 * 
 * @param sourceText - The TypeScript/TSX source code to validate
 * @param fileName - The file name
 * @returns true if code has syntax errors, false otherwise
 */
export function hasSyntaxErrors(sourceText: string, fileName: string): boolean {
  return getSyntaxErrors(sourceText, fileName).length > 0;
}

/**
 * Get formatted error messages for logging
 * 
 * @param sourceText - The TypeScript/TSX source code to validate
 * @param fileName - The file name
 * @returns Formatted error string or null if no errors
 */
export function getSyntaxErrorString(sourceText: string, fileName: string): string | null {
  const errors = getSyntaxErrors(sourceText, fileName);
  if (errors.length === 0) return null;

  return errors
    .map((e) => `${e.file}:${e.line}:${e.column} ${e.message}${e.code ? ` (TS${e.code})` : ""}`)
    .join("\n");
}

