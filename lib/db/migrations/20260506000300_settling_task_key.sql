-- Phase 2B — store the canonical taskKey on settling-in rows.
--
-- Up to now the generator's stable `taskKey` ("reg-population", "bank-bankid"
-- etc.) was hidden in a `documents_needed[0]` sentinel during the 2-pass
-- insert. Phase 2B turns it into a first-class column so the UI can build
-- canonical refs ("settling-in:reg-population") for vault linkage without
-- depending on the row UUID (which changes on regen).
--
-- Idempotent.

alter table public.settling_in_tasks
  add column if not exists task_key text;

create index if not exists settling_in_tasks_task_key_idx
  on public.settling_in_tasks (plan_id, task_key);
