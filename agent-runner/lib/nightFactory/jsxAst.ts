// agent-runner/lib/nightFactory/jsxAst.ts
/**
 * ✅ AST-Based JSX Detection and Stripping
 * 
 * Uses TypeScript compiler API to detect JSX via AST nodes (no regex false-positives).
 * Deterministically strips JSX from .ts files to prevent infinite loops.
 */

import * as ts from "typescript";

function toFileNameSafe(x: unknown, fallback = "unknown.ts"): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && typeof (x as any).path === "string") return (x as any).path;
  return fallback;
}

/**
 * ✅ CRITICAL FIX: Safe JSX detection via AST (no false positives on generics)
 * 
 * Strategy:
 * - For .tsx files: Parse as TSX, look for JSX nodes
 * - For .ts files: Parse as TS first. Only check for JSX if regex suggests real tags.
 *   This prevents Promise<InvoiceData> from triggering false positives.
 * 
 * @param filePath - File path for source file context
 * @param content - File content to check
 * @returns true if file contains JSX syntax (JsxElement, JsxSelfClosingElement, or JsxFragment)
 */
export function containsJsxAst(filePath: string, content: string): boolean {
  try {
    const safe = toFileNameSafe(filePath, "jsx-check.ts");
    const isTsxFile = safe.endsWith('.tsx');
    
    // Quick guard: if no <, definitely no JSX
    if (!content.includes("<")) return false;
    
    // ✅ For .tsx files: Parse as TSX directly
    if (isTsxFile) {
      const sf = ts.createSourceFile(
        safe,
        content,
        ts.ScriptTarget.Latest,
        /*setParentNodes*/ true,
        ts.ScriptKind.TSX
      );

      let found = false;
      const visit = (node: ts.Node) => {
        if (
          ts.isJsxElement(node) ||
          ts.isJsxSelfClosingElement(node) ||
          ts.isJsxFragment(node)
        ) {
          found = true;
          return;
        }
        ts.forEachChild(node, visit);
      };

      visit(sf);
      return found;
    }
    
    // ✅ For .ts files: Parse as TS first, only check JSX if regex suggests real tags
    // This prevents generics like Promise<InvoiceData> from triggering
    const looksLikeJsxTag = /(^|[=\(\{\s,;:])<[A-Za-z][^>]*>/.test(content);
    
    if (!looksLikeJsxTag) {
      // No JSX-like pattern → definitely no JSX
      return false;
    }
    
    // Regex suggests JSX → parse as TSX to confirm with AST
    const sf = ts.createSourceFile(
      safe,
      content,
      ts.ScriptTarget.Latest,
      /*setParentNodes*/ true,
      ts.ScriptKind.TSX
    );

    let found = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isJsxElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxFragment(node)
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(sf);
    return found;
  } catch (error: any) {
    // If parsing fails, assume no JSX (safer than false positive)
    console.warn(`[jsxAst] Failed to parse ${filePath}: ${error?.message}`);
    return false;
  }
}

/**
 * Removes JSX deterministically by replacing any JSX node with `null`.
 * Keeps the file valid .ts (no JSX syntax) without renaming.
 * 
 * @param filePath - File path for source file context
 * @param content - File content to strip JSX from
 * @returns Stripped content with JSX replaced by `null`
 */
export function stripJsxAst(filePath: string, content: string): string {
  try {
    const safe = toFileNameSafe(filePath, "jsx-strip.ts");
    const sf = ts.createSourceFile(
      safe,
      content,
      ts.ScriptTarget.Latest,
      /*setParentNodes*/ true,
      ts.ScriptKind.TSX
    );

    const transformer: ts.TransformerFactory<ts.SourceFile> = (ctx) => {
      const visit: ts.Visitor = (node) => {
        if (
          ts.isJsxElement(node) ||
          ts.isJsxSelfClosingElement(node) ||
          ts.isJsxFragment(node)
        ) {
          return ts.factory.createNull();
        }
        return ts.visitEachChild(node, visit, ctx);
      };
      return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    };

    const result = ts.transform(sf, [transformer]);
    const printer = ts.createPrinter({ 
      newLine: ts.NewLineKind.LineFeed,
      removeComments: false,
    });

    const transformedFile = result.transformed[0];
    if (!transformedFile) {
      result.dispose();
      return content;
    }

    const out = printer.printFile(transformedFile);
    result.dispose();

    return out;
  } catch (error: any) {
    // If transformation fails, return original (safer than corrupting file)
    console.warn(`[jsxAst] Failed to strip JSX from ${filePath}: ${error?.message}`);
    return content;
  }
}

