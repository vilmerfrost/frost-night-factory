-- Frost Night Factory v0.1 Migration
-- Idea → MVP Pipeline System

-- 1. Pipelines table
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initial_prompt text not null,
  status text not null default 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  current_phase text, -- 'research' | 'planner' | 'coder' | 'sql' | 'tester'
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Pipeline steps table
create table if not exists public.pipeline_steps (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references public.pipelines(id) on delete cascade,
  phase text not null, -- 'research' | 'planner' | 'coder' | 'sql' | 'tester'
  status text not null default 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  input jsonb,
  output jsonb,
  logs text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
create index if not exists pipelines_status_idx on public.pipelines(status);
create index if not exists pipeline_steps_pipeline_id_idx on public.pipeline_steps(pipeline_id);
create index if not exists pipeline_steps_phase_idx on public.pipeline_steps(phase);
create index if not exists pipeline_steps_status_idx on public.pipeline_steps(status);

-- Enable Realtime (optional, for UI updates)
alter table public.pipelines replica identity full;
alter table public.pipeline_steps replica identity full;

