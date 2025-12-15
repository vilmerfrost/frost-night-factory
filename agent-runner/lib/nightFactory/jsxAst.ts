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
 * True JSX detection via AST (no regex false-positives on generics like <T>()).
 * 
 * @param filePath - File path for source file context
 * @param content - File content to check
 * @returns true if file contains JSX syntax (JsxElement, JsxSelfClosingElement, or JsxFragment)
 */
export function containsJsxAst(filePath: string, content: string): boolean {
  try {
    // Parse as TSX so JSX nodes can exist if present.
    const safe = toFileNameSafe(filePath, "jsx-check.ts");
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

    const out = printer.printFile(result.transformed[0]);
    result.dispose();

    return out;
  } catch (error: any) {
    // If transformation fails, return original (safer than corrupting file)
    console.warn(`[jsxAst] Failed to strip JSX from ${filePath}: ${error?.message}`);
    return content;
  }
}

