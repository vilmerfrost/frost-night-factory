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
   * Heal imports for one file:
   *  - resolve local modules
   *  - if imported named export is missing, inject stub into target OR patch GOLDEN template
   *  - updates ExportRegistry for modified targets
   */
  async healFile(importerAbs: string): Promise<{ fixed: number; notes: string[] }> {
    const notes: string[] = [];
    if (!(await exists(importerAbs))) return { fixed: 0, notes };

    const content = await fs.readFile(importerAbs, "utf8");
    const safe = toFileNameSafe(importerAbs, "import-healer.ts");
    const sf = ts.createSourceFile(safe, content, ts.ScriptTarget.Latest, true, guessKind(safe));

    let fixed = 0;

    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;
      const spec = (stmt.moduleSpecifier as ts.StringLiteral).text;

      const targetAbs = await this.registry.resolveLocalModule(importerAbs, spec);
      if (!targetAbs) continue;

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
        const targetRaw = await fs.readFile(targetAbs, "utf8");

        // Extra: if it's a lib file and missing exports, use lib stub generator (stays JSX-free)
        const rel = relPosix.replace(/\\/g, "/");
        if (rel.startsWith("src/lib/")) {
          const needed = Array.from(new Set([...(needsDefault ? ["default"] : []), ...missingNamed]));
          const stub = buildLibStubWithExports(rel, needed);
          await atomicWriteFile(targetAbs, stub);
          notes.push(`Replaced lib file with deterministic export stub: ${relPosix} (${needed.join(", ")})`);
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
    await this.registry.registerFile(targetAbs);
    return this.registry.get(targetAbs);
  }
}
