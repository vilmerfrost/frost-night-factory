/**
 * Safe argv parsing helpers
 * Use instead of direct argv[i] access to avoid undefined errors
 */

import { assertDefined } from "./assert";

/**
 * Get next argument from argv array
 * Throws if argument is missing
 */
export function nextArg(argv: string[], i: number, name: string): string {
  const v = argv[i + 1];
  assertDefined(v, `Missing value after ${name}`);
  return v;
}

/**
 * Get next argument from argv array with fallback
 * Returns fallback if argument is missing
 */
export function nextArgOrDefault(argv: string[], i: number, fallback: string): string {
  return argv[i + 1] ?? fallback;
}

/**
 * Get argument at index with fallback
 */
export function argAt(argv: string[], i: number, fallback: string = ""): string {
  return argv[i] ?? fallback;
}
