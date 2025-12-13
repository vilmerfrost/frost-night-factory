// agent-runner/lib/nightFactory/structureFix.ts
import * as fs from 'fs';
import * as path from 'path';

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
            // Check if .tsx file has content (not empty stub)
            const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
            if (tsxContent.trim().length > 0) {
              // .tsx exists and has content - delete old .ts file
              fs.unlinkSync(fullPath);
              console.log(`🧹 [Structure Fix] Removed duplicate: ${path.relative(workspaceRoot, fullPath)} (${path.basename(tsxPath)} exists)`);
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

