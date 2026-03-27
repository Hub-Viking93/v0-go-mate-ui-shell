-- Migration 021: Add research_meta JSONB column for per-artifact status tracking
-- Phase 2 (Research And Checklist Integrity): B2-002 research status integrity

alter table relocation_plans
  add column if not exists research_meta jsonb default '{}';

-- Add comment explaining the column's purpose
comment on column relocation_plans.research_meta is
  'Per-artifact research quality metadata: { visa: { status, quality, optionCount }, localRequirements: { status, categoryCount }, checklist: { status, isFallback, itemCount } }';
