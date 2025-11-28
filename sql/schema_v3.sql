-- V3 Schema Update: Add cleaned_output, previous_output, and files columns
-- Run this in Supabase SQL Editor

ALTER TABLE night_task_runs
  ADD COLUMN IF NOT EXISTS cleaned_output text,
  ADD COLUMN IF NOT EXISTS previous_output text,
  ADD COLUMN IF NOT EXISTS files jsonb DEFAULT '[]'::jsonb;

-- Ensure REPLICA IDENTITY FULL is set for realtime
ALTER TABLE night_task_runs REPLICA IDENTITY FULL;

