-- Add task_key column to settling_in_tasks if it doesn't exist
-- This column was defined in migration 010 but may not exist if the table
-- was created before 010 was applied (create table if not exists is a no-op
-- when the table already exists).

alter table public.settling_in_tasks
  add column if not exists task_key text;

-- Backfill any existing tasks with a slug derived from the title
update public.settling_in_tasks
  set task_key = left(
    regexp_replace(
      regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'),
      '^-|-$', '', 'g'
    ),
    64
  )
  where task_key is null;

-- Add unique constraint if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settling_in_tasks_plan_id_task_key_key'
  ) then
    alter table public.settling_in_tasks
      add constraint settling_in_tasks_plan_id_task_key_key unique (plan_id, task_key);
  end if;
end $$;
