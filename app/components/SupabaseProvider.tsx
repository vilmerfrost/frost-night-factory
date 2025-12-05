'use client'

import { createClient } from '@/utils/supabase/client'
import { createContext, useContext, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const SupabaseContext = createContext<SupabaseClient | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  // Initialize ONCE using useState initializer (prevents re-creation on re-renders)
  const [supabase] = useState(() => createClient())

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within SupabaseProvider')
  }
  return context
}

