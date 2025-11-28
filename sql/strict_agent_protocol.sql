-- Strict Agent Protocol v2.0 Tables
-- Run this in Supabase SQL Editor

-- Pipeline state (per task)
create table if not exists night_factory_pipeline_state (
  task_id bigint primary key references night_tasks(id) on delete cascade,
  planner_completed boolean default false,
  coder_completed boolean default false,
  reviewer_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Agent run log (for timeline / debug)
create table if not exists night_factory_agent_runs (
  id bigint generated always as identity primary key,
  task_id bigint references night_tasks(id) on delete cascade,
  run_id bigint references night_task_runs(id) on delete cascade,
  role text check (role in ('planner','coder','reviewer')),
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text check (status in ('pending','processing','completed','failed')) default 'processing',
  error_message text
);

-- Indexes for performance
create index if not exists idx_agent_runs_task_id on night_factory_agent_runs(task_id);
create index if not exists idx_agent_runs_run_id on night_factory_agent_runs(run_id);
create index if not exists idx_agent_runs_role on night_factory_agent_runs(role);

