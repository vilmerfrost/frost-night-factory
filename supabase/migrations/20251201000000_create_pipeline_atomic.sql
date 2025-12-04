-- ═══════════════════════════════════════════════════════════════════
-- DROP OLD FUNCTION IF EXISTS
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.create_pipeline_atomic(jsonb);

-- ═══════════════════════════════════════════════════════════════════
-- BULLETPROOF ATOMIC PIPELINE CREATION
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_pipeline_atomic(
  payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id uuid;
  v_created_at timestamptz;
  v_status text;
  v_current_phase text;
  v_name text;
  v_initial_prompt text;
  v_step_count integer;
  v_step_ids uuid[];
BEGIN

  -- Extract values with defaults
  v_status := coalesce(payload->>'status', 'pending');
  v_current_phase := coalesce(payload->>'current_phase', 'research');
  v_name := payload->>'name';
  v_initial_prompt := payload->>'initial_prompt';

  -- Validate required fields
  IF v_name IS NULL OR v_initial_prompt IS NULL THEN
    RAISE EXCEPTION 'ATOMIC FAILURE: name and initial_prompt are required';
  END IF;

  -- Create pipeline
  INSERT INTO public.pipelines (name, initial_prompt, status, current_phase)
  VALUES (v_name, v_initial_prompt, v_status, v_current_phase)

  RETURNING id, created_at

  INTO v_pipeline_id, v_created_at;



  -- Create ALL 5 steps atomically and capture IDs

  WITH inserted_steps AS (

    INSERT INTO public.pipeline_steps (pipeline_id, name, status)

    VALUES

      (v_pipeline_id, 'research',  'pending'),

      (v_pipeline_id, 'planner',   'pending'),

      (v_pipeline_id, 'coder',     'pending'),

      (v_pipeline_id, 'tester',    'pending'),

      (v_pipeline_id, 'publisher', 'pending')

    RETURNING id

  )

  SELECT array_agg(id) INTO v_step_ids FROM inserted_steps;



  -- VERIFY: Count steps created

  SELECT COUNT(*) INTO v_step_count

  FROM public.pipeline_steps

  WHERE pipeline_id = v_pipeline_id;



  -- ASSERT: Must have exactly 5 steps

  IF v_step_count != 5 THEN

    RAISE EXCEPTION 'ATOMIC FAILURE: Created % steps, expected 5 for pipeline %', 

      v_step_count, v_pipeline_id;

  END IF;



  -- Return comprehensive result

  RETURN jsonb_build_object(

    'success', true,

    'pipeline_id', v_pipeline_id,

    'created_at', v_created_at,

    'step_count', v_step_count,

    'step_ids', to_jsonb(v_step_ids)

  );



EXCEPTION

  WHEN OTHERS THEN

    -- Transaction automatically rolls back

    RETURN jsonb_build_object(

      'success', false,

      'error', SQLERRM,

      'pipeline_id', null

    );

END;

$$;



-- ═══════════════════════════════════════════════════════════════════
-- BACKFILL: Fix all existing broken pipelines
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO public.pipeline_steps (pipeline_id, name, status)
SELECT
  p.id,
  s.name,
  'pending'::text
FROM public.pipelines p
CROSS JOIN (
  VALUES
    ('research'),
    ('planner'),
    ('coder'),
    ('tester'),
    ('publisher')
) AS s(name)
LEFT JOIN public.pipeline_steps ps
  ON ps.pipeline_id = p.id
 AND ps.name = s.name
WHERE ps.id IS NULL;



-- ═══════════════════════════════════════════════════════════════════
-- VERIFY: All pipelines should have 5 steps
-- ═══════════════════════════════════════════════════════════════════
SELECT 
  p.id,
  COUNT(ps.id) as step_count,
  CASE WHEN COUNT(ps.id) = 5 THEN '✅ OK' ELSE '❌ BROKEN' END as status
FROM pipelines p
LEFT JOIN pipeline_steps ps ON ps.pipeline_id = p.id
GROUP BY p.id
HAVING COUNT(ps.id) != 5;



-- Should return 0 rows if all pipelines are fixed
