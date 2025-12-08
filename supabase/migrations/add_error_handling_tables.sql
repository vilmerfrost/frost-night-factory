-- =============================================================================
-- ERROR HANDLING TABLES - Track retries, errors, and circuit breaker state
-- =============================================================================

-- 1. Update pipelines table with retry tracking
ALTER TABLE pipelines 
  ADD COLUMN IF NOT EXISTS attempt_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_error_category TEXT,
  ADD COLUMN IF NOT EXISTS circuit_breaker_tripped BOOLEAN DEFAULT FALSE;

-- 2. Create pipeline_steps table (if not exists)
CREATE TABLE IF NOT EXISTS pipeline_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  is_critical BOOLEAN DEFAULT TRUE,
  attempt INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error_category TEXT,
  error_code TEXT,
  error_message TEXT,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_steps_pipeline_id ON pipeline_steps(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_steps_status ON pipeline_steps(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_steps_phase ON pipeline_steps(phase);

-- 3. Create error_events table
CREATE TABLE IF NOT EXISTS error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  pipeline_step_id UUID REFERENCES pipeline_steps(id) ON DELETE SET NULL,
  error_category TEXT NOT NULL,
  error_code TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  phase TEXT,
  retryable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_events_pipeline_id ON error_events(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_error_events_category ON error_events(error_category);
CREATE INDEX IF NOT EXISTS idx_error_events_created_at ON error_events(created_at DESC);

-- 4. Add helpful views
CREATE OR REPLACE VIEW error_summary AS
SELECT 
  error_category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE retryable = false) as non_retryable,
  COUNT(*) FILTER (WHERE retryable = true) as retryable,
  MAX(created_at) as last_occurrence
FROM error_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_category
ORDER BY count DESC;

CREATE OR REPLACE VIEW failed_pipelines_summary AS
SELECT 
  id,
  name,
  last_error_category,
  last_error,
  attempt_count,
  max_retries,
  circuit_breaker_tripped,
  updated_at
FROM pipelines 
WHERE status = 'failed'
ORDER BY updated_at DESC;

