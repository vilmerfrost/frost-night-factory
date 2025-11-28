"use client";

import { createContext, useContext, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";

const SupabaseContext = createContext<any>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return context;
}

