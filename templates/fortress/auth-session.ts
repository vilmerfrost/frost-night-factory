// =============================================================================
// AUTH SESSION HELPERS - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type { Session } from '@supabase/supabase-js';

export async function getUserSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
