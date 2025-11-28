-- MVP Pipeline System
-- Pipelines table - represents a full MVP build from idea to completion
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initial_prompt text not null,
  status text not null default 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  current_phase text,                     -- e.g. 'research', 'planner', 'coder', 'sql', 'tester'
  repo_url text,
  branch text default 'main',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pipeline steps - individual phases/steps in the pipeline
create table if not exists public.pipeline_steps (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references public.pipelines(id) on delete cascade,
  phase text not null,                    -- 'research' | 'planner' | 'coder' | 'sql' | 'tester'
  status text not null default 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  input jsonb,
  output jsonb,
  logs text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists pipelines_status_idx on public.pipelines(status);
create index if not exists pipelines_current_phase_idx on public.pipelines(current_phase);
create index if not exists pipeline_steps_pipeline_id_idx on public.pipeline_steps(pipeline_id);
create index if not exists pipeline_steps_phase_idx on public.pipeline_steps(phase);
create index if not exists pipeline_steps_status_idx on public.pipeline_steps(status);

-- Enable Realtime
alter table public.pipelines replica identity full;
alter table public.pipeline_steps replica identity full;

