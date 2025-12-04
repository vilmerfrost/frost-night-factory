-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: 20251205_archiving_and_events.sql
-- Phase 0 Quick Wins: Pipeline archiving and event logging
-- ═══════════════════════════════════════════════════════════════════

-- Add archiving column to pipelines
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Create view for active pipelines (excludes archived)
CREATE OR REPLACE VIEW active_pipelines AS
SELECT * FROM pipelines
WHERE archived_at IS NULL;

-- Create pipeline_events table for detailed event logging
CREATE TABLE IF NOT EXISTS pipeline_events (
  id BIGSERIAL PRIMARY KEY,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'STEP_START', 'STEP_COMPLETE', 'CIRCUIT_BREAKER', 'SNAPSHOT', 'ERROR', 'RETRY'
  step_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_events_pipeline 
  ON pipeline_events(pipeline_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_type 
  ON pipeline_events(event_type, created_at DESC);

-- Create agent_memory table for storing successful patterns (Phase 1)
CREATE TABLE IF NOT EXISTS agent_memory (
  id BIGSERIAL PRIMARY KEY,
  error_signature TEXT,
  solution TEXT,  -- The code that worked
  reflection TEXT,  -- What we learned
  attempts_needed INT,
  success_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_signature 
  ON agent_memory(error_signature);

-- Function to archive old pipelines (run manually when needed)
CREATE OR REPLACE FUNCTION archive_old_pipelines(days_old INT DEFAULT 7)
RETURNS INT AS $$
DECLARE
  archived_count INT;
BEGIN
  UPDATE pipelines
  SET archived_at = NOW()
  WHERE status IN ('completed', 'failed_hard', 'dead_letter')
    AND created_at < NOW() - (days_old || ' days')::INTERVAL
    AND archived_at IS NULL;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

