-- =============================================================================
-- PIPELINE LOGS TABLE - Store pipeline execution logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pipeline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error', 'success'
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_pipeline_id ON public.pipeline_logs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_created_at ON public.pipeline_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_level ON public.pipeline_logs(level);

-- Index for streaming queries
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_pipeline_date ON public.pipeline_logs(pipeline_id, created_at DESC);

