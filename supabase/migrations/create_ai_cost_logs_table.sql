-- =============================================================================
-- AI COST LOGS TABLE - Track costs per pipeline and phase
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  phase TEXT NOT NULL, -- 'research', 'planner', 'coder', 'tester', 'ux_reviewer', etc.
  model TEXT NOT NULL, -- 'deepseek-chat', 'claude-3-5-sonnet', etc.
  provider TEXT NOT NULL, -- 'deepseek', 'claude', 'groq', 'openai', 'moonshot'
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  fix_attempts INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_pipeline_id ON public.ai_cost_logs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_phase ON public.ai_cost_logs(phase);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_model ON public.ai_cost_logs(model);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_created_at ON public.ai_cost_logs(created_at DESC);

-- Index for dashboard queries (by date range)
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_date_range ON public.ai_cost_logs(created_at DESC, phase, model);

