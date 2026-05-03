-- =============================================================
-- v2 Wave 1 — extend relocation_plans.stage with new lifecycle values
-- =============================================================
-- Adds two new stages: ready_for_pre_departure, pre_departure.
-- Backfills existing locked + complete plans into ready_for_pre_departure
-- so the v2 dashboard recognises them as locked-and-ready.
-- =============================================================

-- 1. Drop existing stage check constraints (auto-named or explicit)
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

-- 2. Re-add with the v2 stage set
alter table public.relocation_plans
  add constraint relocation_plans_stage_check
  check (stage in (
    'collecting',
    'generating',
    'complete',
    'ready_for_pre_departure',
    'pre_departure',
    'arrived'
  ));

-- 3. Backfill: every plan that is currently locked + complete becomes
-- ready_for_pre_departure. This is the v2 stage that succeeds "locked
-- profile, ready for the pre-departure agent" and is the correct landing
-- spot for all existing locked plans regardless of when they're moving.
-- (No arrival_date filter: per the Wave 1 plan, every existing
-- stage='complete' AND locked=true row should be migrated, including plans
-- whose arrival_date has already passed but who never advanced to 'arrived'.)
update public.relocation_plans
set stage = 'ready_for_pre_departure'
where stage = 'complete'
  and locked = true;
