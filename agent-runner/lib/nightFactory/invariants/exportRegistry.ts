import * as fs from "fs/promises";
import * as path from "path";
import * as ts from "typescript";
import { exists } from "./atomicWrite";

export type ExportInfo = {
  names: Set<string>;
  hasDefault: boolean;
};

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function toFileNameSafe(x: unknown, fallback = "unknown.ts"): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && typeof (x as any).path === "string") return (x as any).path;
  return fallback;
}

function guessScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.Unknown;
}

export class ExportRegistry {
  private exportsByAbs = new Map<string, ExportInfo>();

  constructor(private projectRoot: string) {}

  async registerFile(absFilePath: string): Promise<void> {
    if (!(await exists(absFilePath))) return;
    
    // Check if path is a directory (EISDIR prevention)
    try {
      const stat = await fs.stat(absFilePath);
      if (stat.isDirectory()) {
        console.warn(`⚠️ [ExportRegistry] Skipping directory: ${absFilePath}`);
        // Try to register index.ts if it exists
        const indexPath = path.join(absFilePath, "index.ts");
        if (await exists(indexPath)) {
          await this.registerFile(indexPath);
        }
        return;
      }
    } catch (error: any) {
      // If stat fails, assume it's not a directory and continue
      if (error.code !== "ENOENT") {
        console.warn(`⚠️ [ExportRegistry] Error checking path ${absFilePath}: ${error.message}`);
        return;
      }
    }
    
    const content = await fs.readFile(absFilePath, "utf8");
    const info = this.scanExports(absFilePath, content);
    this.exportsByAbs.set(absFilePath, info);
  }

  get(absFilePath: string): ExportInfo | null {
    return this.exportsByAbs.get(absFilePath) ?? null;
  }

  scanExports(absFilePath: string, content: string): ExportInfo {
    const safe = toFileNameSafe(absFilePath, "export-registry.ts");
    const sf = ts.createSourceFile(
      safe,
      content,
      ts.ScriptTarget.Latest,
      true,
      guessScriptKind(safe)
    );

    const names = new Set<string>();
    let hasDefault = false;

    const visit = (node: ts.Node) => {
      if (ts.isExportAssignment(node)) hasDefault = true;

      if (ts.isFunctionDeclaration(node) && node.name) {
        const mods = ts.getModifiers(node);
        if (mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) names.add(node.name.text);
      }

      if (ts.isVariableStatement(node)) {
        const mods = ts.getModifiers(node);
        if (mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
          }
        }
      }

      if (
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node)
      ) {
        const mods = ts.getModifiers(node);
        if (mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) && node.name) {
          names.add(node.name.text);
        }
      }

      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) names.add(el.name.text);
      }

      ts.forEachChild(node, visit);
    };

    visit(sf);
    return { names, hasDefault };
  }

  /**
   * Resolve a module specifier to an absolute file path (local only).
   * Handles:
   *  - "@/..." -> <projectRoot>/src/...
   *  - relative "./.." -> resolved from importer dir
   * Tries extensions .ts/.tsx/.js/.jsx + /index.*
   */
  async resolveLocalModule(importerAbs: string, spec: string): Promise<string | null> {
    const s = spec.trim();
    if (!s) return null;

    let baseAbs: string | null = null;

    if (s.startsWith("@/")) {
      baseAbs = path.join(this.projectRoot, "src", s.slice(2));
    } else if (s.startsWith("./") || s.startsWith("../")) {
      baseAbs = path.resolve(path.dirname(importerAbs), s);
    } else {
      return null; // package import
    }

    const candidates = [
      baseAbs,
      `${baseAbs}.ts`,
      `${baseAbs}.tsx`,
      `${baseAbs}.js`,
      `${baseAbs}.jsx`,
      path.join(baseAbs, "index.ts"),
      path.join(baseAbs, "index.tsx"),
      path.join(baseAbs, "index.js"),
      path.join(baseAbs, "index.jsx"),
    ];

    for (const c of candidates) {
      if (await exists(c)) {
        // Check if it's a directory - if so, try index files
        try {
          const stat = await fs.stat(c);
          if (stat.isDirectory()) {
            // Try index.ts, index.tsx, etc.
            const indexCandidates = [
              path.join(c, "index.ts"),
              path.join(c, "index.tsx"),
              path.join(c, "index.js"),
              path.join(c, "index.jsx"),
            ];
            for (const idx of indexCandidates) {
              if (await exists(idx)) return idx;
            }
            // Directory exists but no index file - return the directory path
            // The caller should handle this
            return c;
          }
        } catch {
          // If stat fails, assume it's a file and return it
        }
        return c;
      }
    }
    return null;
  }

  toModuleSpecifier(absFilePath: string): string | null {
    const posix = toPosix(absFilePath);
    const srcIdx = posix.lastIndexOf("/src/");
    if (srcIdx === -1) return null;
    return "@/" + posix.slice(srcIdx + 5); // after "/src/"
  }
}
