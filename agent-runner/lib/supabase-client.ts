// agent-runner/lib/supabase-client.ts
// ✅ LAZY SUPABASE CLIENT - No side effects on import

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Get Supabase client (lazy initialization)
 * Returns null if env vars are missing (no throw on import!)
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    // ✅ IMPORTANT: No throw on import - just return null
    // This allows code to work even if Supabase is not configured
    return null;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false },
  });

  return cached;
}

/**
 * Reset cached client (useful for testing)
 */
export function resetSupabaseClient(): void {
  cached = null;
}

