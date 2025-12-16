// agent-runner/lib/workspace/config.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Safe realpath that falls back to resolve if realpath fails.
 */
function safeRealpath(p: string): string {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * Canonical workspace root.
 * Anchor to the agent-runner folder (NOT process.cwd()) so "cd .." won't break security.
 */
function defaultWorkspaceRoot(): string {
  // In ESM, __dirname doesn't exist, so we use import.meta.url
  // This file is at: <repo>/agent-runner/lib/workspace/config.ts
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // __dirname = <repo>/agent-runner/lib/workspace
  const agentRunnerRoot = path.resolve(__dirname, "..", ".."); // -> <repo>/agent-runner
  return path.join(agentRunnerRoot, "workspace", "sandbox");
}

/**
 * Single source of truth for workspace root.
 * ALL code must use this function to get the workspace root.
 * 
 * This prevents workspace root mismatches that can cause:
 * - Path checks that "pass" but write outside confinement
 * - Rehydration looking in wrong pipeline directory
 * - "Missing critical files" errors despite files existing in another root
 */
export function getWorkspaceRoot(): string {
  // Allow override via env var for testing/deployment
  const envRoot = (process.env.FROST_WORKSPACE_ROOT ?? "").trim();
  if (envRoot) {
    return path.resolve(envRoot);
  }
  // Default: always anchor to agent-runner/workspace/sandbox regardless of process.cwd()
  return defaultWorkspaceRoot();
}

/**
 * Security check: ensures a path is inside the workspace root.
 * Throws if path escapes confinement.
 * 
 * Use this before ANY file operation to prevent:
 * - Writing outside workspace
 * - Reading sensitive files
 * - Path traversal attacks
 */
export function assertInsideWorkspace(absPath: string): void {
  const root = getWorkspaceRoot();
  const rootReal = safeRealpath(root);
  const targetReal = safeRealpath(path.resolve(absPath));

  const rel = path.relative(rootReal, targetReal);

  // Outside if it starts with ".." (or is absolute in weird edge cases)
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `[SECURITY] Path escapes workspace root.\n` +
      `root=${rootReal}\n` +
      `path=${targetReal}\n` +
      `relative=${rel}`
    );
  }
}

/**
 * Get pipeline directory path (safe, validated)
 */
export function getPipelineDir(pipelineId: string): string {
  const root = getWorkspaceRoot();
  const pipelineDir = path.join(root, `pipeline-${pipelineId}`);
  assertInsideWorkspace(pipelineDir);
  return pipelineDir;
}

