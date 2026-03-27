-- Migration 022: Add 'partial' to research_status check constraint
-- Phase 2 (master-audit) — Research And Checklist Integrity (B2-002)
-- The research trigger now computes an honest aggregate status that can be "partial"
-- when some artifacts succeeded but quality is degraded (e.g., fallback checklist).

alter table public.relocation_plans
  drop constraint if exists relocation_plans_research_status_check;

alter table public.relocation_plans
  add constraint relocation_plans_research_status_check
  check (research_status in ('pending', 'in_progress', 'completed', 'partial', 'failed'));

comment on column public.relocation_plans.research_status is 'Research pipeline status: pending, in_progress, completed, partial, failed';
