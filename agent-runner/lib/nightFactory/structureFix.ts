// agent-runner/lib/nightFactory/structureFix.ts
import * as fs from 'fs';
import * as path from 'path';
import { isSrcLibFile } from '../path-rules';

export interface StructureFixOptions {
  workspaceRoot: string;
}

/**
 * High-level entry point. Safe, idempotent structural fixes
 * that clean up common AI mistakes.
 */
export async function runStructureFixes(
  options: StructureFixOptions
): Promise<void> {
  const { workspaceRoot } = options;

  // ✅ C) Bonus: Merge top-level lib/ → src/lib/ before other fixes
  await mergeIntoSrcRoot(workspaceRoot);
  
  await normalizeApiRoutes(workspaceRoot);
  await normalizeRootPageFiles(workspaceRoot);
  await cleanupDuplicateTsFiles(workspaceRoot);
}

/**
 * If both route.js and route.ts exist under app/api/**, keep .ts and remove .js.
 */
async function normalizeApiRoutes(workspaceRoot: string): Promise<void> {
  const appDir = path.join(workspaceRoot, 'app');
  if (!fs.existsSync(appDir)) return;

  const pairs: Array<{ jsPath: string; tsPath: string }> = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (entry.name === 'route.js') {
          const tsPath = path.join(path.dirname(full), 'route.ts');
          if (fs.existsSync(tsPath)) {
            pairs.push({ jsPath: full, tsPath });
          }
        }
      }
    }
  }

  const apiDir = path.join(appDir, 'api');
  if (fs.existsSync(apiDir)) {
    walk(apiDir);
  }

  for (const pair of pairs) {
    try {
      await fs.promises.unlink(pair.jsPath);
      console.log(
        '[Structure Fix] Removed duplicate route.js in favor of route.ts:',
        path.relative(workspaceRoot, pair.jsPath)
      );
    } catch (err: any) {
      console.warn(
        '[Structure Fix] Failed to remove route.js duplicate:',
        path.relative(workspaceRoot, pair.jsPath),
        err?.message || err
      );
    }
  }
}

/**
 * Ensure there is only a single canonical root page file.
 * If both page.js and page.tsx exist, keep the TSX version.
 */
/**
 * Clean up duplicate .ts files when .tsx versions exist (from evolution)
 */
async function cleanupDuplicateTsFiles(workspaceRoot: string): Promise<void> {
  const srcRoot = fs.existsSync(path.join(workspaceRoot, 'src'))
    ? path.join(workspaceRoot, 'src')
    : workspaceRoot;

  function scanDirectory(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        // Check if corresponding .tsx file exists
        const tsxPath = fullPath.replace(/\.ts$/, '.tsx');
        if (fs.existsSync(tsxPath)) {
          try {
            // ✅ Use centralized path-rules
            const isLib = isSrcLibFile(fullPath);
            
            if (isLib) {
              // In lib/: Keep .ts, remove .tsx (lib should never have .tsx)
              const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
              if (tsxContent.trim().length > 0) {
                // .tsx exists in lib/ - this is wrong, delete it
                fs.unlinkSync(tsxPath);
                console.log(`🧹 [Structure Fix] Removed duplicate: ${path.relative(workspaceRoot, tsxPath)} (keeping .ts in lib/)`);
              }
            } else {
              // Outside lib/: Prefer .tsx over .ts (component evolution)
              const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
              if (tsxContent.trim().length > 0) {
                // .tsx exists and has content - delete old .ts file
                fs.unlinkSync(fullPath);
                console.log(`🧹 [Structure Fix] Removed duplicate: ${path.relative(workspaceRoot, fullPath)} (${path.basename(tsxPath)} exists)`);
              }
            }
          } catch (err) {
            console.warn(`⚠️ [Structure Fix] Failed to cleanup ${fullPath}:`, err);
          }
        }
      }
    }
  }

  scanDirectory(srcRoot);
}

/**
 * ✅ C) Bonus: Merge top-level directories into src/ if src/ exists
 * This fixes double structure issues (both lib/ and src/lib/ existing)
 */
async function mergeIntoSrcRoot(workspaceRoot: string): Promise<void> {
  const srcRoot = path.join(workspaceRoot, "src");
  if (!fs.existsSync(srcRoot)) {
    return; // No src/ directory, nothing to merge
  }

  const directoriesToMerge = ["lib", "components", "app"];

  for (const dirName of directoriesToMerge) {
    const topLevelDir = path.join(workspaceRoot, dirName);
    const srcTargetDir = path.join(srcRoot, dirName);

    if (!fs.existsSync(topLevelDir)) {
      continue; // Top-level dir doesn't exist, skip
    }

    // If src/target already exists, merge files (don't overwrite)
    if (fs.existsSync(srcTargetDir)) {
      await moveMissingFiles(topLevelDir, srcTargetDir, workspaceRoot);
    } else {
      // Target doesn't exist, just move the whole directory
      try {
        await fs.promises.rename(topLevelDir, srcTargetDir);
        console.log(
          `📁 [Structure Fix] Moved ${dirName}/ → src/${dirName}/`
        );
      } catch (err: any) {
        console.warn(
          `⚠️ [Structure Fix] Failed to move ${dirName}/:`,
          err?.message || err
        );
      }
    }
  }
}

/**
 * Move files from source to destination, but only if destination doesn't exist
 * This prevents overwriting existing files
 */
async function moveMissingFiles(
  sourceDir: string,
  destDir: string,
  workspaceRoot: string
): Promise<void> {
  if (!fs.existsSync(sourceDir)) return;

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively handle subdirectories
      if (!fs.existsSync(destPath)) {
        await fs.promises.mkdir(destPath, { recursive: true });
      }
      await moveMissingFiles(sourcePath, destPath, workspaceRoot);
    } else if (entry.isFile()) {
      // Only move if destination doesn't exist
      if (!fs.existsSync(destPath)) {
        try {
          // Ensure parent directory exists
          await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
          await fs.promises.rename(sourcePath, destPath);
          console.log(
            `📄 [Structure Fix] Moved ${path.relative(workspaceRoot, sourcePath)} → ${path.relative(workspaceRoot, destPath)}`
          );
        } catch (err: any) {
          console.warn(
            `⚠️ [Structure Fix] Failed to move ${path.relative(workspaceRoot, sourcePath)}:`,
            err?.message || err
          );
        }
      } else {
        // Destination exists, remove source (keep destination)
        try {
          await fs.promises.unlink(sourcePath);
          console.log(
            `🧹 [Structure Fix] Removed duplicate ${path.relative(workspaceRoot, sourcePath)} (keeping ${path.relative(workspaceRoot, destPath)})`
          );
        } catch (err: any) {
          console.warn(
            `⚠️ [Structure Fix] Failed to remove duplicate ${path.relative(workspaceRoot, sourcePath)}:`,
            err?.message || err
          );
        }
      }
    }
  }

  // Clean up empty source directory
  try {
    const remainingEntries = fs.readdirSync(sourceDir);
    if (remainingEntries.length === 0) {
      await fs.promises.rmdir(sourceDir);
    }
  } catch {
    // Ignore errors when cleaning up
  }
}

async function normalizeRootPageFiles(workspaceRoot: string): Promise<void> {
  const appDir = path.join(workspaceRoot, 'app');
  if (!fs.existsSync(appDir)) return;

  const candidates = ['page.tsx', 'page.ts', 'page.jsx', 'page.js'];
  const existing = candidates
    .map((name) => ({
      name,
      fullPath: path.join(appDir, name),
      exists: fs.existsSync(path.join(appDir, name)),
    }))
    .filter((c) => c.exists);

  if (existing.length <= 1) return;

  // Prefer TSX > TS > JSX > JS
  const preference = ['page.tsx', 'page.ts', 'page.jsx', 'page.js'];

  const keep = preference.find((p) =>
    existing.some((c) => c.name === p)
  ) as string;

  for (const entry of existing) {
    if (entry.name === keep) continue;

    try {
      await fs.promises.unlink(entry.fullPath);
      console.log(
        '[Structure Fix] Removed secondary root page file:',
        path.relative(workspaceRoot, entry.fullPath),
        '(keeping',
        keep,
        ')'
      );
    } catch (err: any) {
      console.warn(
        '[Structure Fix] Failed to remove extra root page file:',
        path.relative(workspaceRoot, entry.fullPath),
        err?.message || err
      );
    }
  }
}

