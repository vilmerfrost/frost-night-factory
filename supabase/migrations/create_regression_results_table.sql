-- =============================================================================
-- REGRESSION RESULTS TABLE - Track prompt regression tests
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.regression_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT false,
  ux_score DECIMAL(3, 1) NOT NULL DEFAULT 0,
  expected_ux_score DECIMAL(3, 1) NOT NULL DEFAULT 0,
  files_created INTEGER NOT NULL DEFAULT 0,
  expected_files INTEGER NOT NULL DEFAULT 0,
  errors TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_regression_results_task_id ON public.regression_results(task_id);
CREATE INDEX IF NOT EXISTS idx_regression_results_created_at ON public.regression_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regression_results_passed ON public.regression_results(passed);

-- Index for trend analysis
CREATE INDEX IF NOT EXISTS idx_regression_results_task_date ON public.regression_results(task_id, created_at DESC);

