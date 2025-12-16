/**
 * Safe map/record access helpers
 * Use instead of direct map.get() or record[key] to avoid undefined errors
 */

/**
 * Get value from map or throw if not found
 * Use when the key MUST exist
 */
export function getOrThrow<K, V>(
  map: Map<K, V> | Record<string, V>,
  key: K | string,
  msg: string
): V {
  const value = map instanceof Map 
    ? map.get(key as K)
    : (map as Record<string, V>)[key as string];
  if (value === undefined) {
    throw new Error(msg);
  }
  return value;
}

/**
 * Get value from map or return fallback if not found
 * Use when a default value is acceptable
 */
export function getOrDefault<K, V>(
  map: Map<K, V> | Record<string, V>,
  key: K | string,
  fallback: V
): V {
  const value = map instanceof Map
    ? map.get(key as K)
    : (map as Record<string, V>)[key as string];
  return value ?? fallback;
}

/**
 * Get value from record or return fallback if not found
 * Convenience wrapper for Record<string, V>
 */
export function getRecordOrDefault<V>(
  record: Record<string, V>,
  key: string,
  fallback: V
): V {
  return record[key] ?? fallback;
}
