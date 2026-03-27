-- Migration 016: Add research_status and research_completed_at to relocation_plans
-- Phase 6 — Task Lifecycle Foundation
-- These columns are read/written by research routes but were missing from migrations (latent P0).

alter table public.relocation_plans
  add column if not exists research_status text,
  add column if not exists research_completed_at timestamptz;

comment on column public.relocation_plans.research_status is 'Research pipeline status: pending, in_progress, completed, failed';
comment on column public.relocation_plans.research_completed_at is 'Timestamp when research was last completed';
