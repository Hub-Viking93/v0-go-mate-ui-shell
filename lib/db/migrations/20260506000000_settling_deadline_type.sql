-- Phase 1A — explicit deadline weight on settling-in tasks.
--
-- Adds a `deadline_type` column to `settling_in_tasks` so the generator's
-- legal/practical/recommended classification survives persistence. Default
-- back-fills from existing `is_legal_requirement` so legacy rows behave the
-- same way they always did.
--
-- Idempotent.

alter table public.settling_in_tasks
  add column if not exists deadline_type text;

-- Backfill: legal requirements → 'legal'; everything else → 'practical'.
update public.settling_in_tasks
   set deadline_type = case
     when is_legal_requirement then 'legal'
     else 'practical'
   end
 where deadline_type is null;

-- Constrain to the three known values. Applied AFTER backfill so the
-- existing rows survive.
alter table public.settling_in_tasks
  drop constraint if exists settling_in_tasks_deadline_type_check;

alter table public.settling_in_tasks
  add constraint settling_in_tasks_deadline_type_check
  check (deadline_type in ('legal', 'practical', 'recommended'));
