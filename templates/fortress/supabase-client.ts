// =============================================================================
// SUPABASE BROWSER CLIENT - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// Canonical Supabase SSR browser client implementation
// Matches Supabase recommended pattern: https://supabase.com/docs/guides/auth/server-side/creating-a-client

import { createBrowserClient as createBrowserClientSSR } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient(): SupabaseClient {
  return createBrowserClientSSR(url, key);
}

// Compat with generated code that uses createBrowserClient
export function createBrowserClient(): SupabaseClient {
  return createClient();
}

// Compat with generated code that uses supabaseClient
export const supabaseClient = createClient();

// === AUTO_CONTRACT_START ===
// This block is maintained by Frost Night Factory (DO NOT hand-edit exports here)
export const supabase = {} as any;
// === AUTO_CONTRACT_END ===
