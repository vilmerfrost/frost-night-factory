// agent-runner/lib/file-writer.ts
// Atomic file writer - prevents partial reads and corruption

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import fs from 'fs/promises';
import path from 'path';

/**
 * Write file atomically (prevents partial reads)
 * 1. Write to temp file first
 * 2. Rename to target (atomic operation)
 * This ensures readers never see a half-written file
 */
async function writeFileAtomic(targetPath: string, contents: string): Promise<void> {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  
  // Use a hidden temp file to avoid accidentally picking it up in scans
  const tempPath = path.join(
    dir,
    `.${base}.${process.pid}.${Date.now()}.tmp`
  );

  try {
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write to temp file first
    await fs.writeFile(tempPath, contents, 'utf-8');

    // Rename to target (Atomic operation on most filesystems)
    // Either the old file remains, or the new one fully appears
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Safely write JSON to disk using atomic write semantics
 * Ensures the file is never visible in a partially written state
 */
export async function writeJsonSafely(targetPath: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2) + '\n';
  await writeFileAtomic(targetPath, json);
}

/**
 * Write file to disk with atomic semantics for critical files
 * Prevents race conditions where readers see partial writes
 */
export async function writeFileToDisk(
  targetPath: string,
  contents: string | Buffer
): Promise<void> {
  const contentString = typeof contents === 'string' ? contents : contents.toString('utf8');

  // Use atomic write for critical/JSON files to prevent corruption
  if (
    targetPath.endsWith('.json') ||
    targetPath.endsWith('.ts') ||
    targetPath.endsWith('.tsx') ||
    targetPath.endsWith('.js') ||
    targetPath.endsWith('.jsx')
  ) {
    await writeFileAtomic(targetPath, contentString);
  } else {
    // Non-critical files can use normal write
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(targetPath, contentString, 'utf-8');
  }
}

/**
 * Write file synchronously (for compatibility with existing code)
 * Uses atomic write for critical files
 */
export function writeFileSyncSafe(targetPath: string, contents: string): void {
  const fsSync = require('fs');
  const dir = path.dirname(targetPath);

  // Ensure directory exists
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }

  // For critical files, use atomic write
  if (
    targetPath.endsWith('.json') ||
    targetPath.endsWith('.ts') ||
    targetPath.endsWith('.tsx')
  ) {
    const base = path.basename(targetPath);
    const tempPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
    
    try {
      fsSync.writeFileSync(tempPath, contents, 'utf-8');
      fsSync.renameSync(tempPath, targetPath);
    } catch (error) {
      try {
        fsSync.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  } else {
    fsSync.writeFileSync(targetPath, contents, 'utf-8');
  }
}

