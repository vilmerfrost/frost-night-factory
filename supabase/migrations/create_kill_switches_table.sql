-- =============================================================================
-- KILL SWITCHES TABLE - Emergency controls for production
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kill_switches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default kill switches
INSERT INTO public.kill_switches (id, name, description, enabled) VALUES
  ('force_cheap_models', 'Force Cheap Models', 'Force all tasks to use cheapest models (DeepSeek/Groq)', false),
  ('disable_hive_mind', 'Disable Hive Mind', 'Disable Hive Mind fix caching to prevent regressions', false),
  ('disable_claude', 'Disable Claude', 'Disable Claude models (use DeepSeek/Groq only)', false),
  ('disable_gpt4', 'Disable GPT-4', 'Disable GPT-4 models', false),
  ('disable_ux_reviewer', 'Disable UX Reviewer', 'Disable UX reviewer agent', false)
ON CONFLICT (id) DO NOTHING;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_kill_switches_enabled ON public.kill_switches(enabled);

