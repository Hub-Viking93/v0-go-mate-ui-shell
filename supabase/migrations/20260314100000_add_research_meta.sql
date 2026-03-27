-- Migration 021: Add research_meta JSONB column to relocation_plans
-- Phase 2 (master-audit) — Research And Checklist Integrity (B2-002)

alter table relocation_plans
  add column if not exists research_meta jsonb default '{}';

comment on column relocation_plans.research_meta is
  'Per-artifact research quality metadata: { visa: { status, quality, optionCount }, localRequirements: { status }, checklist: { status, isFallback, itemCount } }';
