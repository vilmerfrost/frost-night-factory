-- Create pipeline_errors table for comprehensive error logging
-- This table stores all error attempts during pipeline execution

CREATE TABLE IF NOT EXISTS public.pipeline_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  step_id UUID,
  phase TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.pipeline_errors IS 'Stores all errors encountered during pipeline execution';
COMMENT ON COLUMN public.pipeline_errors.pipeline_id IS 'Reference to the pipeline that encountered the error';
COMMENT ON COLUMN public.pipeline_errors.phase IS 'Pipeline phase where error occurred (research, coder, tester, etc)';
COMMENT ON COLUMN public.pipeline_errors.error_type IS 'Classification of error (build_error, runtime_error, etc)';
COMMENT ON COLUMN public.pipeline_errors.retry_count IS 'Which attempt number this error occurred on';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_pipeline_errors_pipeline_id 
  ON public.pipeline_errors(pipeline_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_errors_created_at 
  ON public.pipeline_errors(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_errors_phase 
  ON public.pipeline_errors(phase);

-- Enable Row Level Security
ALTER TABLE public.pipeline_errors ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert errors
CREATE POLICY "Service role can insert errors"
  ON public.pipeline_errors
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can read errors
CREATE POLICY "Service role can read errors"
  ON public.pipeline_errors
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Service role can update errors (for retry counts)
CREATE POLICY "Service role can update errors"
  ON public.pipeline_errors
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can delete old errors (for cleanup)
CREATE POLICY "Service role can delete errors"
  ON public.pipeline_errors
  FOR DELETE
  TO service_role
  USING (true);
