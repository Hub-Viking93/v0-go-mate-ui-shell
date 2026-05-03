-- =============================================================
-- v2 Wave 1.3 — manual-trigger columns on relocation_plans
-- =============================================================
-- Adds two timestamps that record when the user explicitly clicked the
-- buttons that drive the v2 lifecycle:
--
--   user_triggered_research_at        — "Generate my plan"
--   user_triggered_pre_departure_at   — "Generate my pre-departure checklist"
--
-- These columns are the SOLE source of authority for the
--   collecting -> generating
-- and
--   ready_for_pre_departure -> pre_departure
-- transitions. Per the v2 spec, profile completion does NOT auto-trigger
-- research, and research completion does NOT auto-trigger pre-departure.
-- Each transition requires an explicit user click that hits a POST endpoint
-- which writes one of these timestamps and bumps `stage` accordingly.
-- =============================================================

alter table public.relocation_plans
  add column if not exists user_triggered_research_at timestamptz,
  add column if not exists user_triggered_pre_departure_at timestamptz;

-- Partial indexes — most rows will be NULL for one or both columns; this
-- keeps the index small while still supporting "who has triggered X?" lookups
-- by background workers and analytics.
create index if not exists idx_relocation_plans_user_triggered_research_at
  on public.relocation_plans (user_triggered_research_at)
  where user_triggered_research_at is not null;

create index if not exists idx_relocation_plans_user_triggered_pre_departure_at
  on public.relocation_plans (user_triggered_pre_departure_at)
  where user_triggered_pre_departure_at is not null;

comment on column public.relocation_plans.user_triggered_research_at is
  'v2 Wave 1.3: timestamp when the user clicked "Generate my plan". Required for the collecting -> generating transition. Profile completion alone does NOT advance the stage.';

comment on column public.relocation_plans.user_triggered_pre_departure_at is
  'v2 Wave 1.3: timestamp when the user clicked "Generate my pre-departure checklist". Required for the ready_for_pre_departure -> pre_departure transition. Research completion alone does NOT advance the stage.';
