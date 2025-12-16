// =============================================================================
// WINDOWS CASING FIX - Prevents TS1261 errors on Windows filesystem
// =============================================================================
// Windows filesystem is case-insensitive, but TypeScript is case-sensitive.
// This causes "Already included file name 'Card.tsx' differs from 'card.tsx'"
// errors when imports mix casing.
//
// ✅ CORRECTED VERSION: Normalizes to LOWERCASE (not PascalCase)

import fs from "fs/promises";
import type { Dirent } from "fs";
import path from "path";

const WATCHED_DIRS = ["src", "app", "components"];
const TS_EXTENSIONS = [".ts", ".tsx"];

interface FileInfo {
  fullPath: string;
  relativePath: string;
  lowerKey: string;
}

/**
 * Collect all TypeScript files and group by lowercase key
 */
async function collectTsFiles(projectRoot: string): Promise<Map<string, FileInfo[]>> {
  const map = new Map<string, FileInfo[]>();

  async function walk(dir: string) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, .next, etc.
      if (entry.name === "node_modules" || 
          entry.name === ".next" || 
          entry.name.startsWith(".") ||
          entry.name === "dist" ||
          entry.name === "build") {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name);
      if (!TS_EXTENSIONS.includes(ext)) continue;

      const relativePath = path.relative(projectRoot, fullPath);
      const key = relativePath.toLowerCase();

      const info: FileInfo = { fullPath, relativePath, lowerKey: key };
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(info);
    }
  }

  for (const base of WATCHED_DIRS) {
    const basePath = path.join(projectRoot, base);
    try {
      await fs.access(basePath);
      await walk(basePath);
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return map;
}

/**
 * Normalize all TypeScript files to lowercase filenames
 * ✅ CRITICAL FIX: Normalizes to LOWERCASE, not PascalCase!
 */
export async function normalizeWindowsCasing(projectRoot: string): Promise<void> {
  console.log("\n🔡 WINDOWS CASING NORMALIZER: Converting all files to lowercase...");
  
  const fileMap = await collectTsFiles(projectRoot);
  let renamed = 0;
  let duplicatesRemoved = 0;

  for (const [lowerKey, infos] of fileMap.entries()) {
    if (infos.length === 1) {
      const info = infos[0];
      if (!info) continue;
      // ✅ CRITICAL FIX: Normalize to LOWERCASE, not PascalCase!
      if (info.relativePath !== lowerKey) {
        const from = info.fullPath;
        const to = path.join(projectRoot, lowerKey);
        
        try {
          await fs.mkdir(path.dirname(to), { recursive: true });
          await fs.rename(from, to);
          console.log(`   🔡 Renamed: ${info.relativePath} -> ${lowerKey}`);
          renamed++;
        } catch (error: any) {
          console.error(`   ❌ Failed to rename ${info.relativePath}: ${error.message}`);
        }
      }
      continue;
    }

    // Multiple variants: choose LOWERCASE as canonical (not PascalCase!)
    const canonicalPath = path.join(projectRoot, lowerKey);

    const first = infos[0];
    if (!first) continue;
    if (first.relativePath !== lowerKey) {
      try {
        await fs.mkdir(path.dirname(canonicalPath), { recursive: true });
        await fs.rename(first.fullPath, canonicalPath);
        console.log(`   🔡 Canonicalized: ${first.relativePath} -> ${lowerKey}`);
        renamed++;
      } catch (error: any) {
        console.error(`   ❌ Failed to canonicalize ${first.relativePath}: ${error.message}`);
      }
    }

    // Delete duplicates
    for (const dup of infos.slice(1)) {
      if (dup.relativePath.toLowerCase() === lowerKey) continue;
      try {
        await fs.rm(dup.fullPath, { force: true });
        console.log(`   🔥 Removed duplicate: ${dup.relativePath}`);
        duplicatesRemoved++;
      } catch (error: any) {
        console.error(`   ❌ Failed to remove duplicate ${dup.relativePath}: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Normalized ${renamed} files, removed ${duplicatesRemoved} duplicates`);
}

/**
 * Assert that no PascalCase files exist (fail-fast validation)
 */
export async function assertNoPascalCaseFiles(projectRoot: string): Promise<void> {
  const offenders: string[] = [];
  const fileMap = await collectTsFiles(projectRoot);

  for (const infos of fileMap.values()) {
    for (const info of infos) {
      const base = path.basename(info.relativePath);
      const nameWithoutExt = base.replace(/\.(tsx|ts)$/i, "");
      if (nameWithoutExt !== nameWithoutExt.toLowerCase()) {
        offenders.push(info.relativePath);
      }
    }
  }

  if (offenders.length > 0) {
    console.error("🚨 [CasingGate] PascalCase .ts/.tsx filenames detected:");
    offenders.forEach((f) => console.error(`   - ${f}`));
    throw new Error(
      `CasingGate failed: ${offenders.length} PascalCase files found. Run normalizeWindowsCasing() first.`
    );
  }

  console.log("✅ [CasingGate] All .ts/.tsx filenames are lowercase");
}

/**
 * Legacy function for backward compatibility
 */
export function runWindowsCasingFix(repoPath: string): {
  success: boolean;
  filesRenamed: number;
  duplicatesRemoved: number;
  importsFixed: number;
  filesFixed: number;
  errors: string[];
} {
  // This is now async, but keeping sync wrapper for compatibility
  console.warn("⚠️ runWindowsCasingFix() is deprecated. Use normalizeWindowsCasing() instead.");
  
  return {
    success: false,
    filesRenamed: 0,
    duplicatesRemoved: 0,
    importsFixed: 0,
    filesFixed: 0,
    errors: ["Use async normalizeWindowsCasing() instead"]
  };
}

/**
 * Validate no casing issues remain (for tester phase)
 */
export async function validateNoCasingIssues(repoPath: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  try {
    await assertNoPascalCaseFiles(repoPath);
    return { valid: true, errors: [] };
  } catch (error: any) {
    return {
      valid: false,
      errors: [error.message]
    };
  }
}
