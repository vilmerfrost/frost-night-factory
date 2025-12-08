// =============================================================================
// SAFE FILESYSTEM WRAPPER - Prevents AI from breaking Windows casing
// =============================================================================
// All file operations go through this wrapper to ensure lowercase filenames
// This prevents AI-generated code from creating PascalCase files
import fs from "fs/promises";
import path from "path";
/**
 * Normalize relative path to lowercase
 * Converts: src/components/ui/Card.tsx -> src/components/ui/card.tsx
 */
function normalizeRelativePath(relativePath) {
    const normalized = relativePath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    // Lowercase all parts except the last (which might have extension)
    const loweredParts = parts.map((p, index) => {
        if (index === parts.length - 1) {
            // Last part: lowercase filename but preserve extension case
            const extMatch = p.match(/^(.+?)(\.[^.]+)?$/);
            if (extMatch) {
                const [, name, ext] = extMatch;
                return name.toLowerCase() + (ext || "");
            }
            return p.toLowerCase();
        }
        return p.toLowerCase();
    });
    return loweredParts.join("/");
}
/**
 * Safe file write - automatically normalizes path to lowercase
 *
 * @example
 * await safeWriteFile(repoPath, 'src/components/ui/Card.tsx', content);
 * // File written as: src/components/ui/card.tsx
 */
export async function safeWriteFile(projectRoot, relativePath, contents) {
    const lowerRel = normalizeRelativePath(relativePath);
    const full = path.join(projectRoot, lowerRel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, contents, "utf-8");
    if (lowerRel !== relativePath) {
        console.log(`🔡 [safeWriteFile] Normalized: ${relativePath} -> ${lowerRel}`);
    }
}
/**
 * Safe file rename - automatically normalizes paths to lowercase
 */
export async function safeRename(projectRoot, fromRelative, toRelative) {
    const from = path.join(projectRoot, normalizeRelativePath(fromRelative));
    const to = path.join(projectRoot, normalizeRelativePath(toRelative));
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    console.log(`🔡 [safeRename] ${fromRelative} -> ${toRelative}`);
}
/**
 * Safe file write (sync version for compatibility)
 */
export function safeWriteFileSync(projectRoot, relativePath, contents) {
    const lowerRel = normalizeRelativePath(relativePath);
    const full = path.join(projectRoot, lowerRel);
    const fsSync = require("fs");
    const pathSync = require("path");
    fsSync.mkdirSync(pathSync.dirname(full), { recursive: true });
    fsSync.writeFileSync(full, contents, "utf-8");
    if (lowerRel !== relativePath) {
        console.log(`🔡 [safeWriteFileSync] Normalized: ${relativePath} -> ${lowerRel}`);
    }
}
/**
 * Check if a file exists (case-insensitive on Windows)
 */
export async function safeExists(projectRoot, relativePath) {
    const lowerRel = normalizeRelativePath(relativePath);
    const full = path.join(projectRoot, lowerRel);
    try {
        await fs.access(full);
        return true;
    }
    catch {
        return false;
    }
}
