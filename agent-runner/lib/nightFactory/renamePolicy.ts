// agent-runner/lib/nightFactory/renamePolicy.ts
// 🏰 FORTRESS: Central policy for .ts → .tsx evolution
// This module is read-only for AI agents and controls all file extension evolution

import * as path from "path";

/**
 * Check if a file path is within the sandbox workspace
 */
export function isSandboxPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  // Match workspace/sandbox/ paths
  return normalized.includes("/workspace/sandbox/");
}

/**
 * Check if a file path is within Fortress-protected zones
 */
export function isFortressPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");

  const fortressRoots = [
    "/agent-runner/lib/nightFactory/",
    "/agent-runner/pipeline-runner.ts",
    "/agent-runner/dispatcher.ts",
    "/agent-runner/model-router.ts",
    "/lib/nightFactory/",
  ];

  return fortressRoots.some((root) => normalized.includes(root));
}

/**
 * Heuristic: Does the file content look like it contains JSX?
 */
export function fileContentLooksLikeJsx(content: string): boolean {
  if (!content) return false;

  const jsxPatterns = [
    /return\s*<[\w]/,
    /<\w+[^>]*className=("|')/,
    /<\/\w+>/,
    /<[A-Z]\w+[^>]*>/,
    /from\s+['"]react['"]/,
  ];

  return jsxPatterns.some((re) => re.test(content));
}

/**
 * Patterns for files that should NEVER be renamed from .ts to .tsx
 */
const NEVER_RENAME_PATTERNS = [
  /\/app\/api\/.+\/route\.ts$/,
  /\/pages\/api\/.+\.ts$/,
  /\/next-env\.d\.ts$/,
  /\/next\.config\.m?js$/,
  /\.d\.ts$/,
  /\/lib\/types\.ts$/,  // ✅ GOLDEN/FORTRESS: types.ts is always .ts, never .tsx
  /\/lib\/api\.ts$/,     // ✅ lib/api.ts should be pure TypeScript (fetch/helpers)
  /\/lib\/claude-client\.ts$/,  // ✅ lib/claude-client.ts should be pure TypeScript (client wrapper)
];

/**
 * Patterns for paths where JSX in .ts is explicitly allowed (empty by default)
 */
const ALLOW_JSX_IN_TS_PATTERNS: RegExp[] = [
  // Empty by default - JSX should always be in .tsx
];

/**
 * Check if JSX is explicitly allowed in .ts for this path
 */
export function shouldAllowJsxInTs(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ALLOW_JSX_IN_TS_PATTERNS.some((re) => re.test(normalized));
}

/**
 * Main policy function: Should this .ts file be renamed to .tsx?
 * 
 * Returns true if:
 * - File is in sandbox (not Fortress)
 * - File contains JSX
 * - File doesn't match NEVER_RENAME patterns
 * - JSX is not explicitly allowed in .ts for this path
 */
export function shouldRenameTsToTsx(filePath: string, content: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");

  // 1️⃣ Fortress-kod får ALDRIG rename:as automatiskt
  if (isFortressPath(normalized)) {
    return false;
  }

  // 2️⃣ Bara sandboxad app-kod får auto-evolution
  if (!isSandboxPath(normalized)) {
    return false;
  }

  // 3️⃣ Om vi uttryckligen tillåter JSX i .ts här → ingen rename
  if (shouldAllowJsxInTs(normalized)) {
    return false;
  }

  // 4️⃣ Om filen matchar en "never rename"-regel → stanna
  if (NEVER_RENAME_PATTERNS.some((re) => re.test(normalized))) {
    return false;
  }

  // 5️⃣ Inga JSX-heuristik-träffar → inget att göra
  if (!fileContentLooksLikeJsx(content)) {
    return false;
  }

  // 6️⃣ Nu vet vi:
  // - filen ligger i sandbox
  // - inte Fortress
  // - inte undantagen
  // - innehåller JSX
  // → den SKA bli .tsx
  return true;
}

