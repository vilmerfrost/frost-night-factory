import * as fs from "fs/promises";
import * as path from "path";
import * as ts from "typescript";
import { atomicWriteFile, exists } from "./atomicWrite";
import { ExportRegistry } from "./exportRegistry";
import { buildLibStubWithExports, enforceLibNoJsxInvariant } from "./libNoJsx";
import { GOLDEN_CONTRACTS, ensureGoldenContractTemplate, writeGoldenFileFromTemplate } from "./goldenContracts";

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function toFileNameSafe(x: unknown, fallback = "unknown.ts"): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && typeof (x as any).path === "string") return (x as any).path;
  return fallback;
}

function isGoldenRel(relPosix: string): boolean {
  return GOLDEN_CONTRACTS.some((c) => c.file === relPosix);
}

function getGoldenContract(relPosix: string) {
  return GOLDEN_CONTRACTS.find((c) => c.file === relPosix) ?? null;
}

function ensureStubBlock(original: string, missingExports: string[]): string {
  const START = "// === AUTO_STUB_EXPORTS_START ===";
  const END = "// === AUTO_STUB_EXPORTS_END ===";

  const block = [
    START,
    ...missingExports.map((n) => stubExport(n).trimEnd()),
    END,
    "",
  ].join("\n");

  if (original.includes(START) && original.includes(END)) {
    const before = original.split(START)[0];
    const after = original.split(END)[1] ?? "";
    return before + block + after;
  }

  return original.trimEnd() + "\n\n" + block;
}

function stubExport(name: string): string {
  if (name === "default") return `export default function DefaultExport(){ return null as any; }\n`;
  if (/^[A-Z]/.test(name)) {
    if (name.endsWith("Data") || name.endsWith("Result") || name.endsWith("Props")) {
      return `export interface ${name} { [key: string]: any }\n`;
    }
    return `export const ${name} = {} as any;\n`;
  }
  return `export function ${name}(..._args: any[]): any { throw new Error("${name} not implemented"); }\n`;
}

function guessKind(filePath: string): ts.ScriptKind {
  return filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

export class ImportHealer {
  constructor(
    private agentRunnerRoot: string,
    private projectRoot: string,
    private registry: ExportRegistry
  ) {}

  /**
   * Auto-create barrel file (index.ts) for a directory if it doesn't exist
   * Exports all .ts/.tsx files in the directory
   */
  private async ensureBarrelFile(dirPath: string): Promise<string | null> {
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) return null;
      
      const indexPath = path.join(dirPath, "index.ts");
      const indexTsxPath = path.join(dirPath, "index.tsx");
      
      // If index already exists, return its path
      if (await exists(indexPath)) return indexPath;
      if (await exists(indexTsxPath)) return indexTsxPath;
      
      // Read directory and find all .ts/.tsx files (excluding index files and .d.ts)
      const files = await fs.readdir(dirPath);
      const exportFiles = files.filter(f => 
        /\.(ts|tsx)$/.test(f) && 
        !/^index\.(ts|tsx)$/.test(f) && 
        !f.endsWith('.d.ts')
      );
      
      if (exportFiles.length === 0) return null;
      
      // Generate barrel file content
      const lines: string[] = [];
      for (const f of exportFiles) {
        const base = f.replace(/\.(ts|tsx)$/, '');
        lines.push(`export * from './${base}';`);
      }
      
      const barrelContent = lines.join('\n') + '\n';
      await atomicWriteFile(indexPath, barrelContent);
      
      console.log(`📦 [Auto-Barrel] Created ${indexPath} with ${exportFiles.length} exports`);
      return indexPath;
    } catch (error: any) {
      // Directory doesn't exist or other error
      return null;
    }
  }

  /**
   * Safe file reader that checks if path is a directory before reading
   * Prevents EISDIR errors by automatically trying index.ts/index.tsx for directories
   */
  private async safeReadFile(filePath: string): Promise<string | null> {
    try {
      const stat = await fs.stat(filePath);
      
      // If it's a directory, try to create barrel file or read existing index
      if (stat.isDirectory()) {
        // Try to ensure barrel file exists
        const barrelPath = await this.ensureBarrelFile(filePath);
        if (barrelPath) {
          return await fs.readFile(barrelPath, "utf-8");
        }
        // Fallback: check for existing index files
        const indexPath = path.join(filePath, "index.ts");
        if (await exists(indexPath)) {
          return await fs.readFile(indexPath, "utf-8");
        }
        const indexTsxPath = path.join(filePath, "index.tsx");
        if (await exists(indexTsxPath)) {
          return await fs.readFile(indexTsxPath, "utf-8");
        }
        console.warn(`⚠️ [ImportHealer] Cannot read directory (no index file and no files to export): ${filePath}`);
        return null;
      }
      
      // It's a file, read it
      return await fs.readFile(filePath, "utf-8");
    } catch (error: any) {
      // File doesn't exist or other error
      if (error.code === "ENOENT") {
        console.warn(`⚠️ [ImportHealer] File not found: ${filePath}`);
      } else {
        console.warn(`⚠️ [ImportHealer] Error reading file ${filePath}: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Heal imports for one file:
   *  - resolve local modules
   *  - if imported named export is missing, inject stub into target OR patch GOLDEN template
   *  - updates ExportRegistry for modified targets
   */
  async healFile(importerAbs: string): Promise<{ fixed: number; notes: string[] }> {
    const notes: string[] = [];
    if (!(await exists(importerAbs))) return { fixed: 0, notes };

    // Check if it's a directory (EISDIR fix)
    try {
      const stat = await fs.stat(importerAbs);
      if (stat.isDirectory()) {
        const indexPath = path.join(importerAbs, 'index.ts');
        if (await exists(indexPath)) {
          return await this.healFile(indexPath);
        }
        console.warn(`⚠️ [ImportHealer] Skipping directory: ${importerAbs}`);
        return { fixed: 0, notes };
      }
    } catch {
      return { fixed: 0, notes }; // File doesn't exist
    }

    const content = await this.safeReadFile(importerAbs);
    if (!content) {
      console.warn(`⚠️ [ImportHealer] Cannot read importer file: ${importerAbs}`);
      return { fixed: 0, notes };
    }
    const safe = toFileNameSafe(importerAbs, "import-healer.ts");
    const sf = ts.createSourceFile(safe, content, ts.ScriptTarget.Latest, true, guessKind(safe));

    let fixed = 0;

    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;
      const spec = (stmt.moduleSpecifier as ts.StringLiteral).text;

      let targetAbs = await this.registry.resolveLocalModule(importerAbs, spec);
      if (!targetAbs) continue;
      
      // ✅ AUTO-BARREL: If targetAbs is a directory, create index.ts
      try {
        const stat = await fs.stat(targetAbs);
        if (stat.isDirectory()) {
          const barrelPath = await this.ensureBarrelFile(targetAbs);
          if (barrelPath) {
            targetAbs = barrelPath; // Use the barrel file instead
          } else {
            notes.push(`Directory import ${spec} has no index.ts and no files to export`);
            continue;
          }
        }
      } catch {
        // Path doesn't exist, continue with original targetAbs
      }

      const importClause = stmt.importClause;
      if (!importClause) continue;

      const missingNamed: string[] = [];
      let needsDefault = false;

      const targetInfo = this.registry.get(targetAbs) ?? (await this.safeRegisterAndGet(targetAbs));
      const targetExports = targetInfo?.names ?? new Set<string>();
      const targetHasDefault = targetInfo?.hasDefault ?? false;

      // default import
      if (importClause.name) {
        if (!targetHasDefault) needsDefault = true;
      }

      // named imports
      const nb = importClause.namedBindings;
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) {
          const importedName = el.propertyName ? el.propertyName.text : el.name.text;
          // importedName must exist in target exports
          if (!targetExports.has(importedName)) missingNamed.push(importedName);
        }
      }

      if (!needsDefault && missingNamed.length === 0) continue;

      // We need to heal targetAbs
      const relPosix = toPosix(path.relative(this.projectRoot, targetAbs));
      const isGolden = isGoldenRel(relPosix);

      if (isGolden) {
        const contract = getGoldenContract(relPosix);
        if (contract) {
          const required = Array.from(new Set([
            ...contract.requiredExports,
            ...(needsDefault ? ["default"] : []),
            ...missingNamed,
          ]));

          // Patch template permanently
          await ensureGoldenContractTemplate(this.agentRunnerRoot, {
            ...contract,
            requiredExports: required,
          });
          // Write template into sandbox for immediate effect
          await writeGoldenFileFromTemplate(this.agentRunnerRoot, this.projectRoot, {
            ...contract,
            requiredExports: required,
          });

          notes.push(`Patched GOLDEN template for ${relPosix} (added: ${missingNamed.join(", ")}${needsDefault ? ", default" : ""})`);
          fixed += missingNamed.length + (needsDefault ? 1 : 0);

          // Re-register
          await this.registry.registerFile(targetAbs);
        } else {
          notes.push(`GOLDEN target ${relPosix} missing contract mapping (cannot auto-patch template).`);
        }
      } else {
        // Non-golden: inject stub exports into the target file
        const targetRaw = await this.safeReadFile(targetAbs);
        if (!targetRaw) {
          notes.push(`Cannot read target file ${relPosix} (may be a directory without index)`);
          continue;
        }

        // Extra: if it's a lib file and missing exports, use lib stub generator (stays JSX-free)
        const rel = relPosix.replace(/\\/g, "/");
        if (rel.startsWith("src/lib/")) {
          const needed = Array.from(new Set([...(needsDefault ? ["default"] : []), ...missingNamed]));
          // ✅ ADDITIVE: Pass existing content so we don't overwrite existing exports
          const stub = buildLibStubWithExports(rel, needed, targetRaw);
          await atomicWriteFile(targetAbs, stub);
          notes.push(`Added missing exports to lib file: ${relPosix} (${needed.join(", ")})`);
          fixed += needed.length;
          await this.registry.registerFile(targetAbs);
          continue;
        }

        const needed = Array.from(new Set([...(needsDefault ? ["default"] : []), ...missingNamed]));
        const patched = ensureStubBlock(targetRaw, needed);

        // Enforce lib invariant if this happens to be lib (belt & suspenders)
        const enforced = enforceLibNoJsxInvariant(relPosix, patched);
        await atomicWriteFile(targetAbs, enforced.content);

        notes.push(`Injected stubs into ${relPosix}: ${needed.join(", ")}`);
        fixed += needed.length;

        await this.registry.registerFile(targetAbs);
      }
    }

    return { fixed, notes };
  }

  private async safeRegisterAndGet(targetAbs: string) {
    // Check if it's a directory first (EISDIR prevention)
    try {
      const stat = await fs.stat(targetAbs);
      if (stat.isDirectory()) {
        // Try index.ts instead
        const indexPath = path.join(targetAbs, "index.ts");
        if (await exists(indexPath)) {
          await this.registry.registerFile(indexPath);
          return this.registry.get(indexPath);
        }
        // Try index.tsx
        const indexTsxPath = path.join(targetAbs, "index.tsx");
        if (await exists(indexTsxPath)) {
          await this.registry.registerFile(indexTsxPath);
          return this.registry.get(indexTsxPath);
        }
        // No index file found, return empty exports
        return null;
      }
    } catch (error: any) {
      // If stat fails and it's not ENOENT, log and return null
      if (error.code !== "ENOENT") {
        console.warn(`⚠️ [ImportHealer] Error checking path ${targetAbs}: ${error.message}`);
        return null;
      }
      // Path doesn't exist, return null
      return null;
    }
    
    await this.registry.registerFile(targetAbs);
    return this.registry.get(targetAbs);
  }
}
