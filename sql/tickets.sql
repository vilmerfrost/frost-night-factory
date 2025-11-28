-- Tickets table - unified system for bugs and features
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bug', 'feature')), -- 'bug' | 'feature'
  title text not null,
  description text not null,
  source text, -- 'user_app', 'internal', 'admin_panel', etc.
  status text not null default 'new', 
  -- 'new' | 'queued' | 'pipeline_running' | 'resolved' | 'needs_human_review' | 'rejected'
  auto_handle boolean not null default false, -- true = let Night Factory take over automatically
  pipeline_id uuid references public.pipelines(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  project text default 'frost-solutions' -- so you can have multiple projects later
);

-- Indexes
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_type_idx on public.tickets(type);
create index if not exists tickets_auto_handle_idx on public.tickets(auto_handle);
create index if not exists tickets_pipeline_id_idx on public.tickets(pipeline_id);
create index if not exists tickets_created_at_idx on public.tickets(created_at desc);

-- Enable Realtime
alter table public.tickets replica identity full;

