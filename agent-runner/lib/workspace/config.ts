// agent-runner/lib/workspace/config.ts
import path from "node:path";

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
  // ENDA stället som definierar root
  return path.resolve(process.cwd(), "workspace", "sandbox");
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
  const resolved = path.resolve(absPath);

  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `[SECURITY] Path escapes workspace root.\n` +
      `root=${root}\n` +
      `path=${resolved}\n` +
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

