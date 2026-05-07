-- Reverse Phase 1A deadline_type column.

alter table public.settling_in_tasks
  drop constraint if exists settling_in_tasks_deadline_type_check;

alter table public.settling_in_tasks
  drop column if exists deadline_type;
