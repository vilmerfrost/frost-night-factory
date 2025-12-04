-- Migration: Create atomic pipeline creation function
-- This ensures ACID-compliant pipeline creation with all steps

CREATE OR REPLACE FUNCTION create_pipeline_atomic(
  p_name TEXT,
  p_initial_prompt TEXT,
  p_status TEXT DEFAULT 'pending',
  p_current_phase TEXT DEFAULT 'research',
  p_max_retries INT DEFAULT 10,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  pipeline_id UUID,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_pipeline_id UUID;
  v_step_phase TEXT;
BEGIN
  -- Create pipeline (this starts implicit transaction)
  INSERT INTO pipelines (
    name,
    initial_prompt,
    status,
    current_phase,
    max_retries,
    retry_count,
    created_by
  )
  VALUES (
    p_name,
    p_initial_prompt,
    p_status,
    p_current_phase,
    p_max_retries,
    0,
    p_created_by
  )
  RETURNING id INTO v_pipeline_id;
  
  -- Create all steps atomically
  FOR v_step_phase IN 
    SELECT unnest(ARRAY['research', 'planner', 'coder', 'tester', 'publisher'])
  LOOP
    INSERT INTO pipeline_steps (
      pipeline_id,
      name,
      status,
      input,
      output
    )
    VALUES (
      v_pipeline_id,
      v_step_phase,
      'pending',
      CASE 
        WHEN v_step_phase = 'research' THEN jsonb_build_object('initialPrompt', p_initial_prompt)
        ELSE '{}'::jsonb
      END,
      '{}'::jsonb
    );
  END LOOP;
  
  -- Return result
  RETURN QUERY 
  SELECT v_pipeline_id, NOW();
  
EXCEPTION
  WHEN OTHERS THEN
    -- Postgres automatically rolls back on exception
    RAISE EXCEPTION 'Failed to create pipeline atomically: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_pipeline_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION create_pipeline_atomic TO anon;

