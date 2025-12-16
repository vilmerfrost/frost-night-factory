// =============================================================================
// SUPABASE SERVER CLIENT - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// Canonical Supabase SSR server client implementation
// Matches Supabase recommended pattern: https://supabase.com/docs/guides/auth/server-side/creating-a-client

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => 
            cookieStore.set(name, value, options)
          );
        } catch {
          // OK in Server Components if you have proxy/middleware refresh
        }
      },
    },
  });
}

// Compat with generated code that uses createServerComponentClient
export async function createServerComponentClient(): Promise<SupabaseClient> {
  return createClient();
}

// === AUTO_CONTRACT_START ===
// This block is maintained by Frost Night Factory (DO NOT hand-edit exports here)
export const createServerClient = {} as any;
// === AUTO_CONTRACT_END ===
