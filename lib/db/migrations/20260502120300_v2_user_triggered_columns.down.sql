-- =============================================================
-- ROLLBACK: v2 Wave 1.3 manual-trigger columns
-- Drops the two timestamps and their partial indexes.
-- =============================================================

drop index if exists public.idx_relocation_plans_user_triggered_pre_departure_at;
drop index if exists public.idx_relocation_plans_user_triggered_research_at;

alter table public.relocation_plans
  drop column if exists user_triggered_pre_departure_at,
  drop column if exists user_triggered_research_at;
