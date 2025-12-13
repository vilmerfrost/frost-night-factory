// agent-runner/lib/nightFactory/tsxNormalizer.ts
// 🏰 FORTRESS: Preflight normalization for .ts → .tsx evolution

import * as fs from "fs";
import * as path from "path";
import {
  shouldRenameTsToTsx,
  fileContentLooksLikeJsx,
  isSandboxPath,
} from "./renamePolicy";

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
 */
export function normalizeTsxInSandbox(
  workspaceRoot: string,
  logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  }
): void {
  const sandboxRoot = path.join(workspaceRoot, "workspace", "sandbox");

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
 * Enforce JSX invariant: NO .ts files in sandbox should contain JSX after normalization
 * This throws an error if JSX is still found in .ts files, preventing silent loops
 */
export function enforceJsxInvariant(
  workspaceRoot: string,
  logger: {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  }
): void {
  const sandboxRoot = path.join(workspaceRoot, "workspace", "sandbox");

  if (!fs.existsSync(sandboxRoot)) {
    return;
  }

  const tsFiles = walkFiles(sandboxRoot, (file) => file.endsWith(".ts"));

  const violators: string[] = [];

  for (const tsFile of tsFiles) {
    try {
      const content = fs.readFileSync(tsFile, "utf8");
      if (fileContentLooksLikeJsx(content)) {
        violators.push(path.relative(workspaceRoot, tsFile));
      }
    } catch (err) {
      // Skip files we can't read
      continue;
    }
  }

  if (violators.length > 0) {
    const errorMessage =
      `❌ [ARCHITECT INVARIANT] JSX invariant violated: JSX still present in .ts files after normalization:\n` +
      violators.map((f) => `  - ${f}`).join("\n") +
      `\n\nThis indicates that renamePolicy blocked the rename, but JSX is still present.\n` +
      `The pipeline will fail to prevent infinite loops.\n` +
      `Please review renamePolicy.ts to ensure these files can be renamed, or remove JSX from them.`;

    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}

