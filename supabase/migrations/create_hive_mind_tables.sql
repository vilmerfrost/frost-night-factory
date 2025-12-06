-- =============================================================================
-- HIVE MIND LEARNING SYSTEM - Database Schema
-- =============================================================================
-- Phase 1-4: Error caching, pattern learning, model routing, fine-tuning prep

-- Phase 1: Hive Mind Solutions Cache
CREATE TABLE IF NOT EXISTS public.hive_mind_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_signature VARCHAR(64) NOT NULL, -- Hash of normalized error + file
  error_type VARCHAR(50) NOT NULL, -- MISSING_MODULE, IMPORT_ERROR, etc.
  target_file TEXT,
  error_message TEXT NOT NULL,
  successful_fix TEXT NOT NULL, -- The code/patch that worked
  ai_model_used VARCHAR(50) NOT NULL, -- gpt-4-turbo, deepseek-chat, etc.
  success_rate DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0
  times_reused INT DEFAULT 0,
  times_succeeded INT DEFAULT 1,
  times_failed INT DEFAULT 0,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small = 1536 dims
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for fast lookup
  CONSTRAINT unique_error_signature UNIQUE(error_signature)
);

CREATE INDEX idx_hive_mind_error_type ON public.hive_mind_solutions(error_type);
CREATE INDEX idx_hive_mind_success_rate ON public.hive_mind_solutions(success_rate DESC);
CREATE INDEX idx_hive_mind_last_used ON public.hive_mind_solutions(last_used_at DESC);

-- Phase 2: Pipeline Runs (per phase tracking)
CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  phase VARCHAR(50) NOT NULL, -- coder, tester, visual, e2e, lighthouse
  status VARCHAR(50) NOT NULL, -- success, failed, needs_review
  ai_model_used VARCHAR(50),
  cost_usd DECIMAL(10,6) DEFAULT 0,
  duration_ms INT,
  tokens_used INT,
  error_types TEXT[], -- Array of error types encountered
  fixes_applied TEXT[], -- Array of fix kinds applied
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_runs_pipeline_id ON public.pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_phase ON public.pipeline_runs(phase);
CREATE INDEX idx_pipeline_runs_status ON public.pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_model ON public.pipeline_runs(ai_model_used);

-- Phase 2: Error Events (detailed error tracking)
CREATE TABLE IF NOT EXISTS public.error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  error_code VARCHAR(50), -- TS2307, ENOENT, etc.
  error_hash VARCHAR(64) NOT NULL, -- Hash of normalized error message
  error_message TEXT NOT NULL,
  file_path TEXT,
  line_number INT,
  error_type VARCHAR(50), -- MISSING_MODULE, IMPORT_ERROR, etc.
  ai_model_used VARCHAR(50),
  fix_applied TEXT,
  fix_successful BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_events_error_hash ON public.error_events(error_hash);
CREATE INDEX idx_error_events_error_type ON public.error_events(error_type);
CREATE INDEX idx_error_events_pipeline_id ON public.error_events(pipeline_id);
CREATE INDEX idx_error_events_model ON public.error_events(ai_model_used);

-- Phase 2: Fix Candidates (what AI tried)
CREATE TABLE IF NOT EXISTS public.fix_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_event_id UUID REFERENCES error_events(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  fix_code TEXT NOT NULL,
  ai_model_used VARCHAR(50) NOT NULL,
  prompt_used TEXT,
  outcome VARCHAR(50), -- success, failed, partial
  build_passed BOOLEAN,
  tests_passed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fix_candidates_error_event ON public.fix_candidates(error_event_id);
CREATE INDEX idx_fix_candidates_outcome ON public.fix_candidates(outcome);
CREATE INDEX idx_fix_candidates_model ON public.fix_candidates(ai_model_used);

-- Phase 3: Model Performance Tracking
CREATE TABLE IF NOT EXISTS public.model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type VARCHAR(50) NOT NULL,
  ai_model VARCHAR(50) NOT NULL,
  total_attempts INT DEFAULT 0,
  successful_fixes INT DEFAULT 0,
  failed_fixes INT DEFAULT 0,
  avg_cost_usd DECIMAL(10,6) DEFAULT 0,
  avg_duration_ms INT DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_model_error_type UNIQUE(error_type, ai_model)
);

CREATE INDEX idx_model_performance_error_type ON public.model_performance(error_type);
CREATE INDEX idx_model_performance_success_rate ON public.model_performance(success_rate DESC);

-- Phase 3: Feedback Records (user/system feedback)
CREATE TABLE IF NOT EXISTS public.feedback_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  error_types TEXT[],
  models_used TEXT[],
  fixes_applied TEXT[],
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_records_pipeline_id ON public.feedback_records(pipeline_id);
CREATE INDEX idx_feedback_records_rating ON public.feedback_records(rating);

-- Phase 4: Training Data Collection (for fine-tuning)
CREATE TABLE IF NOT EXISTS public.training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_signature VARCHAR(64) NOT NULL,
  error_type VARCHAR(50) NOT NULL,
  error_message TEXT NOT NULL,
  context_code TEXT, -- Code context around error
  successful_fix TEXT NOT NULL,
  explanation TEXT, -- Why this fix works
  verified BOOLEAN DEFAULT false, -- Human-verified
  quality_score DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_data_error_type ON public.training_data(error_type);
CREATE INDEX idx_training_data_verified ON public.training_data(verified);
CREATE INDEX idx_training_data_quality ON public.training_data(quality_score DESC);

-- Function to update success_rate in hive_mind_solutions
CREATE OR REPLACE FUNCTION update_hive_mind_success_rate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.success_rate = CASE 
    WHEN (NEW.times_succeeded + NEW.times_failed) > 0 
    THEN NEW.times_succeeded::DECIMAL / (NEW.times_succeeded + NEW.times_failed)
    ELSE 0
  END;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hive_mind_success_rate
  BEFORE INSERT OR UPDATE ON public.hive_mind_solutions
  FOR EACH ROW
  EXECUTE FUNCTION update_hive_mind_success_rate();

-- Function to update model_performance success_rate
CREATE OR REPLACE FUNCTION update_model_performance_rate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.success_rate = CASE 
    WHEN NEW.total_attempts > 0 
    THEN NEW.successful_fixes::DECIMAL / NEW.total_attempts
    ELSE 0
  END;
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_performance_rate
  BEFORE INSERT OR UPDATE ON public.model_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_model_performance_rate();

