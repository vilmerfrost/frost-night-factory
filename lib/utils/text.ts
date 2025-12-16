// lib/utils/text.ts
/**
 * ✅ Safe text/array access helpers for TypeScript strict mode
 * Use instead of direct array/string indexing to avoid "possibly undefined" errors
 */

/**
 * Safe line access from array
 * Returns undefined if index is out of bounds
 */
export function lineAt(lines: string[], i: number): string | undefined {
  return i >= 0 && i < lines.length ? lines[i] : undefined;
}

/**
 * Safe character access from string
 * Returns undefined if string is undefined or index is out of bounds
 */
export function charAt(s: string | undefined, i: number): string | undefined {
  return s && i >= 0 && i < s.length ? s[i] : undefined;
}
