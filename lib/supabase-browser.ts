"use client";

// ✅ Use singleton client from utils/supabase/client.ts to prevent multiple instances
import { createClient } from "@/utils/supabase/client";

// Export singleton instance for backward compatibility
export const supabaseBrowser = createClient();

