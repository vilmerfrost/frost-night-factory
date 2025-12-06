-- =============================================================================
-- SYSTEM PROMPTS TABLE - Store editable system prompts
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE, -- 'planner', 'coder', 'tester', 'reviewer', 'fixer'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_prompts_type ON public.system_prompts(type);

