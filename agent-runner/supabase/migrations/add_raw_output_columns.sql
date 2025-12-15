-- Add raw output columns to pipeline_steps for post-mortem debugging
-- This allows us to capture raw LLM responses even if parsing/validation fails

alter table pipeline_steps
  add column if not exists raw_output_text text;

alter table pipeline_steps
  add column if not exists raw_output_json jsonb;

-- Add index for faster queries when filtering by raw_output_text presence
create index if not exists idx_pipeline_steps_raw_output_text 
  on pipeline_steps(raw_output_text) 
  where raw_output_text is not null;

