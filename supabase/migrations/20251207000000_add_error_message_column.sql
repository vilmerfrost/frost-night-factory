-- Add error_message column to pipelines table
-- Fixes PGRST204 error when pipeline fails

ALTER TABLE public.pipelines 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index for faster queries on failed pipelines
CREATE INDEX IF NOT EXISTS pipelines_error_message_idx 
ON public.pipelines(error_message) 
WHERE error_message IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.pipelines.error_message IS 'Error message when pipeline fails (prevents PGRST204 errors)';

