-- Migration 017: Add deadline_at, deadline_anchor to settling_in_tasks; add 'overdue' to status check
-- Phase 6 — Task Lifecycle Foundation
-- Enables absolute deadline computation and OVERDUE state detection.

-- 1. Add deadline columns
alter table public.settling_in_tasks
  add column if not exists deadline_at timestamptz,
  add column if not exists deadline_anchor text default 'arrival_date';

comment on column public.settling_in_tasks.deadline_at is 'Absolute deadline computed from anchor + deadline_days';
comment on column public.settling_in_tasks.deadline_anchor is 'What the deadline_days are relative to (arrival_date)';

-- 2. Drop existing status check constraint and recreate with overdue
do $$
declare
  r record;
begin
  for r in (
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where rel.relname = 'settling_in_tasks'
      and nsp.nspname = 'public'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%status%'
  ) loop
    execute format('alter table public.settling_in_tasks drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.settling_in_tasks
  add constraint settling_in_tasks_status_check
  check (status in ('locked', 'available', 'in_progress', 'completed', 'skipped', 'overdue'));

-- 3. Backfill deadline_at for existing tasks that have deadline_days and a plan with arrival_date
update public.settling_in_tasks t
set deadline_at = (
  select p.arrival_date::timestamptz + (t.deadline_days || ' days')::interval
  from public.relocation_plans p
  where p.id = t.plan_id
    and p.arrival_date is not null
)
where t.deadline_days is not null
  and t.deadline_at is null;
