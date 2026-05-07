-- Phase 1B — long-form walkthrough payload on settling-in tasks.
--
-- Adds a `walkthrough` jsonb column to `settling_in_tasks` so the
-- structured detail-view content (whatThisIs / whyItMatters / steps[] /
-- commonMistakes[] / whatHappensNext) is persisted alongside the task.
-- Default is null — tasks without authored walkthroughs render the
-- summary only (UI handles the empty case explicitly).
--
-- Idempotent.

alter table public.settling_in_tasks
  add column if not exists walkthrough jsonb;
