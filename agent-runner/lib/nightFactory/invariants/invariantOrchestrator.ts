import * as fs from "fs/promises";
import type { Dirent } from "fs";
import * as path from "path";

import { atomicWriteFile, exists } from "./atomicWrite";
import { enforceLibNoJsxInvariant } from "./libNoJsx";
import { ExportRegistry } from "./exportRegistry";
import { ImportHealer } from "./importHealer";
import {
  GOLDEN_CONTRACTS,
  ensureGoldenContractTemplate,
  writeGoldenFileFromTemplate,
} from "./goldenContracts";

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function normalizeRelPath(relPathPosix: string): string {
  // Normalize to POSIX and strip any leading "./" or "/"
  const rel = toPosix(relPathPosix).replace(/^\.\//, "").replace(/^\/+/, "");

  // Basic path traversal guard
  if (rel.includes("..")) {
    throw new Error(`InvariantOrchestrator: illegal path traversal: ${relPathPosix}`);
  }

  return rel;
}

function absFromProjectRoot(projectRoot: string, relPosix: string): string {
  return path.join(projectRoot, relPosix.split("/").join(path.sep));
}

function getGoldenContractFor(relPosix: string) {
  return GOLDEN_CONTRACTS.find((c) => c.file === relPosix) ?? null;
}

export class InvariantOrchestrator {
  public registry: ExportRegistry;
  public healer: ImportHealer;

  constructor(
    private agentRunnerRoot: string,
    private projectRoot: string
  ) {
    this.registry = new ExportRegistry(projectRoot);
    this.healer = new ImportHealer(agentRunnerRoot, projectRoot, this.registry);
  }

  // Writes a single file through invariants:
  // - If GOLDEN: write template (ignore AI content)
  // - Else: enforce lib no-jsx (if applicable) and atomic write content
  // - Register exports
  // - Heal imports for this file
  async writeFileWithInvariants(
    relPathPosix: string,
    proposedContent: unknown
  ): Promise<{ wrote: boolean; notes: string[] }> {
    const notes: string[] = [];

    const rel = normalizeRelPath(relPathPosix);
    const abs = absFromProjectRoot(this.projectRoot, rel);

    const golden = getGoldenContractFor(rel);

    if (golden) {
      await ensureGoldenContractTemplate(this.agentRunnerRoot, golden);
      await writeGoldenFileFromTemplate(this.agentRunnerRoot, this.projectRoot, golden);
      notes.push(`GOLDEN enforced: wrote from template -> ${rel}`);
    } else {
      // Coerce content into string (pipeline should normally pass strings)
      let content: string;
      if (typeof proposedContent === "string") content = proposedContent;
      else if (proposedContent == null) content = "";
      else if (Buffer.isBuffer(proposedContent)) content = proposedContent.toString("utf8");
      else content = JSON.stringify(proposedContent, null, 2);

      // Ensure folder exists before write
      await fs.mkdir(path.dirname(abs), { recursive: true });

      // Enforce lib-no-jsx policy (only meaningful for certain paths)
      const enforced = enforceLibNoJsxInvariant(rel, content);
      if (!enforced.ok && "reason" in enforced) notes.push(String(enforced.reason));

      await atomicWriteFile(abs, enforced.content);
    }

    // Register exports + heal imports
    await this.registry.registerFile(abs);

    const heal = await this.healer.healFile(abs);
    for (const n of heal.notes) notes.push(n);

    // If healer modified current file, re-register to keep export map fresh
    await this.registry.registerFile(abs);

    return { wrote: true, notes };
  }

  // Walk all .ts/.tsx files under src, build export registry, then heal imports.
  // (Two-pass is important: healing needs a stable export map.)
  async healAllSourceFiles(): Promise<{ fixed: number; files: number }> {
    const srcDir = path.join(this.projectRoot, "src");
    if (!(await exists(srcDir))) return { fixed: 0, files: 0 };

    const collected: string[] = [];

    const walk = async (dir: string) => {
      let entries: Dirent[] = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const e of entries) {
        const full = path.join(dir, e.name);

        if (e.isDirectory()) {
          await walk(full);
          continue;
        }

        if (e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx"))) {
          collected.push(full);
        }
      }
    };

    await walk(srcDir);

    // PASS 1: enforce lib-no-jsx on existing files + register exports
    for (const full of collected) {
      // lib-no-jsx enforcement should only apply to src/lib/**/*.ts
      const rel = toPosix(path.relative(this.projectRoot, full));
      const isLibTs =
        rel.startsWith("src/lib/") && rel.endsWith(".ts") && !rel.endsWith(".d.ts");

      if (isLibTs) {
        const original = await fs.readFile(full, "utf8");
        const enforced = enforceLibNoJsxInvariant(rel, original);
        if (enforced.ok && enforced.content !== original) {
          await atomicWriteFile(full, enforced.content);
        } else if (!enforced.ok && enforced.content !== original) {
          // Even if ok=false, we still got a deterministic safe content
          await atomicWriteFile(full, enforced.content);
        }
      }

      await this.registry.registerFile(full);
    }

    // PASS 2: heal imports using the complete export registry
    let fixed = 0;
    for (const full of collected) {
      const r = await this.healer.healFile(full);
      fixed += r.fixed;

      // Keep registry fresh if healer modifies files (cheap + prevents drift)
      if (r.fixed > 0) {
        await this.registry.registerFile(full);
      }
    }

    return { fixed, files: collected.length };
  }
}
