// lib/utils/strings.ts
/**
 * String utility functions for safe parsing and manipulation
 */

/**
 * Split a string once at the first occurrence of a delimiter.
 * Returns null if the delimiter is not found.
 * 
 * @example
 * const parts = splitOnce("import Default, { A }", "{");
 * if (parts) {
 *   const [defPart, namedPart] = parts;
 *   // defPart = "import Default, "
 *   // namedPart = " A }"
 * }
 */
export function splitOnce(input: string, delim: string): [string, string] | null {
  const idx = input.indexOf(delim);
  if (idx === -1) return null;
  return [input.slice(0, idx), input.slice(idx + delim.length)];
}
