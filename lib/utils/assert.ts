// lib/utils/assert.ts
/**
 * ✅ Assertion helper for strict TypeScript checks
 * Use instead of non-null assertions (!) for better error messages
 */

export function assertDefined<T>(
  value: T | undefined | null,
  message = "Expected value to be defined"
): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}

/**
 * Assert that a value is not undefined (for array access, optional chaining, etc.)
 */
export function assertNotUndefined<T>(
  value: T | undefined,
  message?: string
): T {
  if (value === undefined) {
    throw new Error(message || "Expected value to be defined");
  }
  return value;
}
