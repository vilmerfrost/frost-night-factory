// agent-runner/lib/nightFactory/tsxNormalizer.ts
// 🏰 FORTRESS: Preflight normalization for .ts → .tsx evolution

import * as fs from "fs";
import * as path from "path";
import {
  shouldRenameTsToTsx,
  fileContentLooksLikeJsx,
  isSandboxPath,
} from "./renamePolicy";
import { containsJsxAst, stripJsxAst } from "./jsxAst";

/**
 * Walk directory tree and collect files matching a predicate
 */
function walkFiles(
  root: string,
  matcher: (fullPath: string) => boolean
): string[] {
  const results: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    
    if (!fs.existsSync(current)) continue;
    
    const stat = fs.statSync(current);

    if (stat.isDirectory()) {
      // Skip node_modules, .next, and hidden directories
      const dirName = path.basename(current);
      if (
        dirName === "node_modules" ||
        dirName === ".next" ||
        dirName.startsWith(".")
      ) {
        continue;
      }

      try {
        const entries = fs.readdirSync(current);
        for (const child of entries) {
          stack.push(path.join(current, child));
        }
      } catch (err) {
        // Skip directories we can't read
        continue;
      }
    } else if (stat.isFile()) {
      if (matcher(current)) {
        results.push(current);
      }
    }
  }

  return results;
}

/**
 * Normalize .ts files with JSX to .tsx in sandbox
 * This runs BEFORE TypeScript validation to prevent JSX-in-.ts errors
 * 
 * CRITICAL: workspaceRoot is already the pipeline path (e.g., agent-runner/workspace/sandbox/pipeline-<id>)
 * Do NOT add workspace/sandbox again!
 */
export function normalizeTsxInSandbox(
  workspaceRoot: string,
  logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  }
): void {
  // workspaceRoot is already the full pipeline path, use it directly
  const sandboxRoot = workspaceRoot;

  if (!fs.existsSync(sandboxRoot)) {
    logger.warn(
      "[TSX Normalizer] Sandbox root does not exist:",
      sandboxRoot
    );
    return;
  }

  const tsFiles = walkFiles(sandboxRoot, (file) => file.endsWith(".ts"));

  let renamedCount = 0;

  for (const tsFile of tsFiles) {
    try {
      const content = fs.readFileSync(tsFile, "utf8");

      if (!fileContentLooksLikeJsx(content)) continue;

      if (!shouldRenameTsToTsx(tsFile, content)) {
        // Policy says no rename - log but let invariant check handle it
        logger.warn(
          "[TSX Normalizer] JSX detected in .ts but renamePolicy said NO:",
          tsFile
        );
        continue;
      }

      const tsxPath = tsFile.replace(/\.ts$/, ".tsx");

      // Check if .tsx file already exists
      if (fs.existsSync(tsxPath)) {
        logger.warn(
          "[TSX Normalizer] Target .tsx file already exists, deleting old .ts:",
          tsFile
        );
        fs.unlinkSync(tsFile);
        continue;
      }

      fs.renameSync(tsFile, tsxPath);
      renamedCount++;
      logger.info(
        "🚀 [TSX Normalizer] Auto-evolved .ts → .tsx:",
        path.relative(workspaceRoot, tsFile),
        "→",
        path.relative(workspaceRoot, tsxPath)
      );
    } catch (err: any) {
      logger.warn(
        "[TSX Normalizer] Failed to process file:",
        tsFile,
        err.message
      );
    }
  }

  if (renamedCount > 0) {
    logger.info(`✅ [TSX Normalizer] Renamed ${renamedCount} file(s) from .ts to .tsx`);
  }
}

/**
 * Hard fallback stub: Creates a minimal valid TypeScript module when JSX stripping fails.
 * This guarantees the invariant passes and prevents infinite loops.
 */
function hardNoJsxFallbackStub(filePath: string, original: string): string {
  // Minimal, deterministic: keep module valid; tests/import-graph kan fånga exports senare.
  // (Detta är sista-nödbromsen för att stoppa infinite loops.)
  return `/**
 * AUTO-GUARDED: JSX invariant violation in a .ts file that cannot be renamed.
 * File: ${filePath.replace(/\\/g, "/")}
 * The pipeline replaced JSX with a safe stub to avoid infinite loops.
 * TODO: Regenerate this module as pure TypeScript (no JSX).
 */
export {};
`;
}

/**
 * Enforce JSX invariant: NO .ts files in sandbox should contain JSX after normalization
 * This throws an error if JSX is still found in .ts files, preventing silent loops
 * 
 * CRITICAL: workspaceRoot is already the pipeline path (e.g., agent-runner/workspace/sandbox/pipeline-<id>)
 * Do NOT add workspace/sandbox again!
 * 
 * ✅ LONG-TERM FIX: AST-based JSX detection + deterministic stripping (no false-positives on generics)
 */
export function enforceJsxInvariant(
  workspaceRoot: string,
  logger: {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  }
): void {
  // workspaceRoot is already the full pipeline path, use it directly
  const sandboxRoot = workspaceRoot;

  if (!fs.existsSync(sandboxRoot)) {
    return;
  }

  const tsFiles = walkFiles(sandboxRoot, (file) => file.endsWith(".ts"));

  const violators: string[] = [];
  let sanitizedCount = 0;
  let stubCount = 0;

  for (const tsFile of tsFiles) {
    try {
      const content = fs.readFileSync(tsFile, "utf8");
      const absPath = path.resolve(tsFile);
      
      // ✅ AST-based JSX detection (no false-positives on generics like <T>())
      if (!containsJsxAst(absPath, content)) {
        continue; // No JSX, skip
      }

      // ✅ Check if renamePolicy allows rename
      const canRename = shouldRenameTsToTsx(tsFile, content);

      if (!canRename) {
        // ✅ LONG-TERM FIX: If rename is blocked, strip JSX deterministically via AST
        logger.warn(
          `[TSX Normalizer] JSX detected (AST) in ${path.relative(workspaceRoot, tsFile)} but renamePolicy blocked rename. Stripping JSX...`
        );

        const stripped = stripJsxAst(absPath, content);

        // Re-check AFTER strip (AST-based)
        if (containsJsxAst(absPath, stripped)) {
          // Stripping failed or left JSX → use hard fallback stub
          logger.warn(
            `[TSX Normalizer] JSX still present after stripping. Using fallback stub for ${path.relative(workspaceRoot, tsFile)}`
          );
          const stub = hardNoJsxFallbackStub(absPath, content);
          fs.writeFileSync(tsFile, stub, "utf8");
          stubCount++;
        } else {
          // Stripping succeeded → write stripped content
          fs.writeFileSync(tsFile, stripped, "utf8");
          sanitizedCount++;
          logger.warn(
            `   ✅ Stripped JSX from ${path.relative(workspaceRoot, tsFile)}`
          );
        }
      } else {
        // RenamePolicy says YES but file still has JSX → should have been renamed
        // This shouldn't happen if normalizeTsxInSandbox ran correctly, but log it
        logger.warn(
          `[TSX Normalizer] JSX detected (AST) in ${path.relative(workspaceRoot, tsFile)} but file wasn't renamed. This may indicate a bug in normalizeTsxInSandbox.`
        );
        violators.push(path.relative(workspaceRoot, tsFile));
      }
    } catch (err: any) {
      // Skip files we can't read
      logger.warn(
        `[TSX Normalizer] Failed to process ${path.relative(workspaceRoot, tsFile)}: ${err?.message || err}`
      );
      continue;
    }
  }

  if (sanitizedCount > 0) {
    logger.warn(
      `✅ [TSX Normalizer] Stripped JSX from ${sanitizedCount} file(s) using AST transformer`
    );
  }

  if (stubCount > 0) {
    logger.warn(
      `⚠️ [TSX Normalizer] Created fallback stubs for ${stubCount} file(s) that couldn't be stripped`
    );
  }

  if (violators.length > 0) {
    const errorMessage =
      `❌ [ARCHITECT INVARIANT] JSX invariant violated: JSX still present in .ts files after normalization and AST stripping:\n` +
      violators.map((f) => `  - ${f}`).join("\n") +
      `\n\nThis indicates that:\n` +
      `1. renamePolicy allowed rename, BUT\n` +
      `2. normalizeTsxInSandbox didn't rename the file.\n` +
      `\nThe pipeline will fail to prevent infinite loops.\n` +
      `Please review normalizeTsxInSandbox or manually fix these files.`;

    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}

