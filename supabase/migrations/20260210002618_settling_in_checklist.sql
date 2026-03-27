-- =============================================================
-- Migration 010: Settling-In Checklist Engine + Dependency Graph
-- Phase 6 of Pro+ Post-Relocation features
-- =============================================================

-- 1. Add arrival_date and post_relocation_generated to relocation_plans
alter table public.relocation_plans 
  add column if not exists arrival_date date,
  add column if not exists post_relocation_generated boolean default false;

-- 2. Update stage check constraint to include 'arrived'
-- Drop any existing stage check constraints (auto-named or explicit)
do $$
declare
  r record;
begin
  for r in (
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where rel.relname = 'relocation_plans'
      and nsp.nspname = 'public'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%stage%'
  ) loop
    execute format('alter table public.relocation_plans drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.relocation_plans 
  add constraint relocation_plans_stage_check 
  check (stage in ('collecting', 'generating', 'complete', 'arrived'));

-- 3. Create settling_in_tasks table
create table if not exists public.settling_in_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.relocation_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Task identity
  task_key text not null,
  title text not null,
  description text,
  category text not null,
  
  -- Dependency graph
  depends_on text[] default '{}',
  unlocked boolean default false,
  
  -- Status
  status text default 'locked' check (status in ('locked', 'available', 'in_progress', 'completed', 'skipped')),
  completed_at timestamptz,
  
  -- Deadline awareness (for Phase 8 compliance)
  deadline_days integer,
  deadline_source text,
  is_legal_requirement boolean default false,
  
  -- AI enrichment
  why_it_matters text,
  how_to text,
  official_link text,
  estimated_time text,
  cost_estimate text,
  tips text[] default '{}',
  
  -- Ordering
  sort_order integer default 0,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(plan_id, task_key)
);

-- 4. Enable RLS
alter table public.settling_in_tasks enable row level security;

-- 5. RLS policies (drop + recreate to be idempotent)
drop policy if exists "settling_tasks_select_own" on public.settling_in_tasks;
drop policy if exists "settling_tasks_insert_own" on public.settling_in_tasks;
drop policy if exists "settling_tasks_update_own" on public.settling_in_tasks;
drop policy if exists "settling_tasks_delete_own" on public.settling_in_tasks;

create policy "settling_tasks_select_own" on public.settling_in_tasks 
  for select using (auth.uid() = user_id);
create policy "settling_tasks_insert_own" on public.settling_in_tasks 
  for insert with check (auth.uid() = user_id);
create policy "settling_tasks_update_own" on public.settling_in_tasks 
  for update using (auth.uid() = user_id);
create policy "settling_tasks_delete_own" on public.settling_in_tasks 
  for delete using (auth.uid() = user_id);

-- 6. Indexes for performance
create index if not exists settling_tasks_plan_id_idx on public.settling_in_tasks(plan_id);
create index if not exists settling_tasks_user_id_idx on public.settling_in_tasks(user_id);
create index if not exists settling_tasks_status_idx on public.settling_in_tasks(status);
create index if not exists settling_tasks_category_idx on public.settling_in_tasks(category);

-- 7. Trigger for updated_at
drop trigger if exists update_settling_in_tasks_updated_at on public.settling_in_tasks;
create trigger update_settling_in_tasks_updated_at
  before update on public.settling_in_tasks
  for each row
  execute function public.update_updated_at_column();
