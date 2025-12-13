// lib/nightFactory/fileWriter.ts
// 🏰 FORTRESS: Safe file writer that blocks writes to Fortress paths

import * as fs from "fs";
import * as path from "path";
import { isFortressPath, isSandboxPath } from "../../agent-runner/lib/nightFactory/renamePolicy";

/**
 * Safe file writer that blocks writes to Fortress-protected paths
 * All AI agents should use this function instead of direct fs.writeFileSync
 */
export function safeWriteFile(
  absolutePath: string,
  content: string,
  options?: { allowSandboxOnly?: boolean }
): void {
  const normalized = absolutePath.replace(/\\/g, "/");

  // 🛡️ HÅRD VÄGG: AI får inte skriva till Fortress-paths
  if (isFortressPath(normalized)) {
    throw new Error(
      `[FORTRESS] Attempt to write into Fortress path blocked: ${normalized}\n` +
        `Fortress files are protected and cannot be modified by AI agents.`
    );
  }

  // Optional: Block writes outside sandbox if allowSandboxOnly is true
  if (options?.allowSandboxOnly && !isSandboxPath(normalized)) {
    throw new Error(
      `[FORTRESS] Attempt to write outside sandbox blocked: ${normalized}\n` +
        `Only sandbox paths are allowed when allowSandboxOnly is enabled.`
    );
  }

  // Create directory if it doesn't exist
  const dir = path.dirname(absolutePath);
  fs.mkdirSync(dir, { recursive: true });

  // Write file
  fs.writeFileSync(absolutePath, content, "utf8");
}

/**
 * Check if a path is safe to write to (not Fortress-protected)
 */
export function isSafeToWrite(filePath: string): boolean {
  return !isFortressPath(filePath.replace(/\\/g, "/"));
}

