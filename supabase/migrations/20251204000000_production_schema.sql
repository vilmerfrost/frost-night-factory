-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: 20251204_production_schema.sql
-- Production-ready schema with cost tracking and error caching
-- ═══════════════════════════════════════════════════════════════════

-- Add cost tracking to pipelines
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS total_ai_cost_cents INT DEFAULT 0;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS total_tokens_in INT DEFAULT 0;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS total_tokens_out INT DEFAULT 0;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS error_signature TEXT;

-- Add detailed tracking to pipeline_steps
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS ai_cost_cents INT DEFAULT 0;
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS tokens_in INT DEFAULT 0;
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS tokens_out INT DEFAULT 0;
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create ai_calls table (granular tracking)
CREATE TABLE IF NOT EXISTS ai_calls (
  id BIGSERIAL PRIMARY KEY,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  step_name TEXT,
  model TEXT,
  role TEXT, -- 'PLANNER', 'CODER', 'FIXER', 'REVIEWER'
  prompt_signature TEXT, -- hash for cache lookup
  tokens_in INT,
  tokens_out INT,
  cost_cents INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create error_patterns table (LLM cache + Golden fixes)
CREATE TABLE IF NOT EXISTS error_patterns (
  id BIGSERIAL PRIMARY KEY,
  error_code TEXT, -- 'TS6133', 'TS1005', etc.
  error_signature TEXT UNIQUE, -- detailed hash
  classification TEXT, -- 'TS_UNUSED', 'TS_SYNTAX', 'AI_PLACEHOLDER', etc.
  fix_strategy TEXT, -- 'SANITIZE', 'REGEN', 'GOLDEN_TEMPLATE', 'STOP'
  golden_patch JSONB, -- cached fix
  occurrences INT DEFAULT 0,
  success_rate FLOAT DEFAULT 0.0,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_status_created 
  ON pipelines(status, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_steps_pipeline_name 
  ON pipeline_steps(pipeline_id, name);
  
CREATE INDEX IF NOT EXISTS idx_ai_calls_pipeline 
  ON ai_calls(pipeline_id);
  
CREATE INDEX IF NOT EXISTS idx_error_patterns_signature 
  ON error_patterns(error_signature);

-- Function to increment pipeline cost atomically
CREATE OR REPLACE FUNCTION increment_pipeline_cost(
  p_pipeline_id UUID,
  p_cost_cents INT,
  p_tokens_in INT,
  p_tokens_out INT
) RETURNS VOID AS $$
BEGIN
  UPDATE pipelines
  SET 
    total_ai_cost_cents = total_ai_cost_cents + p_cost_cents,
    total_tokens_in = total_tokens_in + p_tokens_in,
    total_tokens_out = total_tokens_out + p_tokens_out,
    updated_at = NOW()
  WHERE id = p_pipeline_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record error pattern and update statistics
CREATE OR REPLACE FUNCTION record_error_pattern(
  p_error_code TEXT,
  p_error_signature TEXT,
  p_classification TEXT,
  p_fix_strategy TEXT,
  p_success BOOLEAN,
  p_golden_patch JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_existing_id BIGINT;
  v_current_occurrences INT;
  v_current_successes INT;
  v_new_success_rate FLOAT;
BEGIN
  -- Check if pattern exists
  SELECT id, occurrences, 
         CAST((success_rate * occurrences) AS INT) INTO 
         v_existing_id, v_current_occurrences, v_current_successes
  FROM error_patterns
  WHERE error_signature = p_error_signature;
  
  IF v_existing_id IS NOT NULL THEN
    -- Update existing pattern
    v_new_success_rate := CASE 
      WHEN p_success THEN 
        ((v_current_successes + 1)::FLOAT / (v_current_occurrences + 1))
      ELSE 
        (v_current_successes::FLOAT / (v_current_occurrences + 1))
    END;
    
    UPDATE error_patterns
    SET 
      occurrences = occurrences + 1,
      success_rate = v_new_success_rate,
      last_seen_at = NOW(),
      golden_patch = COALESCE(p_golden_patch, golden_patch)
    WHERE id = v_existing_id;
  ELSE
    -- Insert new pattern
    INSERT INTO error_patterns (
      error_code,
      error_signature,
      classification,
      fix_strategy,
      occurrences,
      success_rate,
      golden_patch
    ) VALUES (
      p_error_code,
      p_error_signature,
      p_classification,
      p_fix_strategy,
      1,
      CASE WHEN p_success THEN 1.0 ELSE 0.0 END,
      p_golden_patch
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

