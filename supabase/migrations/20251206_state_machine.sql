-- =============================================================================
-- STATE MACHINE MIGRATION - State-driven error tracking
-- =============================================================================
-- Run this in Supabase SQL Editor

-- Create ENUM for strict state management (if they don't exist)
DO $$ BEGIN
    CREATE TYPE pipeline_phase AS ENUM ('planner', 'coder', 'tester', 'deployer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE phase_status AS ENUM ('idle', 'running', 'success', 'failed', 'blocked', 'needs_review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE error_type AS ENUM ('SYNTAX', 'IMPORT', 'BUILD', 'RUNTIME', 'NETWORK', 'RATE_LIMIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update pipelines table with new columns
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'planner';
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS phase_status TEXT DEFAULT 'idle';
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS phase_attempt INT DEFAULT 0;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS last_error_type TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS last_error_hash TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS worker_id TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_state ON pipelines (phase, phase_status);
CREATE INDEX IF NOT EXISTS idx_pipelines_heartbeat ON pipelines (last_heartbeat) 
  WHERE phase_status = 'running';
CREATE INDEX IF NOT EXISTS idx_pipelines_worker ON pipelines (worker_id) 
  WHERE worker_id IS NOT NULL;

-- Error state tracking table
CREATE TABLE IF NOT EXISTS error_state (
  error_hash TEXT PRIMARY KEY,
  error_type TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_attempts INT DEFAULT 1,
  successful_fixes INT DEFAULT 0,
  last_outcome TEXT,
  last_model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dead letter queue for rejected artifacts
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarantine_id TEXT NOT NULL,
  raw_code TEXT,
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlq_created ON dead_letter_queue (created_at DESC);

-- Claim pipeline function (with FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION claim_pipeline(p_worker_id TEXT)
RETURNS TABLE (
  id UUID,
  phase TEXT,
  phase_status TEXT,
  phase_attempt INT
) AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT p.id
    FROM pipelines p
    WHERE p.phase_status = 'idle'
      AND p.worker_id IS NULL
    ORDER BY p.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED  -- Gemini's magic sauce for concurrency
  )
  UPDATE pipelines
  SET 
    phase_status = 'running',
    worker_id = p_worker_id,
    last_heartbeat = NOW(),
    updated_at = NOW()
  FROM claimed
  WHERE pipelines.id = claimed.id
  RETURNING pipelines.id, pipelines.phase, pipelines.phase_status, pipelines.phase_attempt;
END;
$$ LANGUAGE plpgsql;

-- Upsert error state function
CREATE OR REPLACE FUNCTION upsert_error_state(
  p_error_hash TEXT,
  p_error_type TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO error_state (error_hash, error_type, total_attempts, last_seen_at)
  VALUES (p_error_hash, p_error_type, 1, NOW())
  ON CONFLICT (error_hash) DO UPDATE SET
    total_attempts = error_state.total_attempts + 1,
    last_seen_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Increment helper function
CREATE OR REPLACE FUNCTION increment(current_value INT, x INT DEFAULT 1)
RETURNS INT AS $$
BEGIN
  RETURN COALESCE(current_value, 0) + x;
END;
$$ LANGUAGE plpgsql;

-- Zombie reaper function
CREATE OR REPLACE FUNCTION reset_zombie_pipelines()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Reset pipelines with stale heartbeat (>2 minutes old)
  WITH zombies AS (
    UPDATE pipelines
    SET 
      phase_status = 'idle',
      worker_id = NULL,
      last_heartbeat = NULL,
      last_error_message = 'Zombie detection: Worker died',
      updated_at = NOW()
    WHERE 
      phase_status = 'running'
      AND last_heartbeat < NOW() - INTERVAL '2 minutes'
      AND phase_attempt < 5  -- Don't resurrect if max attempts
    RETURNING id
  )
  SELECT COUNT(*) INTO affected_count FROM zombies;
  
  -- Log zombie reaping
  IF affected_count > 0 THEN
    RAISE NOTICE 'Zombie reaper: Reset % stale pipelines', affected_count;
  END IF;
  
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION reset_zombie_pipelines() IS 
  'Resets pipelines that have not sent heartbeat in >2 minutes (zombie detection)';

-- Schedule zombie reaper (requires pg_cron extension)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule(
--   'zombie-reaper',
--   '* * * * *',  -- Every minute
--   $$ SELECT reset_zombie_pipelines(); $$
-- );

-- Grant permissions
GRANT EXECUTE ON FUNCTION claim_pipeline(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_error_state(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_zombie_pipelines() TO authenticated;
GRANT SELECT, INSERT, UPDATE ON error_state TO authenticated;
GRANT SELECT, INSERT ON dead_letter_queue TO authenticated;

-- Success message
SELECT 'State machine migration complete!' as status;

