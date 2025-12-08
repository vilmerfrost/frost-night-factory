// =============================================================================
// SUPABASE CLIENT - Shared Supabase client for agent-runner
// =============================================================================
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
// Load environment variables if not already loaded
dotenv.config();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️ Supabase credentials not configured. Some features may not work.');
}
export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder-key');
