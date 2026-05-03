-- =============================================================
-- ROLLBACK: v2 Wave 1 lifecycle stages
-- Reverts stage check constraint to v1 (collecting, generating, complete, arrived)
-- Backfills v2-only stages back to 'complete' (their pre-v2 equivalent)
-- =============================================================

-- 1. Backfill v2-only stages to their nearest v1 equivalent
update public.relocation_plans
set stage = 'complete'
where stage in ('ready_for_pre_departure', 'pre_departure');

-- 2. Drop the v2 constraint
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

-- 3. Restore the v1 constraint (matches migration 010)
alter table public.relocation_plans
  add constraint relocation_plans_stage_check
  check (stage in ('collecting', 'generating', 'complete', 'arrived'));
