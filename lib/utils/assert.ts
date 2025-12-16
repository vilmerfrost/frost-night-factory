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

/**
 * Type guard: Check if value is defined (not null or undefined)
 */
export function isDefined<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

/**
 * Assert that a value is a non-empty string
 */
export function assertNonEmptyString(v: string | undefined | null, msg: string): string {
  if (!v || v.trim().length === 0) throw new Error(msg);
  return v;
}

/**
 * Assert that a value is non-null (for supabase client, etc.)
 */
export function assertNonNull<T>(value: T | null | undefined, message?: string): asserts value is NonNullable<T> {
  if (value == null) throw new Error(message ?? "Expected value to be non-null");
}

/**
 * Assert that an array is non-empty
 * Returns a type that guarantees at least one element
 */
export function assertNonEmptyArray<T>(
  arr: T[] | null | undefined,
  message = "Expected non-empty array"
): asserts arr is [T, ...T[]] {
  if (!arr || arr.length === 0) throw new Error(message);
}
