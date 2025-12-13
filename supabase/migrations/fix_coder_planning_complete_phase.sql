-- Fix: Update legacy phase names to normalized versions
-- This prevents the phase reset loop where coder_planning_complete → Unknown phase → research

UPDATE pipelines
SET current_phase = 'coder'
WHERE current_phase = 'coder_planning_complete';

UPDATE pipelines
SET current_phase = 'coder'
WHERE current_phase = 'coder_planning';

UPDATE pipelines
SET current_phase = 'planner'
WHERE current_phase = 'planning';

UPDATE pipelines
SET current_phase = 'sql'
WHERE current_phase IN ('sql_editor', 'sqleditor');

UPDATE pipelines
SET current_phase = 'tester'
WHERE current_phase IN ('test', 'testing');

-- Log the fix
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % pipelines with normalized phase names', updated_count;
END $$;

