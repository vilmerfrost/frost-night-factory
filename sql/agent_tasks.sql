-- Agent Tasks table for multi-device agent runner system
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  repo_url text not null,
  branch text not null default 'main',
  status text not null default 'pending', -- 'pending' | 'running' | 'failed' | 'completed'
  logs text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_tasks_status_idx on public.agent_tasks(status);
create index if not exists agent_tasks_created_at_idx on public.agent_tasks(created_at desc);

-- Enable Realtime for agent_tasks
alter table public.agent_tasks replica identity full;

