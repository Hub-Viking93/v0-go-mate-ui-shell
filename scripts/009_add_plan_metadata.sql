-- Add plan metadata columns to relocation_plans
-- Applied via supabase_apply_migration "add_plan_metadata"

alter table public.relocation_plans 
  add column if not exists title text,
  add column if not exists status text not null default 'active',
  add column if not exists is_current boolean not null default false;

-- Check constraint for status values
alter table public.relocation_plans 
  add constraint relocation_plans_status_check 
  check (status in ('active', 'archived', 'completed'));

-- Partial unique index: only one is_current=true per user
create unique index if not exists relocation_plans_current_per_user 
  on public.relocation_plans (user_id) where (is_current = true);

-- Index for status queries
create index if not exists relocation_plans_status_idx 
  on public.relocation_plans (status);

-- Backfill: set the most recent plan per user as is_current=true
update public.relocation_plans p
set is_current = true
from (
  select distinct on (user_id) id
  from public.relocation_plans
  order by user_id, created_at desc
) latest
where p.id = latest.id;
